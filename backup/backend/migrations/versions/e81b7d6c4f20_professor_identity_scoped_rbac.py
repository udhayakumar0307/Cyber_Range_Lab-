"""consolidate professor identity and add scoped rbac

Revision ID: e81b7d6c4f20
Revises: 9c61b3e8a4f7
Create Date: 2026-08-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e81b7d6c4f20"
down_revision: Union[str, None] = "9c61b3e8a4f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables(bind):
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    tables = _tables(bind)

    # Preserve old professor rows only as archival metadata. Runtime identity is User.
    if "professors" in tables and "legacy_professors" not in tables:
        op.rename_table("professors", "legacy_professors")
        tables.remove("professors")
        tables.add("legacy_professors")

    op.create_table(
        "professor_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("academic_title", sa.String(length=100), nullable=True),
        sa.Column("employee_id", sa.String(length=100), nullable=True),
        sa.Column("office", sa.String(length=150), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_professor_profiles_user_id"),
    )
    op.create_index("ix_professor_profiles_user_id", "professor_profiles", ["user_id"], unique=True)

    op.create_table(
        "user_role_bindings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("scope_type", sa.String(length=30), nullable=False),
        sa.Column("scope_key", sa.String(length=100), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("college_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("granted_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "role IN ('SYSTEM_ADMIN','ADMIN','PROFESSOR','TA','STUDENT')",
            name="ck_user_role_binding_role",
        ),
        sa.CheckConstraint(
            "scope_type IN ('GLOBAL','ORGANIZATION','COLLEGE','UNSCOPED')",
            name="ck_user_role_binding_scope_type",
        ),
        sa.CheckConstraint(
            "((scope_type = 'GLOBAL' AND organization_id IS NULL AND college_id IS NULL) OR "
            "(scope_type = 'UNSCOPED' AND organization_id IS NULL AND college_id IS NULL) OR "
            "(scope_type = 'ORGANIZATION' AND organization_id IS NOT NULL AND college_id IS NULL) OR "
            "(scope_type = 'COLLEGE' AND college_id IS NOT NULL AND organization_id IS NULL))",
            name="ck_user_role_binding_scope_columns",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["college_id"], ["colleges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role", "scope_key", name="uq_user_role_binding_scope"),
    )
    for name, columns in [
        ("ix_user_role_bindings_user_id", ["user_id"]),
        ("ix_user_role_bindings_role", ["role"]),
        ("ix_user_role_bindings_scope_type", ["scope_type"]),
        ("ix_user_role_bindings_organization_id", ["organization_id"]),
        ("ix_user_role_bindings_college_id", ["college_id"]),
        ("ix_user_role_bindings_is_active", ["is_active"]),
        ("ix_user_role_bindings_granted_by", ["granted_by"]),
    ]:
        op.create_index(name, "user_role_bindings", columns)

    if "legacy_professors" in tables:
        bind.execute(sa.text("""
            INSERT INTO professor_profiles (user_id, department)
            SELECT u.id, lp.department
            FROM legacy_professors lp
            JOIN users u ON lower(u.email) = lower(lp.email)
            ON CONFLICT (user_id) DO NOTHING
        """))

    bind.execute(sa.text("""
        INSERT INTO professor_profiles (user_id, department)
        SELECT u.id, u.department
        FROM users u
        WHERE upper(coalesce(u.role, '')) IN ('PROFESSOR', 'INSTRUCTOR')
        ON CONFLICT (user_id) DO NOTHING
    """))

    role_expr = """
        CASE
            WHEN upper(coalesce(u.role,'')) IN ('SYSTEM_ADMIN','SUPER_ADMIN','SYSADMIN') THEN 'SYSTEM_ADMIN'
            WHEN upper(coalesce(u.role,'')) IN ('ADMIN','ORGANIZATION_ADMIN','ORG_ADMIN') THEN 'ADMIN'
            WHEN upper(coalesce(u.role,'')) IN ('PROFESSOR','INSTRUCTOR') THEN 'PROFESSOR'
            WHEN upper(coalesce(u.role,'')) = 'TA' THEN 'TA'
            ELSE 'STUDENT'
        END
    """

    bind.execute(sa.text(f"""
        INSERT INTO user_role_bindings (user_id, role, scope_type, scope_key, is_active)
        SELECT u.id, 'SYSTEM_ADMIN', 'GLOBAL', 'GLOBAL', true
        FROM users u
        WHERE ({role_expr}) = 'SYSTEM_ADMIN'
        ON CONFLICT (user_id, role, scope_key) DO NOTHING
    """))

    bind.execute(sa.text(f"""
        INSERT INTO user_role_bindings
            (user_id, role, scope_type, scope_key, organization_id, is_active)
        SELECT DISTINCT u.id, ({role_expr}), 'ORGANIZATION',
               'ORG:' || ap.organization_id::text, ap.organization_id, true
        FROM users u
        JOIN admin_profiles ap ON ap.user_id = u.id
        WHERE ap.organization_id IS NOT NULL
          AND ({role_expr}) IN ('ADMIN','PROFESSOR','TA')
        ON CONFLICT (user_id, role, scope_key) DO NOTHING
    """))

    bind.execute(sa.text(f"""
        INSERT INTO user_role_bindings
            (user_id, role, scope_type, scope_key, organization_id, is_active)
        SELECT DISTINCT u.id, ({role_expr}), 'ORGANIZATION',
               'ORG:' || ua.organization_id::text, ua.organization_id, true
        FROM users u
        JOIN user_affiliations ua ON ua.user_id = u.id
        WHERE ua.organization_id IS NOT NULL
          AND ({role_expr}) IN ('ADMIN','PROFESSOR','TA')
        ON CONFLICT (user_id, role, scope_key) DO NOTHING
    """))

    bind.execute(sa.text(f"""
        INSERT INTO user_role_bindings
            (user_id, role, scope_type, scope_key, college_id, is_active)
        SELECT DISTINCT u.id, ({role_expr}), 'COLLEGE',
               'COLLEGE:' || ua.college_id::text, ua.college_id, true
        FROM users u
        JOIN user_affiliations ua ON ua.user_id = u.id
        WHERE ua.college_id IS NOT NULL
          AND ({role_expr}) IN ('ADMIN','PROFESSOR','TA')
        ON CONFLICT (user_id, role, scope_key) DO NOTHING
    """))

    bind.execute(sa.text(f"""
        INSERT INTO user_role_bindings
            (user_id, role, scope_type, scope_key, college_id, is_active)
        SELECT DISTINCT u.id, ({role_expr}), 'COLLEGE',
               'COLLEGE:' || u.college_id::text, u.college_id, true
        FROM users u
        WHERE u.college_id IS NOT NULL
          AND ({role_expr}) IN ('ADMIN','PROFESSOR','TA')
        ON CONFLICT (user_id, role, scope_key) DO NOTHING
    """))

    bind.execute(sa.text(f"""
        INSERT INTO user_role_bindings (user_id, role, scope_type, scope_key, is_active)
        SELECT u.id, ({role_expr}), 'UNSCOPED', 'UNSCOPED', true
        FROM users u
        WHERE ({role_expr}) IN ('ADMIN','PROFESSOR','TA')
          AND NOT EXISTS (SELECT 1 FROM user_role_bindings b WHERE b.user_id = u.id)
        ON CONFLICT (user_id, role, scope_key) DO NOTHING
    """))

    bind.execute(sa.text(f"""
        INSERT INTO user_role_bindings (user_id, role, scope_type, scope_key, is_active)
        SELECT u.id, 'STUDENT', 'UNSCOPED', 'UNSCOPED', true
        FROM users u
        WHERE ({role_expr}) = 'STUDENT'
        ON CONFLICT (user_id, role, scope_key) DO NOTHING
    """))


def downgrade() -> None:
    for name in [
        "ix_user_role_bindings_granted_by",
        "ix_user_role_bindings_is_active",
        "ix_user_role_bindings_college_id",
        "ix_user_role_bindings_organization_id",
        "ix_user_role_bindings_scope_type",
        "ix_user_role_bindings_role",
        "ix_user_role_bindings_user_id",
    ]:
        op.drop_index(name, table_name="user_role_bindings")
    op.drop_table("user_role_bindings")
    op.drop_index("ix_professor_profiles_user_id", table_name="professor_profiles")
    op.drop_table("professor_profiles")

    bind = op.get_bind()
    tables = _tables(bind)
    if "legacy_professors" in tables and "professors" not in tables:
        op.rename_table("legacy_professors", "professors")
