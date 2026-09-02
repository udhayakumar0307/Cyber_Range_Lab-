from app.database.manager import db_manager
from app.models.admin_models import Organization

db_manager.init_db()
db = db_manager.get_session()

stuck = db.query(Organization).filter(
    Organization.institution_type == "College",
    Organization.status.notin_(["ACTIVE", "APPROVED"])
).all()

print(f"Found {len(stuck)} College-type organizations not yet ACTIVE:")
for o in stuck:
    print(f"  id={o.id} name={o.name!r} status={o.status}")

if stuck:
    confirm = input("Activate all of these now? [y/N] ")
    if confirm.strip().lower() == "y":
        for o in stuck:
            o.status = "ACTIVE"
        db.commit()
        print(f"Activated {len(stuck)} organizations.")
    else:
        print("Aborted, no changes made.")
else:
    print("Nothing to do.")
