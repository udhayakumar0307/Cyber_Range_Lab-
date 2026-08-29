"""async durable sysadmin grading

Revision ID: a6f4c2d9b701
Revises: e81b7d6c4f20
Create Date: 2026-08-27
"""

from typing import Sequence, Union

from alembic import op


revision: str = "a6f4c2d9b701"
down_revision: Union[str, Sequence[str], None] = "e81b7d6c4f20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.execute(
            """
            ALTER TABLE sysadmin_submissions
                ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) NULL,
                ADD COLUMN IF NOT EXISTS queue_message_id VARCHAR(128) NULL,
                ADD COLUMN IF NOT EXISTS enqueued_at TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS processing_token VARCHAR(64) NULL,
                ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS ecs_task_arn VARCHAR(500) NULL,
                ADD COLUMN IF NOT EXISTS worker_exit_code INTEGER NULL;
            """
        )
        op.execute(
            """
            UPDATE sysadmin_submissions
            SET status = CASE
                WHEN status = 'COMPLETED' AND passed IS TRUE THEN 'PASS'
                WHEN status = 'COMPLETED' AND passed IS FALSE THEN 'FAIL'
                WHEN status = 'PENDING' THEN 'QUEUED'
                ELSE status
            END,
            completed_at = CASE
                WHEN completed_at IS NULL AND graded_at IS NOT NULL THEN graded_at
                ELSE completed_at
            END;
            """
        )
        op.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_sysadmin_submissions_student_id_idempotency_key
            ON sysadmin_submissions (student_id, idempotency_key);
            """
        )
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_sysadmin_submissions_enqueued_at
            ON sysadmin_submissions (enqueued_at);
            CREATE INDEX IF NOT EXISTS ix_sysadmin_submissions_lease_expires_at
            ON sysadmin_submissions (lease_expires_at);
            """
        )
        return

    # SQLite is used by local/test setups. ALTER TABLE ADD COLUMN is sufficient;
    # the idempotency guarantee is enforced with a unique index.
    existing = {
        row[1] for row in bind.exec_driver_sql("PRAGMA table_info(sysadmin_submissions)").fetchall()
    }
    columns = {
        "idempotency_key": "VARCHAR(64) NULL",
        "queue_message_id": "VARCHAR(128) NULL",
        "enqueued_at": "DATETIME NULL",
        "attempt_count": "INTEGER NOT NULL DEFAULT 0",
        "processing_token": "VARCHAR(64) NULL",
        "lease_expires_at": "DATETIME NULL",
        "started_at": "DATETIME NULL",
        "completed_at": "DATETIME NULL",
        "ecs_task_arn": "VARCHAR(500) NULL",
        "worker_exit_code": "INTEGER NULL",
    }
    for name, definition in columns.items():
        if name not in existing:
            op.execute(f"ALTER TABLE sysadmin_submissions ADD COLUMN {name} {definition}")

    op.execute(
        """
        UPDATE sysadmin_submissions
        SET status = CASE
            WHEN status = 'COMPLETED' AND passed = 1 THEN 'PASS'
            WHEN status = 'COMPLETED' AND passed = 0 THEN 'FAIL'
            WHEN status = 'PENDING' THEN 'QUEUED'
            ELSE status
        END,
        completed_at = CASE
            WHEN completed_at IS NULL AND graded_at IS NOT NULL THEN graded_at
            ELSE completed_at
        END;
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_sysadmin_submissions_student_id_idempotency_key "
        "ON sysadmin_submissions (student_id, idempotency_key)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sysadmin_submissions_enqueued_at "
        "ON sysadmin_submissions (enqueued_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sysadmin_submissions_lease_expires_at "
        "ON sysadmin_submissions (lease_expires_at)"
    )


def downgrade() -> None:
    # This migration is intentionally conservative in downgrade. Dropping the
    # added columns is safe on PostgreSQL; SQLite deployments should restore from
    # backup rather than rewrite a live submission table.
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("DROP INDEX IF EXISTS ix_sysadmin_submissions_lease_expires_at")
    op.execute("DROP INDEX IF EXISTS ix_sysadmin_submissions_enqueued_at")
    op.execute("DROP INDEX IF EXISTS uq_sysadmin_submissions_student_id_idempotency_key")
    op.execute(
        """
        ALTER TABLE sysadmin_submissions
            DROP COLUMN IF EXISTS worker_exit_code,
            DROP COLUMN IF EXISTS ecs_task_arn,
            DROP COLUMN IF EXISTS completed_at,
            DROP COLUMN IF EXISTS started_at,
            DROP COLUMN IF EXISTS lease_expires_at,
            DROP COLUMN IF EXISTS processing_token,
            DROP COLUMN IF EXISTS attempt_count,
            DROP COLUMN IF EXISTS enqueued_at,
            DROP COLUMN IF EXISTS queue_message_id,
            DROP COLUMN IF EXISTS idempotency_key;
        """
    )
