import unittest

from app.models.sysadmin_submission import SysadminSubmission
from app.services.sysadmin_grading.workspace_tokens import (
    create_workspace_submission_token,
    decode_workspace_submission_token,
)


class SysadminAssignmentProvenanceTests(unittest.TestCase):
    def test_workspace_token_round_trip_preserves_assignment(self):
        token, _ = create_workspace_submission_token(
            user_id=42,
            lab_id="TUPE-C03-006",
            workspace_id="ws-assignment-test",
            ttl_minutes=30,
            assignment_id=112,
        )

        claims = decode_workspace_submission_token(token)

        self.assertEqual(claims.user_id, 42)
        self.assertEqual(claims.lab_id, "TUPE-C03-006")
        self.assertEqual(claims.workspace_id, "ws-assignment-test")
        self.assertEqual(claims.assignment_id, 112)

    def test_legacy_workspace_token_without_assignment_still_decodes(self):
        token, _ = create_workspace_submission_token(
            user_id=42,
            lab_id="TUPE-C03-006",
            workspace_id="ws-legacy-test",
            ttl_minutes=30,
        )

        claims = decode_workspace_submission_token(token)

        self.assertIsNone(claims.assignment_id)

    def test_submission_model_carries_assignment_provenance(self):
        row = SysadminSubmission(
            student_id=42,
            assignment_id=112,
            lab_id="TUPE-C03-006",
            filename="answer.sh",
            submission_content="echo ok\n",
            submission_sha256="0" * 64,
            seed=123,
            status="QUEUED",
        )

        self.assertEqual(row.assignment_id, 112)


if __name__ == "__main__":
    unittest.main()
