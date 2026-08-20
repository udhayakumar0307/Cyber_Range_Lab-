"""
Lab container orchestration abstraction layer.

ORCHESTRATOR env var controls which implementation is used:
  docker  -> DockerOrchestrator  (local development, default)
  ecs     -> ECSOrchestrator     (production AWS ECS cluster)
"""
import logging
import os
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# ── Abstract base ────────────────────────────────────────────────────────────

class LabOrchestrator(ABC):

    @abstractmethod
    def provision(self, user_id: str, lab_id: str, lab_seed: str) -> Dict[str, Any]:
        """
        Provision a student lab environment.
        Returns a dict containing at minimum:
          - student_container_ref: identifier (container name or task ARN)
          - student_host: IP or hostname for WebSocket/SSH connection
          - student_port: SSH/shell port on that host
          - lab_seed: deterministic seed
        """
        ...

    @abstractmethod
    def teardown(self, user_id: str, lab_id: str) -> None:
        """Stop and remove all containers for this student's session."""
        ...

    @abstractmethod
    def is_running(self, user_id: str, lab_id: str) -> bool:
        """Return True if the student's lab environment is currently running."""
        ...


# ── Docker implementation (local development) ─────────────────────────────

class DockerOrchestrator(LabOrchestrator):
    """Uses local Docker daemon. Preserves existing behavior for local dev."""

    def provision(self, user_id: str, lab_id: str, lab_seed: str) -> Dict[str, Any]:
        from app.api.v1.endpoints.recon_api import provision_recon_session
        res = provision_recon_session(user_id)
        return {
            "student_container_ref": res.get("student_container", f"lab1-student-{user_id}"),
            "student_host": "127.0.0.1",
            "student_port": 2222,
            "lab_seed": lab_seed,
            **res,
        }

    def teardown(self, user_id: str, lab_id: str) -> None:
        from app.api.v1.endpoints.recon_api import _teardown_recon_session
        _teardown_recon_session(user_id)

    def is_running(self, user_id: str, lab_id: str) -> bool:
        from app.api.v1.endpoints.recon_api import get_student_container_name
        import subprocess, shutil
        docker_bin = shutil.which("docker") or "/usr/bin/docker"
        name = get_student_container_name(user_id)
        try:
            out = subprocess.check_output(
                [docker_bin, "ps", "--format", "{{.Names}}"],
                stderr=subprocess.DEVNULL
            ).decode("utf-8", errors="ignore")
            return name in out.splitlines()
        except Exception:
            return False


# ── ECS implementation (production) ─────────────────────────────────────────

class ECSOrchestrator(LabOrchestrator):
    """Uses AWS ECS EC2 launch type. Lab containers run on ECS worker cluster."""

    CLUSTER_NAME = os.getenv("ECS_CLUSTER", "cyberrange-labs")
    REGION       = os.getenv("AWS_REGION", "ap-south-1")

    TASK_DEFINITIONS = {
        "lab1-recon":             "lab1-recon",
        "puzzle-lab":             "puzzle-lab",
        "techcorp-sysadmin-labs": "puzzle-lab",
        "command-line-lab":       "command-line-lab",
    }

    def __init__(self):
        import boto3
        self._ecs = boto3.client("ecs", region_name=self.REGION)
        self._ec2 = boto3.client("ec2", region_name=self.REGION)

    def _task_family(self, lab_id: str) -> str:
        return self.TASK_DEFINITIONS.get(lab_id, "puzzle-lab")

    def provision(self, user_id: str, lab_id: str, lab_seed: str) -> Dict[str, Any]:
        # Teardown any existing task for this user first
        self.teardown(user_id, lab_id)

        family = self._task_family(lab_id)
        logger.info(f"[ECS] Launching task family '{family}' for user {user_id} on cluster '{self.CLUSTER_NAME}'")

        if family == "puzzle-lab":
            container_overrides = [
                {
                    "name": "techcorp-sysadmin-student",
                    "environment": [
                        {"name": "STUDENT_ID", "value": str(user_id)},
                        {"name": "LAB_SEED",   "value": lab_seed},
                    ],
                }
            ]
        elif family == "command-line-lab":
            container_overrides = [
                {
                    "name": "cll-student",
                    "environment": [
                        {"name": "STUDENT_ID", "value": str(user_id)},
                        {"name": "LAB_SEED",   "value": lab_seed},
                    ],
                },
                {
                    "name": "cll-services",
                    "environment": [
                        {"name": "STUDENT_ID", "value": str(user_id)},
                        {"name": "LAB_SEED",   "value": lab_seed},
                        {"name": "STUDENT_CONTAINER", "value": "cll-student"},
                    ],
                },
            ]
        else:
            container_overrides = [
                {
                    "name": "lab1-target",
                    "environment": [
                        {"name": "STUDENT_ID", "value": str(user_id)},
                        {"name": "LAB_SEED",   "value": lab_seed},
                    ],
                },
                {
                    "name": "lab1-student",
                    "environment": [
                        {"name": "STUDENT_ID",  "value": str(user_id)},
                        {"name": "LAB_SEED",    "value": lab_seed},
                        {"name": "TARGET_IP",   "value": "10.10.0.10"},
                    ],
                },
            ]

        response = self._ecs.run_task(
            cluster=self.CLUSTER_NAME,
            taskDefinition=family,
            launchType="EC2",
            overrides={"containerOverrides": container_overrides},
            tags=[
                {"key": "managed_by",  "value": "cyberrange"},
                {"key": "lab_id",      "value": lab_id},
                {"key": "user_id",     "value": str(user_id)},
            ],
        )

        failures = response.get("failures", [])
        if failures:
            raise RuntimeError(f"ECS run_task failed: {failures}")

        task = response["tasks"][0]
        task_arn = task["taskArn"]

        # Poll status until RUNNING (max 60 seconds)
        for _ in range(20):
            time.sleep(3)
            desc = self._ecs.describe_tasks(cluster=self.CLUSTER_NAME, tasks=[task_arn])
            t = desc["tasks"][0]
            status = t.get("lastStatus")
            logger.info(f"[ECS] Task {task_arn} status: {status}")

            if status == "RUNNING":
                student_host_port = None
                ws_port = None
                progress_port = None
                container_instance_arn = t.get("containerInstanceArn")
                for c in t.get("containers", []):
                    c_name = c["name"].lower()
                    for b in c.get("networkBindings", []):
                        c_port = b.get("containerPort")
                        if c_port in (22, 2222):
                            student_host_port = b["hostPort"]
                        elif c_port == 8022:
                            ws_port = b["hostPort"]
                        elif c_port == 9500:
                            progress_port = b["hostPort"]

                ci_desc = self._ecs.describe_container_instances(
                    cluster=self.CLUSTER_NAME,
                    containerInstances=[container_instance_arn],
                )
                ec2_instance_id = ci_desc["containerInstances"][0]["ec2InstanceId"]
                ec2_desc = self._ec2.describe_instances(InstanceIds=[ec2_instance_id])
                private_ip = ec2_desc["Reservations"][0]["Instances"][0]["PrivateIpAddress"]

                logger.info(
                    f"[ECS] Provisioned session for user {user_id} | "
                    f"Task: {task_arn} | Host: {private_ip}:{student_host_port or ws_port}"
                )

                return {
                    "task_arn":              task_arn,
                    "student_container_ref": task_arn,
                    "student_host":          private_ip,
                    "student_port":          student_host_port or ws_port or 2222,
                    "ws_port":               ws_port,
                    "progress_port":         progress_port,
                    "lab_seed":              lab_seed,
                }

            if status in ("STOPPED", "DEPROVISIONING"):
                raise RuntimeError(f"ECS task stopped unexpectedly: {t.get('stoppedReason')}")

        raise TimeoutError(f"ECS task {task_arn} did not reach RUNNING in 60s")

    def teardown(self, user_id: str, lab_id: str) -> None:
        from app.lab.session_store import get_session
        session = get_session(str(user_id), lab_id)
        task_arn = session.get("task_arn") if session else None

        if task_arn:
            try:
                self._ecs.stop_task(
                    cluster=self.CLUSTER_NAME,
                    task=task_arn,
                    reason=f"Student session teardown for user {user_id}",
                )
                logger.info(f"[ECS] Stopped task {task_arn} for user {user_id}")
            except Exception as exc:
                logger.warning(f"[ECS] Error stopping task {task_arn}: {exc}")

        # Fallback sweep across all cluster tasks to clean up any matching user_id tags
        try:
            paginator = self._ecs.get_paginator("list_tasks")
            for page in paginator.paginate(cluster=self.CLUSTER_NAME):
                arns = page.get("taskArns", [])
                if not arns:
                    continue
                tasks = self._ecs.describe_tasks(cluster=self.CLUSTER_NAME, tasks=arns, include=["TAGS"])
                for task in tasks.get("tasks", []):
                    tags = {t["key"]: t["value"] for t in task.get("tags", [])}
                    if tags.get("user_id") == str(user_id) and task.get("lastStatus") != "STOPPED":
                        t_arn = task["taskArn"]
                        if t_arn != task_arn:
                            self._ecs.stop_task(
                                cluster=self.CLUSTER_NAME,
                                task=t_arn,
                                reason=f"Sweep teardown for user {user_id}",
                            )
                            logger.info(f"[ECS] Stopped task {t_arn} via sweep for user {user_id}")
        except Exception as exc:
            logger.warning(f"[ECS] Teardown sweep error for user {user_id}: {exc}")

    def is_running(self, user_id: str, lab_id: str) -> bool:
        try:
            paginator = self._ecs.get_paginator("list_tasks")
            family = self._task_family(lab_id)
            for page in paginator.paginate(cluster=self.CLUSTER_NAME, family=family):
                task_arns = page.get("taskArns", [])
                if not task_arns:
                    continue
                tasks = self._ecs.describe_tasks(cluster=self.CLUSTER_NAME, tasks=task_arns)
                for task in tasks["tasks"]:
                    tags = {t["key"]: t["value"] for t in task.get("tags", [])}
                    if tags.get("user_id") == str(user_id) and task.get("lastStatus") == "RUNNING":
                        return True
        except Exception:
            pass
        return False


# ── Factory ──────────────────────────────────────────────────────────────────

def get_orchestrator() -> LabOrchestrator:
    """
    Return configured orchestrator based on ORCHESTRATOR env var.
      ORCHESTRATOR=docker  -> DockerOrchestrator (local dev, default)
      ORCHESTRATOR=ecs     -> ECSOrchestrator (production AWS ECS)
    """
    mode = os.getenv("ORCHESTRATOR", "docker").lower()
    if mode == "ecs":
        logger.info("[Orchestrator] Selected ECSOrchestrator (AWS ECS mode)")
        return ECSOrchestrator()
    logger.info("[Orchestrator] Selected DockerOrchestrator (local Docker mode)")
    return DockerOrchestrator()
