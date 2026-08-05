import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.api.v1.endpoints.reporting import export_student_lab_pdf

def test():
    db = db_manager.get_session()
    try:
        student = db.query(User).filter(User.email == "uk03072005@gmail.com").first()
        if not student:
            student = db.query(User).first()
            
        print(f"Testing PDF generation for user ID: {student.id}, lab ID: lab1-recon")
        
        # Test endpoint
        res = export_student_lab_pdf(student_id=student.id, lab_id="lab1-recon", current_user=student, db=db)
        print("Success! PDF generated.")
        print(f"Length of response content: {len(res.body)}")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
