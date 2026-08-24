"""
AWS Lab Service — STS Vending, Console Federation & IaC Provisioner
=====================================================================
Handles:
  1. Temporary AWS STS credentials vending (`sts:AssumeRole` or `sts:GetSessionToken`) with 2-hour TTL.
  2. One-click AWS Management Console Signin URL generation via AWS Signin Federation API.
  3. CloudFormation stack provisioning and deletion for CloudCorp levels.
"""

import json
import logging
import os
import requests
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_REGION = os.getenv("AWS_REGION", "ap-south-1")


class AWSLabService:
    """Service managing dynamic AWS STS sessions and CloudFormation stacks."""

    def __init__(self, region: str = DEFAULT_REGION):
        self.region = region

    def _get_boto3_client(self, service_name: str, credentials: Optional[Dict[str, str]] = None):
        import boto3
        if credentials:
            return boto3.client(
                service_name,
                region_name=self.region,
                aws_access_key_id=credentials.get("AccessKeyId"),
                aws_secret_access_key=credentials.get("SecretAccessKey"),
                aws_session_token=credentials.get("SessionToken"),
            )
        
        key = getattr(settings, "AWS_ACCESS_KEY_ID", None) or os.getenv("AWS_ACCESS_KEY_ID")
        secret = getattr(settings, "AWS_SECRET_ACCESS_KEY", None) or os.getenv("AWS_SECRET_ACCESS_KEY")
        token = getattr(settings, "AWS_SESSION_TOKEN", None) or os.getenv("AWS_SESSION_TOKEN")

        if key and secret:
            return boto3.client(
                service_name,
                region_name=self.region,
                aws_access_key_id=key,
                aws_secret_access_key=secret,
                aws_session_token=token,
            )
        return boto3.client(service_name, region_name=self.region)

    def generate_sts_credentials(self, user_id: int, duration_seconds: int = 7200) -> Dict[str, Any]:
        """
        Generates temporary AWS STS credentials for a student session using
        sts:AssumeRole or sts:GetSessionToken.
        """
        sts_client = self._get_boto3_client("sts")

        # Dynamically auto-detect current AWS Account ID
        account_id = os.getenv("AWS_ACCOUNT_ID")
        if not account_id or account_id == "123456789012":
            try:
                caller_id = sts_client.get_caller_identity()
                account_id = caller_id.get("Account")
            except Exception as id_err:
                logger.info(f"[AWSLabService] get_caller_identity failed: {id_err}")

        # 1. Try AssumeRole if explicitly enabled via USE_ASSUME_ROLE=true
        if os.getenv("USE_ASSUME_ROLE", "false").lower() in ("true", "1") and account_id:
            for role_name in [f"CyberRangeStudentRole-{user_id}", "CyberRangeStudentRole"]:
                try:
                    role_arn = f"arn:aws:iam::{account_id}:role/{role_name}"
                    logger.info(f"[AWSLabService] Assuming role {role_arn} for student session {user_id}...")
                    response = sts_client.assume_role(
                        RoleArn=role_arn,
                        RoleSessionName=f"student-{user_id}",
                        DurationSeconds=duration_seconds,
                    )
                    creds = response["Credentials"]
                    return {
                        "AccessKeyId": creds["AccessKeyId"],
                        "SecretAccessKey": creds["SecretAccessKey"],
                        "SessionToken": creds["SessionToken"],
                        "Expiration": creds["Expiration"].isoformat(),
                        "Region": self.region,
                        "Arn": f"arn:aws:sts::{account_id}:assumed-role/{role_name}/student-{user_id}",
                    }
                except Exception as exc:
                    logger.debug(f"[AWSLabService] AssumeRole '{role_name}' skipped ({exc}).")

        # 2. Fallback to GetSessionToken (generates temporary session credentials)
        try:
            response = sts_client.get_session_token(DurationSeconds=duration_seconds)
            creds = response["Credentials"]
            return {
                "AccessKeyId": creds["AccessKeyId"],
                "SecretAccessKey": creds["SecretAccessKey"],
                "SessionToken": creds["SessionToken"],
                "Expiration": creds["Expiration"].isoformat(),
                "Region": self.region,
            }
        except Exception as get_tok_err:
            logger.warning(f"[AWSLabService] GetSessionToken failed ({get_tok_err}).")
            return {
                "AccessKeyId": os.getenv("AWS_ACCESS_KEY_ID", ""),
                "SecretAccessKey": os.getenv("AWS_SECRET_ACCESS_KEY", ""),
                "SessionToken": os.getenv("AWS_SESSION_TOKEN", ""),
                "Expiration": (datetime.utcnow() + timedelta(seconds=duration_seconds)).isoformat(),
                "Region": self.region,
                "is_fallback": True,
            }

    def generate_console_federation_url(self, credentials: Dict[str, str]) -> str:
        """
        Calls AWS Signin Federation API to generate a one-click login URL
        for the AWS Management Console.
        """
        try:
            session_json = json.dumps({
                "sessionId": credentials["AccessKeyId"],
                "sessionKey": credentials["SecretAccessKey"],
                "sessionToken": credentials.get("SessionToken", ""),
            })

            fed_endpoint = "https://signin.aws.amazon.com/federation"
            response = requests.get(
                fed_endpoint,
                params={
                    "Action": "getSigninToken",
                    "Session": session_json,
                },
                timeout=10,
            )

            if response.status_code != 200:
                logger.warning(f"[AWSLabService] SigninToken request failed (HTTP {response.status_code}): {response.text[:200]}")
                return f"https://{self.region}.console.aws.amazon.com/console/home?region={self.region}"

            signin_token = response.json().get("SigninToken")
            destination = f"https://{self.region}.console.aws.amazon.com/console/home?region={self.region}"

            console_url = (
                f"{fed_endpoint}?Action=login"
                f"&Destination={requests.utils.quote(destination, safe='')}"
                f"&SigninToken={signin_token}"
            )
            return console_url
        except Exception as exc:
            logger.error(f"[AWSLabService] Failed to generate console federation URL: {exc}")
            return f"https://{self.region}.console.aws.amazon.com/console/home?region={self.region}"

    def deploy_level_stack(self, level: int, session_id: str) -> Dict[str, Any]:
        """Deploy CloudFormation stack for a specific CloudCorp level."""
        cfn_client = self._get_boto3_client("cloudformation")
        stack_name = f"cloudcorp-level{level}-{session_id}"
        template_file = os.path.join(
            settings.root_dir,
            "labs",
            "cloudcorp-aws-lab",
            "cloudformation",
            f"level{level}-s3.yaml" if level == 0 else
            f"level{level}-iam-policy.yaml" if level == 1 else
            f"level{level}-ec2-imds.yaml" if level == 2 else
            f"level{level}-serverless-secrets.yaml" if level == 3 else
            f"level{level}-cloudtrail-forensics.yaml" if level == 4 else
            f"level{level}-governance.yaml"
        )

        if not os.path.exists(template_file):
            logger.info(f"[AWSLabService] Template file '{template_file}' not found — stack deployment skipped.")
            return {"stack_name": stack_name, "status": "SKIPPED"}

        try:
            with open(template_file, "r", encoding="utf-8") as f:
                template_body = f.read()

            logger.info(f"[AWSLabService] Creating CloudFormation stack '{stack_name}'...")
            cfn_client.create_stack(
                StackName=stack_name,
                TemplateBody=template_body,
                Parameters=[
                    {"ParameterKey": "StudentSessionId", "ParameterValue": session_id}
                ],
                Capabilities=["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM"],
                Tags=[
                    {"Key": "Environment", "Value": "CyberRangeLab"},
                    {"Key": "Level", "Value": f"Level{level}"},
                    {"Key": "SessionId", "Value": session_id},
                ],
            )
            return {"stack_name": stack_name, "status": "CREATE_IN_PROGRESS"}
        except Exception as exc:
            logger.info(f"[AWSLabService] CloudFormation stack '{stack_name}' status: {exc}")
            return {"stack_name": stack_name, "status": "EXISTS_OR_SKIPPED", "error": str(exc)}

    def delete_level_stack(self, level: int, session_id: str) -> bool:
        """Tears down a deployed CloudFormation level stack."""
        cfn_client = self._get_boto3_client("cloudformation")
        stack_name = f"cloudcorp-level{level}-{session_id}"
        try:
            cfn_client.delete_stack(StackName=stack_name)
            logger.info(f"[AWSLabService] Delete request sent for stack '{stack_name}'.")
            return True
        except Exception as exc:
            logger.warning(f"[AWSLabService] Error deleting stack '{stack_name}': {exc}")
            return False


# Module singleton
aws_lab_service = AWSLabService()
