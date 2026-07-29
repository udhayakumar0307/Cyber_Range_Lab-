"""
OPTIMIZATION 5: Database Index Definitions
==========================================
Centralized index registry applied at startup.
All indexes use IF NOT EXISTS semantics via SQLAlchemy Index()
so they are safe to re-apply on restart.

Index strategy:
- Only indexes that serve actual query patterns in the codebase
- No speculative indexes on low-cardinality columns
- Composite indexes ordered by selectivity (most selective first)
- Covers: users, user_lab_progress, audit_logs, study_sessions, user_achievements, lab_modules

Security: Indexes contain no sensitive data. They only affect query execution plans.
"""

import logging
from sqlalchemy import text, Index, inspect
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


# ─── Index Definitions ────────────────────────────────────────────────────────

def get_index_definitions() -> list[dict]:
    """
    Returns a list of index specifications.
    Each dict: table, name, columns, unique (optional), postgresql_ops (optional)
    """
    return [
        # ── users ──────────────────────────────────────────────────────────────
        {
            "table": "users",
            "name": "ix_users_total_score",
            "columns": ["total_score"],
            # DESC index — used for ORDER BY total_score DESC in leaderboard queries
            "comment": "Leaderboard ORDER BY total_score DESC",
        },
        {
            "table": "users",
            "name": "ix_users_role",
            "columns": ["role"],
            "comment": "Role-based filtering (admin/user queries)",
        },
        {
            "table": "users",
            "name": "ix_users_college_id",
            "columns": ["college_id"],
            "comment": "College leaderboard JOIN and filter",
        },
        {
            "table": "users",
            "name": "ix_users_is_active",
            "columns": ["is_active"],
            "comment": "Active user filter in notification/monitoring queries",
        },

        # ── user_lab_progress ──────────────────────────────────────────────────
        {
            "table": "user_lab_progress",
            "name": "ix_ulp_user_status",
            "columns": ["user_id", "status"],
            "comment": "Dashboard completion count: WHERE user_id=? AND status='COMPLETED'",
        },
        {
            "table": "user_lab_progress",
            "name": "ix_ulp_user_lab_status",
            "columns": ["user_id", "lab_id", "status"],
            "comment": "Per-lab completion count for dashboard GROUP BY",
        },
        {
            "table": "user_lab_progress",
            "name": "ix_ulp_completed_at",
            "columns": ["completed_at"],
            "comment": "Weekly graph date range filter",
        },
        {
            "table": "user_lab_progress",
            "name": "ix_ulp_module_id",
            "columns": ["module_id"],
            "comment": "Module lookup in submit-flag and progress JOIN",
        },

        # ── audit_logs ─────────────────────────────────────────────────────────
        {
            "table": "audit_logs",
            "name": "ix_audit_user_timestamp",
            "columns": ["user_id", "timestamp"],
            "comment": "User activity timeline: WHERE user_id=? ORDER BY timestamp DESC",
        },
        {
            "table": "audit_logs",
            "name": "ix_audit_org_timestamp",
            "columns": ["organization_id", "timestamp"],
            "comment": "System audit dashboard: WHERE org_id=? ORDER BY timestamp DESC",
        },

        # ── study_sessions ─────────────────────────────────────────────────────
        {
            "table": "study_sessions",
            "name": "ix_study_user_id",
            "columns": ["user_id"],
            "comment": "Training hours SUM: WHERE user_id=?",
        },
        {
            "table": "study_sessions",
            "name": "ix_study_logout_time",
            "columns": ["logout_time"],
            "comment": "Active container count: WHERE logout_time IS NULL",
        },

        # ── user_achievements ──────────────────────────────────────────────────
        {
            "table": "user_achievements",
            "name": "ix_ua_user_id",
            "columns": ["user_id"],
            "comment": "Achievement lookup: WHERE user_id=?",
        },

        # ── lab_modules ────────────────────────────────────────────────────────
        {
            "table": "lab_modules",
            "name": "ix_lm_lab_id",
            "columns": ["lab_id"],
            "comment": "Module count per lab: WHERE lab_id=? (GROUP BY)",
        },
    ]


def apply_indexes(engine: Engine) -> dict:
    """
    Applies all index definitions to the database.
    Uses raw DDL that is safe for both SQLite and PostgreSQL:
    - SQLite: CREATE INDEX IF NOT EXISTS
    - PostgreSQL: CREATE INDEX IF NOT EXISTS (supported since PG 9.5)

    Returns a summary dict with counts of created/skipped indexes.
    """
    dialect = engine.dialect.name
    definitions = get_index_definitions()
    created = 0
    skipped = 0
    failed = 0

    logger.info(f"[IndexOptimizer] Applying {len(definitions)} performance indexes on {dialect}...")

    with engine.connect() as conn:
        # Get existing tables to skip indexes on tables that don't exist yet
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

        for idx in definitions:
            table = idx["table"]
            name = idx["name"]
            columns = idx["columns"]
            comment = idx.get("comment", "")

            # Skip if table doesn't exist (migration not yet applied)
            if table not in existing_tables:
                logger.debug(f"[IndexOptimizer] Skipping {name}: table '{table}' does not exist yet")
                skipped += 1
                continue

            # Build column list for DDL
            cols_ddl = ", ".join(columns)

            try:
                if dialect == "sqlite":
                    # SQLite supports IF NOT EXISTS for CREATE INDEX
                    ddl = f'CREATE INDEX IF NOT EXISTS "{name}" ON "{table}" ({cols_ddl})'
                else:
                    # PostgreSQL supports IF NOT EXISTS since 9.5
                    ddl = f'CREATE INDEX IF NOT EXISTS "{name}" ON "{table}" ({cols_ddl})'

                conn.execute(text(ddl))
                # Some dialects need explicit commit for DDL
                if hasattr(conn, "commit"):
                    try:
                        conn.commit()
                    except Exception:
                        pass  # Auto-committed dialects will ignore this

                logger.info(f"[IndexOptimizer] ✓ {name} on {table}({cols_ddl}) — {comment}")
                created += 1

            except Exception as e:
                err = str(e).lower()
                if "already exists" in err or "duplicate" in err:
                    logger.debug(f"[IndexOptimizer] Already exists: {name}")
                    skipped += 1
                else:
                    logger.warning(f"[IndexOptimizer] Failed to create {name}: {e}")
                    failed += 1

    summary = {
        "dialect": dialect,
        "total": len(definitions),
        "created": created,
        "skipped": skipped,
        "failed": failed,
    }
    logger.info(f"[IndexOptimizer] Complete — created={created}, skipped={skipped}, failed={failed}")
    return summary
