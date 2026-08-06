from typing import Dict, Any, List, Optional
from .base import BaseModuleValidator

class Module1Validator(BaseModuleValidator):
    """
    Module 1 Outcome-Based Validator: S3 Anonymous Reconnaissance
    Outcome 1: Discover public bucket name/connection details.
    Outcome 2: Execute unauthenticated S3 listing (any command/method).
    Outcome 3: Retrieve or inspect welcome.txt object.
    Outcome 4: Discover Stage 1 flag.
    """
    def __init__(self):
        super().__init__(module_num=1)

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

        # Obj 1: Public bucket discovery or S3 endpoint interaction
        if "mod1_obj1" not in completed:
            if (
                self.contains_ignore_case(cmd_clean, "public") or
                self.contains_ignore_case(cmd_clean, "4566") or
                self.contains_ignore_case(cmd_clean, "s3") or
                self.contains_ignore_case(out_clean, "public") or
                self.contains_ignore_case(out_clean, "welcome.txt")
            ):
                completed.add("mod1_obj1")

        # Obj 2: Anonymous S3 bucket listing (s3 ls, s3api list-objects, s3 sync, etc.)
        if "mod1_obj2" not in completed:
            if (
                (self.contains_ignore_case(cmd_clean, "s3") and (
                    self.contains_ignore_case(cmd_clean, "ls") or
                    self.contains_ignore_case(cmd_clean, "list") or
                    self.contains_ignore_case(cmd_clean, "sync")
                )) or
                self.contains_ignore_case(out_clean, "welcome.txt") or
                "PRE " in out_clean or
                self.contains_ignore_case(out_clean, "system.log")
            ):
                completed.add("mod1_obj1")
                completed.add("mod1_obj2")

        # Obj 3: Retrieve welcome.txt object (s3 cp, s3api get-object, curl, cat, etc.)
        if "mod1_obj3" not in completed:
            if (
                self.contains_ignore_case(cmd_clean, "welcome.txt") or
                self.contains_ignore_case(out_clean, "Welcome to the Company Public Assets Portal") or
                self.contains_ignore_case(out_clean, "Stage 1 Flag")
            ):
                completed.add("mod1_obj1")
                completed.add("mod1_obj2")
                completed.add("mod1_obj3")

        # Obj 4: Read/discover Stage 1 flag value
        if "mod1_obj4" not in completed:
            if (
                ("FLAG{" in out_clean or "flag{" in out_clean.lower()) or
                (self.contains_ignore_case(out_clean, "Stage 1 Flag") and "techcorp" in out_clean.lower())
            ):
                completed.add("mod1_obj1")
                completed.add("mod1_obj2")
                completed.add("mod1_obj3")
                completed.add("mod1_obj4")

        return sorted(list(completed))
