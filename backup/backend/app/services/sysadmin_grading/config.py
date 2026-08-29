from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from ipaddress import ip_address, ip_network
from pathlib import Path
from urllib.parse import urlparse


class GradingConfigurationError(RuntimeError):
    """Raised when the Sysadmin grading integration is not configured safely."""


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


_RFC1918_NETWORKS = (
    ip_network("10.0.0.0/8"),
    ip_network("172.16.0.0/12"),
    ip_network("192.168.0.0/16"),
)


def _is_rfc1918_http_origin(value: str) -> bool:
    """
    Permit plaintext workspace submission traffic only when the production
    API base is a literal RFC1918 IPv4 origin inside the private VPC.

    Public HTTP origins and hostname-based HTTP origins remain forbidden.
    """
    try:
        parsed = urlparse(value)
    except ValueError:
        return False

    if parsed.scheme != "http" or not parsed.hostname:
        return False

    # API base must be an origin, not a URL containing credentials,
    # query parameters, fragments, or application paths.
    if (
        parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
    ):
        return False

    try:
        address = ip_address(parsed.hostname)
    except ValueError:
        return False

    if address.version != 4:
        return False

    return any(address in network for network in _RFC1918_NETWORKS)


@dataclass(frozen=True)
class SysadminGradingSettings:
    enabled: bool
    question_bank_root: Path
    python_bin: str
    execution_timeout_seconds: int
    max_submission_bytes: int
    workspace_token_ttl_minutes: int = 120
    allow_user_workspace_token_minting: bool = False
    healthcheck_image: str = "cyberrange/rhsa-base:0.3"

    # Executor selection. Local Docker is development-only; ECS is the
    # production isolation boundary for untrusted student Bash.
    executor: str = "local"

    # ECS/S3 remote-worker configuration.
    aws_region: str = ""
    ecs_cluster: str = ""
    ecs_task_definition: str = ""
    ecs_capacity_provider: str = ""
    ecs_container_name: str = "rhsa-grading-worker"
    ecs_task_timeout_seconds: int = 600
    ecs_poll_interval_seconds: float = 2.0
    s3_bucket: str = ""
    s3_prefix: str = "sysadmin-grading"
    s3_url_ttl_seconds: int = 900
    s3_cleanup: bool = True

    # v0.6 durable async grading queue. The database stores authoritative
    # submission state; SQS carries only the submission identifier.
    grading_queue_url: str = ""
    grading_queue_wait_seconds: int = 20
    grading_queue_visibility_seconds: int = 900
    grading_queue_retry_visibility_seconds: int = 60
    grading_queue_max_receives: int = 3

    # Student workspace configuration. Production workspaces run on a separate
    # Fargate cluster and never share the trusted grading host.
    workspace_enabled: bool = False
    workspace_ecs_cluster: str = ""
    workspace_task_definition: str = ""
    workspace_container_name: str = "rhsa-workspace"
    workspace_subnet_ids: tuple[str, ...] = ()
    workspace_security_group_ids: tuple[str, ...] = ()
    workspace_assign_public_ip: bool = True
    workspace_api_base: str = ""
    workspace_start_timeout_seconds: int = 180
    workspace_poll_interval_seconds: float = 3.0
    marketplace_lab_id: str = "linux-sysadmin-lab"
    workspace_require_marketplace_access: bool = False

    @classmethod
    def from_env(cls) -> "SysadminGradingSettings":
        root_raw = os.getenv("SYSADMIN_QUESTION_BANK_ROOT", "").strip()
        root = Path(root_raw).expanduser().resolve() if root_raw else Path("/")

        configured_python = os.getenv("SYSADMIN_GRADER_PYTHON", "").strip()
        if configured_python:
            python_bin = str(Path(configured_python).expanduser())
        elif root_raw and (root / ".venv" / "bin" / "python").exists():
            python_bin = str(root / ".venv" / "bin" / "python")
        else:
            python_bin = "python3"

        enabled = _env_bool("SYSADMIN_GRADING_ENABLED", False)
        timeout = int(os.getenv("SYSADMIN_GRADING_TIMEOUT_SECONDS", "120"))
        max_bytes = int(os.getenv("SYSADMIN_GRADING_MAX_SUBMISSION_BYTES", "65536"))
        workspace_ttl = int(os.getenv("SYSADMIN_WORKSPACE_TOKEN_TTL_MINUTES", "120"))
        healthcheck_image = os.getenv(
            "SYSADMIN_GRADING_HEALTHCHECK_IMAGE", "cyberrange/rhsa-base:0.3"
        ).strip()

        executor = os.getenv("SYSADMIN_GRADING_EXECUTOR", "local").strip().lower()
        aws_region = os.getenv("SYSADMIN_GRADING_AWS_REGION", "").strip()
        ecs_cluster = os.getenv("SYSADMIN_GRADING_ECS_CLUSTER", "").strip()
        ecs_task_definition = os.getenv(
            "SYSADMIN_GRADING_ECS_TASK_DEFINITION", ""
        ).strip()
        ecs_capacity_provider = os.getenv(
            "SYSADMIN_GRADING_ECS_CAPACITY_PROVIDER", ""
        ).strip()
        ecs_container_name = os.getenv(
            "SYSADMIN_GRADING_ECS_CONTAINER_NAME", "rhsa-grading-worker"
        ).strip()
        ecs_task_timeout = int(
            os.getenv("SYSADMIN_GRADING_ECS_TASK_TIMEOUT_SECONDS", "600")
        )
        ecs_poll_interval = float(
            os.getenv("SYSADMIN_GRADING_ECS_POLL_INTERVAL_SECONDS", "2")
        )
        s3_bucket = os.getenv("SYSADMIN_GRADING_S3_BUCKET", "").strip()
        s3_prefix = os.getenv("SYSADMIN_GRADING_S3_PREFIX", "sysadmin-grading").strip("/")
        s3_url_ttl = int(os.getenv("SYSADMIN_GRADING_S3_URL_TTL_SECONDS", "900"))
        grading_queue_url = os.getenv("SYSADMIN_GRADING_QUEUE_URL", "").strip()
        grading_queue_wait_seconds = int(
            os.getenv("SYSADMIN_GRADING_QUEUE_WAIT_SECONDS", "20")
        )
        grading_queue_visibility_seconds = int(
            os.getenv("SYSADMIN_GRADING_QUEUE_VISIBILITY_SECONDS", "900")
        )
        grading_queue_retry_visibility_seconds = int(
            os.getenv("SYSADMIN_GRADING_QUEUE_RETRY_VISIBILITY_SECONDS", "60")
        )
        grading_queue_max_receives = int(
            os.getenv("SYSADMIN_GRADING_QUEUE_MAX_RECEIVES", "3")
        )

        workspace_enabled = _env_bool("SYSADMIN_WORKSPACE_ENABLED", False)
        workspace_ecs_cluster = os.getenv(
            "SYSADMIN_WORKSPACE_ECS_CLUSTER", "cyberrange-sysadmin-workspaces"
        ).strip()
        workspace_task_definition = os.getenv(
            "SYSADMIN_WORKSPACE_ECS_TASK_DEFINITION", ""
        ).strip()
        workspace_container_name = os.getenv(
            "SYSADMIN_WORKSPACE_ECS_CONTAINER_NAME", "rhsa-workspace"
        ).strip()
        workspace_subnet_ids = tuple(
            value.strip()
            for value in os.getenv("SYSADMIN_WORKSPACE_SUBNET_IDS", "").split(",")
            if value.strip()
        )
        workspace_security_group_ids = tuple(
            value.strip()
            for value in os.getenv("SYSADMIN_WORKSPACE_SECURITY_GROUP_IDS", "").split(",")
            if value.strip()
        )
        workspace_assign_public_ip = _env_bool(
            "SYSADMIN_WORKSPACE_ASSIGN_PUBLIC_IP", True
        )
        workspace_api_base = os.getenv("SYSADMIN_WORKSPACE_API_BASE", "").strip().rstrip("/")
        workspace_start_timeout = int(
            os.getenv("SYSADMIN_WORKSPACE_START_TIMEOUT_SECONDS", "180")
        )
        workspace_poll_interval = float(
            os.getenv("SYSADMIN_WORKSPACE_POLL_INTERVAL_SECONDS", "3")
        )
        marketplace_lab_id = os.getenv(
            "SYSADMIN_MARKETPLACE_LAB_ID", "linux-sysadmin-lab"
        ).strip()
        production_default = os.getenv("ENV", "development").strip().lower() == "production"
        workspace_require_marketplace_access = _env_bool(
            "SYSADMIN_WORKSPACE_REQUIRE_MARKETPLACE_ACCESS", production_default
        )

        if timeout < 10 or timeout > 600:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_TIMEOUT_SECONDS must be between 10 and 600 seconds."
            )
        if workspace_ttl < 5 or workspace_ttl > 240:
            raise GradingConfigurationError(
                "SYSADMIN_WORKSPACE_TOKEN_TTL_MINUTES must be between 5 and 240 minutes."
            )
        if not healthcheck_image:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_HEALTHCHECK_IMAGE cannot be empty."
            )
        if max_bytes < 1024 or max_bytes > 1024 * 1024:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_MAX_SUBMISSION_BYTES must be between 1024 and 1048576 bytes."
            )
        if executor not in {"local", "ecs"}:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_EXECUTOR must be either 'local' or 'ecs'."
            )
        if ecs_task_timeout < 60 or ecs_task_timeout > 1800:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_ECS_TASK_TIMEOUT_SECONDS must be between 60 and 1800 seconds."
            )
        if ecs_poll_interval < 0.5 or ecs_poll_interval > 30:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_ECS_POLL_INTERVAL_SECONDS must be between 0.5 and 30 seconds."
            )
        if s3_url_ttl < 300 or s3_url_ttl > 3600:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_S3_URL_TTL_SECONDS must be between 300 and 3600 seconds."
            )
        if grading_queue_wait_seconds < 0 or grading_queue_wait_seconds > 20:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_QUEUE_WAIT_SECONDS must be between 0 and 20 seconds."
            )
        if grading_queue_visibility_seconds < 60 or grading_queue_visibility_seconds > 43200:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_QUEUE_VISIBILITY_SECONDS must be between 60 and 43200 seconds."
            )
        if (
            grading_queue_retry_visibility_seconds < 0
            or grading_queue_retry_visibility_seconds > grading_queue_visibility_seconds
        ):
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_QUEUE_RETRY_VISIBILITY_SECONDS must be between 0 and the queue visibility timeout."
            )
        if grading_queue_max_receives < 1 or grading_queue_max_receives > 20:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_QUEUE_MAX_RECEIVES must be between 1 and 20."
            )
        if workspace_start_timeout < 30 or workspace_start_timeout > 600:
            raise GradingConfigurationError(
                "SYSADMIN_WORKSPACE_START_TIMEOUT_SECONDS must be between 30 and 600 seconds."
            )
        if workspace_poll_interval < 0.5 or workspace_poll_interval > 30:
            raise GradingConfigurationError(
                "SYSADMIN_WORKSPACE_POLL_INTERVAL_SECONDS must be between 0.5 and 30 seconds."
            )
        if not marketplace_lab_id:
            raise GradingConfigurationError("SYSADMIN_MARKETPLACE_LAB_ID cannot be empty.")

        return cls(
            enabled=enabled,
            question_bank_root=root,
            python_bin=python_bin,
            execution_timeout_seconds=timeout,
            max_submission_bytes=max_bytes,
            workspace_token_ttl_minutes=workspace_ttl,
            allow_user_workspace_token_minting=_env_bool(
                "SYSADMIN_ALLOW_USER_WORKSPACE_TOKEN_MINTING", False
            ),
            healthcheck_image=healthcheck_image,
            executor=executor,
            aws_region=aws_region,
            ecs_cluster=ecs_cluster,
            ecs_task_definition=ecs_task_definition,
            ecs_capacity_provider=ecs_capacity_provider,
            ecs_container_name=ecs_container_name,
            ecs_task_timeout_seconds=ecs_task_timeout,
            ecs_poll_interval_seconds=ecs_poll_interval,
            s3_bucket=s3_bucket,
            s3_prefix=s3_prefix or "sysadmin-grading",
            s3_url_ttl_seconds=s3_url_ttl,
            s3_cleanup=_env_bool("SYSADMIN_GRADING_S3_CLEANUP", True),
            grading_queue_url=grading_queue_url,
            grading_queue_wait_seconds=grading_queue_wait_seconds,
            grading_queue_visibility_seconds=grading_queue_visibility_seconds,
            grading_queue_retry_visibility_seconds=grading_queue_retry_visibility_seconds,
            grading_queue_max_receives=grading_queue_max_receives,
            workspace_enabled=workspace_enabled,
            workspace_ecs_cluster=workspace_ecs_cluster,
            workspace_task_definition=workspace_task_definition,
            workspace_container_name=workspace_container_name,
            workspace_subnet_ids=workspace_subnet_ids,
            workspace_security_group_ids=workspace_security_group_ids,
            workspace_assign_public_ip=workspace_assign_public_ip,
            workspace_api_base=workspace_api_base,
            workspace_start_timeout_seconds=workspace_start_timeout,
            workspace_poll_interval_seconds=workspace_poll_interval,
            marketplace_lab_id=marketplace_lab_id,
            workspace_require_marketplace_access=workspace_require_marketplace_access,
        )

    def assert_ready(self) -> None:
        if not self.enabled:
            raise GradingConfigurationError(
                "Linux Sysadmin grading is disabled. Set SYSADMIN_GRADING_ENABLED=true."
            )

        if str(self.question_bank_root) == "/":
            raise GradingConfigurationError("SYSADMIN_QUESTION_BANK_ROOT is not configured.")
        if not self.question_bank_root.is_dir():
            raise GradingConfigurationError(
                f"Question-bank directory does not exist: {self.question_bank_root}"
            )
        if not (self.question_bank_root / "labs").is_dir():
            raise GradingConfigurationError(
                f"Question-bank labs directory does not exist: {self.question_bank_root / 'labs'}"
            )

        environment = os.getenv("ENV", "development").strip().lower()
        if environment == "production" and self.executor != "ecs":
            raise GradingConfigurationError(
                "Production Sysadmin grading must use SYSADMIN_GRADING_EXECUTOR=ecs; "
                "LocalDockerExecutor is development-only."
            )

        if self.executor == "local":
            self._assert_local_ready()
        elif self.executor == "ecs":
            self._assert_ecs_configured()
        else:  # defensive for manually constructed settings objects
            raise GradingConfigurationError(
                f"Unsupported Sysadmin grading executor: {self.executor!r}"
            )

    def _assert_local_ready(self) -> None:
        runner = self.question_bank_root / "grader" / "runner.py"
        if not runner.is_file():
            raise GradingConfigurationError(f"Question-bank runner was not found: {runner}")

        if os.path.sep in self.python_bin:
            python_path = Path(self.python_bin).expanduser()
            if not python_path.is_file():
                raise GradingConfigurationError(
                    f"Configured grader Python does not exist: {python_path}"
                )
            if not os.access(python_path, os.X_OK):
                raise GradingConfigurationError(
                    f"Configured grader Python is not executable: {python_path}"
                )
        elif not shutil.which(self.python_bin):
            raise GradingConfigurationError(
                f"Configured grader Python is not on PATH: {self.python_bin}"
            )

        docker = shutil.which("docker")
        if not docker:
            raise GradingConfigurationError("Docker CLI is not available to the backend process.")
        try:
            info = subprocess.run(
                [docker, "info"],
                text=True,
                capture_output=True,
                timeout=5,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise GradingConfigurationError(
                f"Docker daemon readiness check failed: {exc}"
            ) from exc
        if info.returncode != 0:
            detail = (info.stderr or info.stdout or "unknown Docker error").strip()[-1000:]
            raise GradingConfigurationError(f"Docker daemon is not ready: {detail}")

        try:
            image = subprocess.run(
                [docker, "image", "inspect", self.healthcheck_image],
                text=True,
                capture_output=True,
                timeout=5,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise GradingConfigurationError(
                f"Docker image readiness check failed: {exc}"
            ) from exc
        if image.returncode != 0:
            raise GradingConfigurationError(
                f"Required local grading image is missing: {self.healthcheck_image}"
            )

    def _assert_ecs_configured(self) -> None:
        required = {
            "SYSADMIN_GRADING_AWS_REGION": self.aws_region,
            "SYSADMIN_GRADING_ECS_CLUSTER": self.ecs_cluster,
            "SYSADMIN_GRADING_ECS_TASK_DEFINITION": self.ecs_task_definition,
            "SYSADMIN_GRADING_ECS_CAPACITY_PROVIDER": self.ecs_capacity_provider,
            "SYSADMIN_GRADING_ECS_CONTAINER_NAME": self.ecs_container_name,
            "SYSADMIN_GRADING_S3_BUCKET": self.s3_bucket,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise GradingConfigurationError(
                "ECS grading configuration is incomplete; missing: " + ", ".join(missing)
            )
        if self.s3_url_ttl_seconds < self.ecs_task_timeout_seconds + 60:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_S3_URL_TTL_SECONDS must be at least 60 seconds longer than "
                "SYSADMIN_GRADING_ECS_TASK_TIMEOUT_SECONDS."
            )

    def assert_queue_ready(self) -> None:
        """Validate the durable SQS transport without weakening grader checks."""
        self.assert_ready()
        if not self.grading_queue_url:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_QUEUE_URL is required for asynchronous Sysadmin grading."
            )
        if not self.grading_queue_url.startswith("https://sqs."):
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_QUEUE_URL must be an HTTPS Amazon SQS queue URL."
            )

    def assert_workspace_ready(self) -> None:
        """Validate the student-facing Fargate workspace configuration."""
        if not self.workspace_enabled:
            raise GradingConfigurationError(
                "Linux Sysadmin workspaces are disabled. Set SYSADMIN_WORKSPACE_ENABLED=true."
            )
        # Workspace submissions ultimately use the grader, so require the
        # grading side to be healthy as well.
        self.assert_ready()

        required = {
            "SYSADMIN_GRADING_AWS_REGION": self.aws_region,
            "SYSADMIN_WORKSPACE_ECS_CLUSTER": self.workspace_ecs_cluster,
            "SYSADMIN_WORKSPACE_ECS_TASK_DEFINITION": self.workspace_task_definition,
            "SYSADMIN_WORKSPACE_ECS_CONTAINER_NAME": self.workspace_container_name,
            "SYSADMIN_WORKSPACE_SUBNET_IDS": ",".join(self.workspace_subnet_ids),
            "SYSADMIN_WORKSPACE_SECURITY_GROUP_IDS": ",".join(self.workspace_security_group_ids),
            "SYSADMIN_WORKSPACE_API_BASE": self.workspace_api_base,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise GradingConfigurationError(
                "Sysadmin workspace configuration is incomplete; missing: " + ", ".join(missing)
            )

        environment = os.getenv("ENV", "development").strip().lower()

        api_base_is_safe = (
            self.workspace_api_base.startswith("https://")
            or (
                environment != "production"
                and self.workspace_api_base.startswith("http://")
            )
            or (
                environment == "production"
                and _is_rfc1918_http_origin(self.workspace_api_base)
            )
        )

        if not api_base_is_safe:
            raise GradingConfigurationError(
                "SYSADMIN_WORKSPACE_API_BASE must use HTTPS in production "
                "unless it targets a literal RFC1918 private IPv4 origin."
            )
