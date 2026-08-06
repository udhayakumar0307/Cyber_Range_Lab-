import logging
from typing import Dict, Any, List, Optional
from .module1 import Module1Validator
from .module2 import Module2Validator
from .module3 import Module3Validator
from .module4 import Module4Validator
from .module5 import Module5Validator

logger = logging.getLogger(__name__)

VALIDATORS = {
    1: Module1Validator(),
    2: Module2Validator(),
    3: Module3Validator(),
    4: Module4Validator(),
    5: Module5Validator(),
}

def evaluate_action(
    module_num: int,
    command: str,
    output: str,
    student_id: str,
    current_completed: List[str],
    container: Optional[Any] = None
) -> List[str]:
    """
    Unified entry point for outcome-based objective evaluation.
    """
    validator = VALIDATORS.get(module_num)
    if not validator:
        return current_completed

    try:
        return validator.evaluate_objectives(
            command=command,
            output=output,
            student_id=student_id,
            current_completed=current_completed,
            container=container
        )
    except Exception as e:
        logger.error(f"Error in module {module_num} validator: {e}")
        return current_completed
