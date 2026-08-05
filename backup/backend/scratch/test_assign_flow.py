import sys
import os
from datetime import datetime, timedelta
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.models.assignment import Assignment
from app.models.lab import Lab
from app.api.v1.endpoints.user_profile import get_user_assignments

def test():
    db = db_manager.get_session()
    try:
        student = db.query(User).filter(User.email == "uk03072005@gmail.com").first()
        if not student:
            print("Student not found")
            return
            
        print(f"Student: {student.name}, id: {student.id}, group_id: {student.group_id}")
        
        # Ensure lab exists
        lab = db.query(Lab).filter(Lab.id == "lab1-recon").first()
        if not lab:
            print("Lab lab1-recon not found")
            return
            
        # Create a new active assignment (Starts 5 mins ago, expires tomorrow)
        now = datetime.now()
        start = now - timedelta(minutes=5)
        end = now + timedelta(days=1)
        
        a = Assignment(
            lab_id=lab.id,
            group_id=student.group_id,
            start_datetime=start,
            end_datetime=end,
            assigned_by="udhaya@cyberrange.in",
            status="Assigned"
        )
        db.add(a)
        db.commit()
        db.refresh(a)
        print(f"Created assignment: {a.id}")
        
        # Verify if this assignment is returned in student assignments endpoint
        res = get_user_assignments(current_user=student, db=db)
        print(f"get_user_assignments returned {len(res)} assignments.")
        for item in res:
            print(f"  Assignment ID: {item['id']}, status: {item['status']}, lab: {item['lab_name']}")
            
        # Clean up this test assignment so we don't pollute the db
        db.delete(a)
        db.commit()
        print("Cleaned up test assignment.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
