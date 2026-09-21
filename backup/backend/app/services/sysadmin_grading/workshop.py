"""Workshop identity shared by access checks, grading, and reporting."""
from dataclasses import replace
import os
WORKSHOP_ID = "linux-security-workshop"

def settings_for_lab(settings, lab_id):
    if str(lab_id).startswith("WS-"):
        return replace(settings, marketplace_lab_id=WORKSHOP_ID,
                       workspace_task_definition=os.getenv("WORKSHOP_WORKSPACE_TASK_DEFINITION", "").strip())
    return settings
