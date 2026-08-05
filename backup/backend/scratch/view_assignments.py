import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.assignment import Assignment
from datetime import datetime

def test():
    db = db_manager.get_session()
    try:
        assignments = db.query(Assignment).all()
        print(f"Total assignments: {len(assignments)}")
        print(f"Current UTC time: {datetime.utcnow()}")
        for a in assignments:
            print(f"ID: {a.id}, Lab: {a.lab_id}, Group: {a.group_id}")
            print(f"  Start: {a.start_datetime}")
            print(f"  End: {a.end_datetime}")
            print(f"  Status: {a.status}")
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
