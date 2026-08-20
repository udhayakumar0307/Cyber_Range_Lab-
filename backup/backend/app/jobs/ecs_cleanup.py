"""
Hourly ECS Stale Task Garbage Collector.

Queries the 'cyberrange-labs' cluster for any running lab tasks
that have been active for more than 4 hours, and terminates them
to prevent orphaned compute costs.
"""
import logging
import os
import time

logger = logging.getLogger(__name__)

MAX_TASK_AGE_SECONDS = 4 * 3600  # 4 hours


def cleanup_stale_ecs_tasks():
    """Find and terminate ECS lab tasks running longer than MAX_TASK_AGE_SECONDS."""
    mode = os.getenv("ORCHESTRATOR", "docker").lower()
    if mode != "ecs":
        return

    cluster_name = os.getenv("ECS_CLUSTER", "cyberrange-labs")
    region = os.getenv("AWS_REGION", "ap-south-1")

    try:
        import boto3
        ecs = boto3.client("ecs", region_name=region)
        now = time.time()

        paginator = ecs.get_paginator("list_tasks")
        for page in paginator.paginate(cluster=cluster_name):
            task_arns = page.get("taskArns", [])
            if not task_arns:
                continue

            tasks = ecs.describe_tasks(cluster=cluster_name, tasks=task_arns)
            for task in tasks.get("tasks", []):
                created_at = task.get("createdAt")
                if not created_at:
                    continue

                age = now - created_at.timestamp()
                task_arn = task.get("taskArn")

                if age > MAX_TASK_AGE_SECONDS:
                    logger.warning(
                        f"[ECS Garbage Collector] Terminating stale task {task_arn} "
                        f"(running for {int(age // 3600)}h {int((age % 3600) // 60)}m)"
                    )
                    try:
                        ecs.stop_task(
                            cluster=cluster_name,
                            task=task_arn,
                            reason="Stale task garbage collection (>4h age)",
                        )
                    except Exception as stop_err:
                        logger.error(f"[ECS Garbage Collector] Error stopping {task_arn}: {stop_err}")
    except Exception as exc:
        logger.error(f"[ECS Garbage Collector] Task sweep failed: {exc}")
