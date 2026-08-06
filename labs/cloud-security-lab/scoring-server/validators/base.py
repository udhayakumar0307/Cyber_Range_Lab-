import os
import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class BaseModuleValidator:
    """
    Base class for outcome-based module validators.
    Evaluates whether student actions, container state, LocalStack resources,
    or command outputs satisfy objective criteria regardless of exact command syntax.
    """
    def __init__(self, module_num: int):
        self.module_num = module_num

    def evaluate_objectives(
        self,
        command: str,
        output: str,
        student_id: str,
        current_completed: List[str],
        container: Optional[Any] = None,
        localstack_endpoint: str = "http://10.20.0.10:4566"
    ) -> List[str]:
        """
        Evaluates active objectives for the module and returns the updated list of completed objective IDs.
        """
        raise NotImplementedError("Subclasses must implement evaluate_objectives")

    @staticmethod
    def contains_ignore_case(source: str, target: str) -> bool:
        return target.lower() in source.lower()

    @staticmethod
    def match_regex(source: str, pattern: str) -> bool:
        return bool(re.search(pattern, source, re.IGNORECASE))
