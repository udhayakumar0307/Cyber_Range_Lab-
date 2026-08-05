import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.api.v1.endpoints.reporting import download_group_report_archive

def test():
    db = db_manager.get_session()
    try:
        student = db.query(User).filter(User.email == "udhaya@cyberrange.in").first()
        if not student:
            student = db.query(User).first()
            
        print("Testing download_group_report_archive PDF format:")
        res_pdf = download_group_report_archive(assignment_id=26, format="pdf", current_user=student, db=db)
        print(f"Success! PDF generated. Length: {len(res_pdf.body)}")
        
        print("Testing download_group_report_archive CSV format:")
        res_csv = download_group_report_archive(assignment_id=26, format="csv", current_user=student, db=db)
        print("Success! CSV generated.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
