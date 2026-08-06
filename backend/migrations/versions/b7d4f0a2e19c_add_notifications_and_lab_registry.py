"""Add notification persistence and lab registry fields.

Revision ID: b7d4f0a2e19c
Revises: 5a5b9e1bea98
"""
from alembic import op
import sqlalchemy as sa

revision = "b7d4f0a2e19c"
down_revision = "5a5b9e1bea98"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "notifications" not in tables:
        op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    if "notification_preferences" not in tables:
        op.create_table(
        "notification_preferences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sms_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("push_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("phone_number", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        )
    lab_columns = {column["name"] for column in sa.inspect(bind).get_columns("labs")}
    if "docker_image" not in lab_columns:
        op.add_column("labs", sa.Column("docker_image", sa.String(length=500), nullable=True))
    if "registry_path" not in lab_columns:
        op.add_column("labs", sa.Column("registry_path", sa.String(length=500), nullable=True))
        op.create_unique_constraint("uq_labs_registry_path", "labs", ["registry_path"])


def downgrade():
    op.drop_constraint("uq_labs_registry_path", "labs", type_="unique")
    op.drop_column("labs", "registry_path")
    op.drop_column("labs", "docker_image")
    op.drop_table("notification_preferences")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
