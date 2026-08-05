import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.assignment import Assignment

def clear():
    db = db_manager.get_session()
    try:
        count = db.query(Assignment).delete()
        db.commit()
        print(f"Successfully deleted {count} assignments.")
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    clear()
