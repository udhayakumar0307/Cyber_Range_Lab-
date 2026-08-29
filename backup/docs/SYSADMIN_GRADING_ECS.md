# Sysadmin grading on dedicated ECS capacity

CyberRange supports two grading executors:

- `local`: development only. The FastAPI host invokes the private question-bank runner and requires local Docker.
- `ecs`: production. The FastAPI host transports the submission/result through private S3 objects and launches the trusted grading worker on the dedicated `cyberrange-sysadmin-grading` ECS/EC2 capacity.

The production backend must **not** mount `/var/run/docker.sock` and must not execute student Bash. The Docker socket exists only on the dedicated grading EC2 host and is mounted only into the trusted grading-worker task.

## Production environment

```bash
export SYSADMIN_GRADING_ENABLED=true
export SYSADMIN_GRADING_EXECUTOR=ecs
export SYSADMIN_QUESTION_BANK_ROOT=/opt/cyberrange/RHSA-question-bank

export SYSADMIN_GRADING_AWS_REGION=ap-south-1
export SYSADMIN_GRADING_ECS_CLUSTER=cyberrange-sysadmin-grading
export SYSADMIN_GRADING_ECS_TASK_DEFINITION=cyberrange-sysadmin-grader:1
export SYSADMIN_GRADING_ECS_CAPACITY_PROVIDER=sysadmin-grader-capacity
export SYSADMIN_GRADING_ECS_CONTAINER_NAME=rhsa-grading-worker
export SYSADMIN_GRADING_ECS_TASK_TIMEOUT_SECONDS=600
export SYSADMIN_GRADING_ECS_POLL_INTERVAL_SECONDS=2

export SYSADMIN_GRADING_S3_BUCKET=cyberrange-sysadmin-grading-766363046973-ap-south-1
export SYSADMIN_GRADING_S3_PREFIX=sysadmin-grading
export SYSADMIN_GRADING_S3_URL_TTL_SECONDS=900
export SYSADMIN_GRADING_S3_CLEANUP=true

export SYSADMIN_GRADING_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/766363046973/cyberrange-sysadmin-grading-jobs
export SYSADMIN_GRADING_QUEUE_WAIT_SECONDS=20
export SYSADMIN_GRADING_QUEUE_VISIBILITY_SECONDS=900
export SYSADMIN_GRADING_QUEUE_RETRY_VISIBILITY_SECONDS=60
export SYSADMIN_GRADING_QUEUE_MAX_RECEIVES=3

# Production workspaces must receive their narrow submission token from the
# orchestrator rather than minting it themselves.
export SYSADMIN_ALLOW_USER_WORKSPACE_TOKEN_MINTING=false
```

`SYSADMIN_GRADING_S3_URL_TTL_SECONDS` must remain at least 60 seconds longer than `SYSADMIN_GRADING_ECS_TASK_TIMEOUT_SECONDS`.

## Backend IAM permissions

The CyberRange backend EC2 instance needs an IAM instance role that can:

1. put/get/delete transient grading objects in the grading bucket;
2. run the pinned grading task definition in the dedicated cluster;
3. describe and stop the task while waiting for completion; and
4. pass only the grading task execution role and grading task role to ECS.

Example policy (adjust account/region/names if infrastructure changes):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SysadminGradingObjects",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::cyberrange-sysadmin-grading-766363046973-ap-south-1/sysadmin-grading/*"
    },
    {
      "Sid": "RunSysadminGrader",
      "Effect": "Allow",
      "Action": "ecs:RunTask",
      "Resource": "arn:aws:ecs:ap-south-1:766363046973:task-definition/cyberrange-sysadmin-grader:*",
      "Condition": {
        "ArnEquals": {
          "ecs:cluster": "arn:aws:ecs:ap-south-1:766363046973:cluster/cyberrange-sysadmin-grading"
        }
      }
    },
    {
      "Sid": "ObserveSysadminGrader",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTasks",
        "ecs:StopTask"
      ],
      "Resource": "*",
      "Condition": {
        "ArnEquals": {
          "ecs:cluster": "arn:aws:ecs:ap-south-1:766363046973:cluster/cyberrange-sysadmin-grading"
        }
      }
    },
    {
      "Sid": "PassOnlyGradingTaskRoles",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::766363046973:role/CyberRangeSysadminGraderTaskExecutionRole",
        "arn:aws:iam::766363046973:role/CyberRangeSysadminGraderTaskRole"
      ],
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "ecs-tasks.amazonaws.com"
        }
      }
    }
  ]
}
```

The worker itself does not need S3 permissions because the backend supplies short-lived presigned object URLs. Its task role remains limited to pulling the `cyberrange/rhsa-base` sandbox image from ECR.

## Result contract

The trusted worker contract intentionally distinguishes academic outcome from infrastructure outcome:

- worker exit `0` + result `passed=true`: grading succeeded, student passed;
- worker exit `0` + result `passed=false`: grading succeeded, student failed academically;
- worker non-zero: grading infrastructure failed and the submission is persisted as `ERROR`.

The executor validates contract version `1`, verifies the requested lab ID, stores the structured rubric result, and takes the question-bank revision from `metadata.worker.question_bank_revision` when present.

## v0.6 asynchronous execution model

`POST /api/v1/sysadmin-grading/workspace-submit` is durable and asynchronous:

1. validate the narrow workspace credential and Bash submission;
2. create one `sysadmin_submissions` row with `status=QUEUED`;
3. publish `{\"version\":1,\"submission_id\":...}` to SQS;
4. return HTTP `202` without waiting for ECS capacity or grading;
5. `cyberrange-sysadmin-grading-dispatcher.service` consumes SQS and runs the existing trusted ECS executor;
6. persist `PASS`, `FAIL`, `ERROR`, or `TIMED_OUT` before deleting the SQS message.

The DB row is also the outbox record. If `SendMessage` fails after the row is accepted, `queue_message_id` remains null and the dispatcher republishes the row. SQS duplicate deliveries are guarded by a DB claim/lease; completed submissions are never graded again. Final infrastructure failures are left unacknowledged so the queue redrive policy can move them to the DLQ.

The legacy authenticated `/submissions` endpoint remains synchronous for development compatibility in this milestone. The production browser-terminal path uses `workspace-submit`.
