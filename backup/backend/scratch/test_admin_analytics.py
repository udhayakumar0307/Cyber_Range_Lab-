import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.models.assignment import Assignment
from app.api.v1.endpoints.admin_api import get_assignment_analytics

def test():
    db = db_manager.get_session()
    try:
        # Get any assignment
        a = db.query(Assignment).first()
        if not a:
            print("No assignments found in DB to test. Creating one...")
            student = db.query(User).filter(User.role == "user").first()
            if not student:
                student = db.query(User).first()
            
            from datetime import datetime, timedelta
            a = Assignment(
                lab_id="lab1-recon",
                student_id=student.id,
                start_datetime=datetime.now() - timedelta(hours=1),
                end_datetime=datetime.now() + timedelta(hours=2),
                assigned_by="udhaya@cyberrange.in",
                status="Assigned"
            )
            db.add(a)
            db.commit()
            db.refresh(a)
            
        print(f"Testing analytics for assignment ID: {a.id}")
        
        # Test endpoint
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            admin_user = db.query(User).first()
            
        res = get_assignment_analytics(assignment_id=a.id, current_user=admin_user, db=db)
        print("Success!")
        print(res)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
