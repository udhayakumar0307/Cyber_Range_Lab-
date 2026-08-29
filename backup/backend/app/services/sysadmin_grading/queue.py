from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from .config import SysadminGradingSettings


class GradingQueueError(RuntimeError):
    pass


@dataclass(frozen=True)
class GradingQueueMessage:
    submission_id: int
    receipt_handle: str
    message_id: str
    receive_count: int


class SQSGradingQueue:
    """Small SQS transport wrapper for durable Sysadmin grading jobs."""

    CONTRACT_VERSION = 1

    def __init__(
        self,
        settings: SysadminGradingSettings,
        *,
        sqs_client: Any | None = None,
    ) -> None:
        self.settings = settings
        if sqs_client is None:
            sqs_client = boto3.client(
                "sqs",
                region_name=settings.aws_region,
                config=Config(retries={"max_attempts": 10, "mode": "standard"}),
            )
        self.sqs = sqs_client

    def send_job(self, submission_id: int) -> str:
        body = json.dumps(
            {"version": self.CONTRACT_VERSION, "submission_id": int(submission_id)},
            separators=(",", ":"),
            sort_keys=True,
        )
        try:
            response = self.sqs.send_message(
                QueueUrl=self.settings.grading_queue_url,
                MessageBody=body,
            )
        except (BotoCoreError, ClientError) as exc:
            raise GradingQueueError(f"Unable to enqueue grading job: {exc}") from exc

        message_id = response.get("MessageId")
        if not message_id:
            raise GradingQueueError("SQS SendMessage succeeded without returning MessageId.")
        return str(message_id)

    def receive_one(self) -> GradingQueueMessage | None:
        try:
            response = self.sqs.receive_message(
                QueueUrl=self.settings.grading_queue_url,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=self.settings.grading_queue_wait_seconds,
                VisibilityTimeout=self.settings.grading_queue_visibility_seconds,
                AttributeNames=["ApproximateReceiveCount"],
            )
        except (BotoCoreError, ClientError) as exc:
            raise GradingQueueError(f"Unable to receive grading job: {exc}") from exc

        messages = response.get("Messages") or []
        if not messages:
            return None

        raw = messages[0]
        try:
            payload = json.loads(raw["Body"])
            if not isinstance(payload, dict):
                raise ValueError("body is not an object")
            if payload.get("version") != self.CONTRACT_VERSION:
                raise ValueError(f"unsupported version {payload.get('version')!r}")
            submission_id = int(payload["submission_id"])
            if submission_id <= 0:
                raise ValueError("submission_id must be positive")
            receipt_handle = str(raw["ReceiptHandle"])
            message_id = str(raw["MessageId"])
            receive_count = int(
                (raw.get("Attributes") or {}).get("ApproximateReceiveCount", "1")
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            # Surface the raw message identifiers so the dispatcher can decide
            # whether to delete or allow a poison message to redrive.
            raise GradingQueueError(f"Invalid grading queue message: {exc}") from exc

        return GradingQueueMessage(
            submission_id=submission_id,
            receipt_handle=receipt_handle,
            message_id=message_id,
            receive_count=max(1, receive_count),
        )

    def delete(self, receipt_handle: str) -> None:
        try:
            self.sqs.delete_message(
                QueueUrl=self.settings.grading_queue_url,
                ReceiptHandle=receipt_handle,
            )
        except (BotoCoreError, ClientError) as exc:
            raise GradingQueueError(f"Unable to delete grading queue message: {exc}") from exc

    def retry_later(self, receipt_handle: str) -> None:
        try:
            self.sqs.change_message_visibility(
                QueueUrl=self.settings.grading_queue_url,
                ReceiptHandle=receipt_handle,
                VisibilityTimeout=self.settings.grading_queue_retry_visibility_seconds,
            )
        except (BotoCoreError, ClientError) as exc:
            raise GradingQueueError(
                f"Unable to change grading message visibility: {exc}"
            ) from exc

    def delete_raw(self, receipt_handle: str) -> None:
        """Alias used by defensive dispatcher code for known poison messages."""
        self.delete(receipt_handle)
