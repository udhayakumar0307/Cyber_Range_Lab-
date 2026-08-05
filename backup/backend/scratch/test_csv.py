import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.api.v1.endpoints.reporting import export_group_lab_csv

def test():
    db = db_manager.get_session()
    try:
        student = db.query(User).filter(User.email == "udhaya@cyberrange.in").first()
        if not student:
            student = db.query(User).first()
            
        print("Testing CSV generation for group ID: 4, lab ID: lab1-recon")
        
        # Test endpoint
        res = export_group_lab_csv(group_id=4, lab_id="lab1-recon", current_user=student, db=db)
        print("Success! CSV generated.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
