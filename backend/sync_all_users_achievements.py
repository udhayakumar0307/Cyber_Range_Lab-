"""
System-Wide Achievement & Certificate Sync Script.
Iterates over ALL users in the database, evaluates certificate rules for eligible users,
auto-generates missing milestone/lab certificates, and clears all dashboard caches.
"""
import sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.session import get_db
from app.models.user import User
from app.services.achievement_manager import achievement_manager
from app.core.cache import dashboard_cache, invalidate_dashboard

db = next(get_db())

users = db.query(User).all()
print(f"Found {len(users)} users in database. Running system-wide achievement & certificate sync...\n")

total_awarded = 0
for u in users:
    print(f"[{u.id}] User: {u.email} ({u.name or 'No name'}) | Total Score: {u.total_score or 0}")
    try:
        awarded = achievement_manager.evaluate_user_rules(db, u.id)
        if awarded:
            print(f"   -> Newly Awarded ({len(awarded)}): {awarded}")
            total_awarded += len(awarded)
        else:
            print("   -> No new achievements awarded (already synced or conditions not met).")
        # Invalidate dashboard cache for user
        invalidate_dashboard(str(u.id))
    except Exception as e:
        print(f"   -> Error evaluating rules for user {u.id}: {e}")

# Clear global dashboard cache
try:
    dashboard_cache.flush()
    print("\n✅ Dashboard cache flushed successfully.")
except Exception as c_err:
    print(f"\n⚠️ Cache flush warning: {c_err}")

print(f"\nSystem-Wide Sync Complete! Total new achievements/certificates issued across system: {total_awarded}")
