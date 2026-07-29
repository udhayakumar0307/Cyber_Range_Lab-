from typing import Dict, Any, List, Optional
from .base import BaseModuleValidator

class Module3Validator(BaseModuleValidator):
    """
    Module 3 Outcome-Based Validator: Cloud Resource Enumeration
    Outcome 1: Configure/export developer AWS credentials in shell.
    Outcome 2: List serverless Lambda functions.
    Outcome 3: Get configuration for EnumerateResources function.
    Outcome 4: Extract Stage 3 flag from environment variables.
    """
    def __init__(self):
        super().__init__(module_num=3)

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

        has_error = (
            "404" in out_clean or
            "accessdenied" in out_clean.lower() or
            "error" in out_clean.lower() and "stage" not in out_clean.lower()
        )

        # Obj 1: Export credentials or configure CLI
        if "mod3_obj1" not in completed:
            if (
                self.contains_ignore_case(cmd_clean, "export") or
                "saved to session" in out_clean.lower() or
                ("AWS_ACCESS_KEY_ID" in cmd_clean and "=" in cmd_clean)
            ):
                completed.add("mod3_obj1")

        # Obj 2: List Lambda functions showing EnumerateResources
        if "mod3_obj2" not in completed:
            if ("EnumerateResources" in out_clean or "FunctionArn" in out_clean) and not has_error:
                completed.add("mod3_obj1")
                completed.add("mod3_obj2")

        # Obj 3: Get function configuration for EnumerateResources
        if "mod3_obj3" not in completed:
            if ("Environment" in out_clean or "Variables" in out_clean or "STAGE3_FLAG" in out_clean) and not has_error:
                completed.add("mod3_obj1")
                completed.add("mod3_obj2")
                completed.add("mod3_obj3")

        # Obj 4: Extract Stage 3 flag
        if "mod3_obj4" not in completed:
            if ("FLAG{" in out_clean or "flag{" in out_clean.lower()) and ("mod3" in out_clean.lower() or "stage 3" in out_clean.lower() or "techcorp" in out_clean.lower()) and not has_error:
                completed.add("mod3_obj1")
                completed.add("mod3_obj2")
                completed.add("mod3_obj3")
                completed.add("mod3_obj4")

        return sorted(list(completed))
