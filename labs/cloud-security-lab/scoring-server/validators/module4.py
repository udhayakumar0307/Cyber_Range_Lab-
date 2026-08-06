from typing import Dict, Any, List, Optional
from .base import BaseModuleValidator

class Module4Validator(BaseModuleValidator):
    """
    Module 4 Outcome-Based Validator: Cloud Privilege Escalation
    Outcome 1: List IAM user policies.
    Outcome 2: Inspect DeveloperInitialPolicy / PutUserPolicy.
    Outcome 3: Attach AdminPolicy or wildcard inline policy to developer user.
    Outcome 4: Retrieve flag4.txt from restricted S3 bucket.
    """
    def __init__(self):
        super().__init__(module_num=4)

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

        # Obj 1: List user policies
        if "mod4_obj1" not in completed:
            if (
                self.contains_ignore_case(cmd_clean, "iam") and (
                    self.contains_ignore_case(cmd_clean, "list") or
                    self.contains_ignore_case(cmd_clean, "policies")
                ) or
                self.contains_ignore_case(out_clean, "DeveloperInitialPolicy") or
                self.contains_ignore_case(out_clean, "PolicyNames")
            ):
                completed.add("mod4_obj1")

        # Obj 2: Get user policy / identify iam:PutUserPolicy
        if "mod4_obj2" not in completed:
            if (
                self.contains_ignore_case(cmd_clean, "get-user-policy") or
                self.contains_ignore_case(out_clean, "iam:PutUserPolicy") or
                self.contains_ignore_case(out_clean, "DeveloperInitialPolicy")
            ):
                completed.add("mod4_obj1")
                completed.add("mod4_obj2")

        # Obj 3: Attach AdminPolicy / PutUserPolicy with wildcard Action "*"
        if "mod4_obj3" not in completed:
            if (
                (self.contains_ignore_case(cmd_clean, "put-user-policy") or
                 self.contains_ignore_case(cmd_clean, "attach-user-policy")) or
                "AdminPolicy" in cmd_clean or
                '"Action": "*"' in cmd_clean or
                "Action" in cmd_clean and "*" in cmd_clean or
                self.contains_ignore_case(out_clean, "PrivEsc detected")
            ):
                completed.add("mod4_obj1")
                completed.add("mod4_obj2")
                completed.add("mod4_obj3")

        # Obj 4: Read flag4.txt from restricted S3 bucket
        if "mod4_obj4" not in completed:
            if (
                self.contains_ignore_case(cmd_clean, "flag4.txt") or
                self.contains_ignore_case(out_clean, "Stage 4 Flag") or
                ("FLAG{" in out_clean and "escalated" in out_clean.lower())
            ):
                completed.add("mod4_obj1")
                completed.add("mod4_obj2")
                completed.add("mod4_obj3")
                completed.add("mod4_obj4")

        return sorted(list(completed))
