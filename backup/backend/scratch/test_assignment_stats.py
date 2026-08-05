import sys
import os
from datetime import datetime, timedelta
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.models.assignment import Assignment
from app.api.v1.endpoints.user_profile import get_assignment_statistics

def test():
    db = db_manager.get_session()
    try:
        student = db.query(User).filter(User.email == "uk03072005@gmail.com").first()
        if not student:
            print("Student not found")
            return

        # Let's temporarily add an assignment in DB to test the endpoint
        a = Assignment(
            lab_id="lab1-recon",
            student_id=student.id,
            start_datetime=datetime.now() - timedelta(hours=1),
            end_datetime=datetime.now() + timedelta(hours=2),
            assigned_by="udhaya@cyberrange.in",
            status="Completed"
        )
        db.add(a)
        db.commit()
        db.refresh(a)
        
        print(f"Created temporary assignment {a.id} with status Completed")
        
        # Test endpoint
        stats = get_assignment_statistics(assignment_id=a.id, current_user=student, db=db)
        print("get_assignment_statistics returned successfully:")
        print(stats)
        
        db.delete(a)
        db.commit()
        print("Cleaned up temporary assignment")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
