import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.models.assignment import Assignment
from app.models.lab import Lab
from app.models.group import Group
from sqlalchemy import or_

def test():
    db = db_manager.get_session()
    try:
        user = db.query(User).filter(User.email == "uk03072005@gmail.com").first()
        if not user:
            print("User not found")
            return
        print(f"Testing for user: {user.name}, email: {user.email}, id: {user.id}, group_id: {user.group_id}")
        
        query = db.query(Assignment, Lab).join(
            Lab, Lab.id == Assignment.lab_id
        ).filter(
            Assignment.deleted_at.is_(None)
        )

        if user.group_id is not None:
            query = query.filter(
                or_(
                    Assignment.student_id == user.id,
                    Assignment.group_id == user.group_id
                )
            )
        else:
            query = query.filter(Assignment.student_id == user.id)

        assignments = query.all()
        
        print("Query succeeded! Total assignments:", len(assignments))
        for assoc, lab in assignments:
            print("Assoc ID:", assoc.id, "Lab ID:", lab.id, "Name:", lab.name)
            
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
