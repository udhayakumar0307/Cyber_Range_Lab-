# AWS SNS deployment notes

Configure `AWS_REGION` and `SNS_TOPIC_ARN` in the backend runtime environment. Use an IAM role in AWS deployments; `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are optional local-development environment variables and must never be committed.

The worker needs only `sns:Publish` on the configured topic and, if SMS delivery is enabled, `sns:Publish` for approved SMS destinations. Do not grant frontend clients AWS credentials or SNS permissions.

The FastAPI process starts a daily worker automatically. In multi-replica production, run a single worker replica or configure AWS EventBridge Scheduler to invoke the worker once daily, preventing duplicate fan-out.

Container, resource-monitoring, failed-payment, and security workers should call `notification_service.notify_administrators(...)` with their validated event payloads; it records every attempted delivery in `notifications` and `audit_logs`.
