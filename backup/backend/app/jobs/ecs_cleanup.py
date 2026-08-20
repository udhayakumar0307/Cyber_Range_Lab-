"""
ECS Idle Session & Stale Task Garbage Collector.

Sweeps the 'cyberrange-labs' cluster for:
  1. Inactive/idle lab tasks (no activity for 10 minutes / 600s)
  2. Long-running stale tasks (active for >4 hours total)
"""
import logging
import os
import time

logger = logging.getLogger(__name__)

MAX_IDLE_SECONDS = 10 * 60       # 10 minutes idle limit
MAX_TASK_AGE_SECONDS = 4 * 3600  # 4 hours hard safety cap


def cleanup_stale_ecs_tasks():
    """Find and terminate ECS lab tasks that are idle >10 min or running >4 hours."""
    mode = os.getenv("ORCHESTRATOR", "docker").lower()
    if mode != "ecs":
        return

    cluster_name = os.getenv("ECS_CLUSTER", "cyberrange-labs")
    region = os.getenv("AWS_REGION", "ap-south-1")

    try:
        import boto3
        from app.lab.session_store import get_session
        ecs = boto3.client("ecs", region_name=region)
        now = time.time()

        paginator = ecs.get_paginator("list_tasks")
        for page in paginator.paginate(cluster=cluster_name):
            task_arns = page.get("taskArns", [])
            if not task_arns:
                continue

            tasks = ecs.describe_tasks(cluster=cluster_name, tasks=task_arns, include=["TAGS"])
            for task in tasks.get("tasks", []):
                task_arn = task.get("taskArn")
                created_at = task.get("createdAt")
                status = task.get("lastStatus")

                if status == "STOPPED":
                    continue

                age = now - created_at.timestamp() if created_at else 0
                tags = {t["key"]: t["value"] for t in task.get("tags", [])}
                user_id = tags.get("user_id")
                lab_id = tags.get("lab_id", "lab1-recon")

                # Check 1: Has task exceeded max hard 4-hour lifespan?
                if age > MAX_TASK_AGE_SECONDS:
                    logger.warning(f"[ECS GC] Terminating stale task {task_arn} for user {user_id} (age >4h)")
                    try:
                        ecs.stop_task(cluster=cluster_name, task=task_arn, reason="Stale task garbage collection (>4h age)")
                    except Exception as stop_err:
                        logger.error(f"[ECS GC] Error stopping {task_arn}: {stop_err}")
                    continue

                # Check 2: Has session been idle/inactive for >10 minutes?
                if user_id:
                    session = get_session(user_id, lab_id)
                    # If Redis session has expired/deleted or last activity was >10 minutes ago
                    last_active = session.get("last_active", created_at.timestamp() if created_at else now) if session else None
                    idle_duration = now - last_active if last_active else age

                    if idle_duration > MAX_IDLE_SECONDS:
                        logger.warning(
                            f"[ECS GC] Terminating idle task {task_arn} for user {user_id} "
                            f"(idle for {int(idle_duration // 60)} minutes > 10m threshold)"
                        )
                        try:
                            ecs.stop_task(cluster=cluster_name, task=task_arn, reason="Idle session timeout (>10m inactivity)")
                        except Exception as stop_err:
                            logger.error(f"[ECS GC] Error stopping idle task {task_arn}: {stop_err}")
    except Exception as exc:
        logger.error(f"[ECS Garbage Collector] Task sweep failed: {exc}")
