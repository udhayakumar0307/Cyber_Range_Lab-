from typing import Dict, Any, List, Optional
from .base import BaseModuleValidator

class Module2Validator(BaseModuleValidator):
    """
    Module 2 Outcome-Based Validator: Credential Theft & Log Analysis
    Outcome 1: List S3 bucket showing system.log.
    Outcome 2: Download system.log into local filesystem.
    Outcome 3: Extract AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY.
    Outcome 4: Decode ROT13 obfuscated Stage 2 flag.
    """
    def __init__(self):
        super().__init__(module_num=2)

    def evaluate_objectives(
        self,
        command: str,
        output: str,
        student_id: str,
        current_completed: List[str],
        container: Optional[Any] = None,
        localstack_endpoint: str = "http://10.20.0.10:4566"
    ) -> List[str]:
        completed = set(current_completed)
        cmd_clean = command.strip()
        out_clean = output.strip()

        # Output error check (e.g. 404, No such file, NoSuchKey, AccessDenied)
        has_error = (
            "404" in out_clean or
            "nosuchkey" in out_clean.lower() or
            "does not exist" in out_clean.lower() or
            "no such file" in out_clean.lower() or
            "accessdenied" in out_clean.lower()
        )

        # Obj 1: List S3 bucket containing system.log
        if "mod2_obj1" not in completed:
            if "system.log" in out_clean and not has_error:
                completed.add("mod2_obj1")

        # Obj 2: Download system.log into local workspace
        if "mod2_obj2" not in completed:
            download_success = False
            if container is not None:
                try:
                    res = container.exec_run(["test", "-f", "/root/system.log"])
                    if res.exit_code == 0:
                        download_success = True
                except Exception:
                    pass
            if not download_success:
                if ("download:" in out_clean or "downloaded" in out_clean.lower() or ("system.log" in out_clean and "welcome.txt" in out_clean)) and not has_error:
                    if "cp" in cmd_clean or "get-object" in cmd_clean or "sync" in cmd_clean:
                        download_success = True

            if download_success:
                completed.add("mod2_obj1")
                completed.add("mod2_obj2")

        # Obj 3: Extract AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY credentials from system.log
        if "mod2_obj3" not in completed:
            if ("AWS_ACCESS_KEY_ID" in out_clean and "AWS_SECRET_ACCESS_KEY" in out_clean) and not has_error:
                completed.add("mod2_obj1")
                completed.add("mod2_obj2")
                completed.add("mod2_obj3")

        # Obj 4: Decode ROT13 Stage 2 flag
        if "mod2_obj4" not in completed:
            if ("FLAG{" in out_clean or "flag{" in out_clean.lower()) and ("mod2" in out_clean.lower() or "stage 2" in out_clean.lower() or "techcorp" in out_clean.lower()) and not has_error:
                completed.add("mod2_obj1")
                completed.add("mod2_obj2")
                completed.add("mod2_obj3")
                completed.add("mod2_obj4")

        return sorted(list(completed))
