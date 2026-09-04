"""sysadmin assignment provenance

Revision ID: c3e8f2a1d904
Revises: a6f4c2d9b701
Create Date: 2026-09-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3e8f2a1d904"
down_revision: Union[str, Sequence[str], None] = "a6f4c2d9b701"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {
        column["name"]
        for column in inspector.get_columns("sysadmin_submissions")
    }

    if "assignment_id" not in columns:
        if bind.dialect.name == "postgresql":
            op.execute(
                """
                ALTER TABLE sysadmin_submissions
                ADD COLUMN assignment_id INTEGER NULL
                REFERENCES assignments(id) ON DELETE SET NULL
                """
            )
        else:
            # Development/test SQLite: preserve the nullable provenance column.
            # The production PostgreSQL migration carries the FK constraint.
            op.execute(
                """
                ALTER TABLE sysadmin_submissions
                ADD COLUMN assignment_id INTEGER NULL
                """
            )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_sysadmin_submissions_assignment_id
        ON sysadmin_submissions (assignment_id)
        """
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.execute(
        "DROP INDEX IF EXISTS ix_sysadmin_submissions_assignment_id"
    )

    if bind.dialect.name == "postgresql":
        op.execute(
            """
            ALTER TABLE sysadmin_submissions
            DROP COLUMN IF EXISTS assignment_id
            """
        )
    else:
        op.execute(
            """
            ALTER TABLE sysadmin_submissions
            DROP COLUMN assignment_id
            """
        )
