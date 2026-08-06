from typing import Dict, Any, List, Optional
from .base import BaseModuleValidator

class Module5Validator(BaseModuleValidator):
    """
    Module 5 Outcome-Based Validator: Corporate Secrets Infiltration
    Outcome 1: List stored secrets in AWS Secrets Manager.
    Outcome 2: Locate secret ID company/final/flag.
    Outcome 3: Execute get-secret-value request.
    Outcome 4: Retrieve final master flag value.
    """
    def __init__(self):
        super().__init__(module_num=5)

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

        # Obj 1: List secrets in Secrets Manager
        if "mod5_obj1" not in completed:
            if (
                self.contains_ignore_case(cmd_clean, "secretsmanager") or
                self.contains_ignore_case(cmd_clean, "list-secrets") or
                self.contains_ignore_case(out_clean, "SecretList") or
                self.contains_ignore_case(out_clean, "company/final/flag")
            ):
                completed.add("mod5_obj1")

        # Obj 2: Locate secret ID company/final/flag
        if "mod5_obj2" not in completed:
            if (
                self.contains_ignore_case(cmd_clean, "company/final/flag") or
                self.contains_ignore_case(out_clean, "company/final/flag") or
                self.contains_ignore_case(out_clean, "SecretList")
            ):
                completed.add("mod5_obj1")
                completed.add("mod5_obj2")

        # Obj 3: Execute get-secret-value API call
        if "mod5_obj3" not in completed:
            if (
                self.contains_ignore_case(cmd_clean, "get-secret-value") or
                self.contains_ignore_case(out_clean, "SecretString") or
                self.contains_ignore_case(out_clean, "flag5")
            ):
                completed.add("mod5_obj1")
                completed.add("mod5_obj2")
                completed.add("mod5_obj3")

        # Obj 4: Extract master flag value
        if "mod5_obj4" not in completed:
            if (
                ("FLAG{" in out_clean or "flag{" in out_clean.lower()) and (
                    "flag5" in out_clean.lower() or "master" in out_clean.lower() or "techcorp" in out_clean.lower()
                ) or
                self.contains_ignore_case(out_clean, "SecretString")
            ):
                completed.add("mod5_obj1")
                completed.add("mod5_obj2")
                completed.add("mod5_obj3")
                completed.add("mod5_obj4")

        return sorted(list(completed))
