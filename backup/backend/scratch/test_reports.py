import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.api.v1.endpoints.reporting import get_historical_reports

def test():
    db = db_manager.get_session()
    try:
        student = db.query(User).filter(User.email == "udhaya@cyberrange.in").first()
        if not student:
            student = db.query(User).first()
            
        print("Testing get_historical_reports for group tab:")
        res_group = get_historical_reports(tab="group", current_user=student, db=db)
        print(f"Success! Returned {len(res_group)} group reports.")
        for r in res_group:
            print(f"  Group: {r['group_name']}, Lab: {r['lab_title']}, Student count: {r['student_count']}, Completion: {r['completion_pct']}%, Avg score: {r['avg_score']}, Status: {r['status']}")
            
        print("\nTesting get_historical_reports for individual tab:")
        res_ind = get_historical_reports(tab="individual", current_user=student, db=db)
        print(f"Success! Returned {len(res_ind)} individual reports.")
        for r in res_ind:
            print(f"  Student: {r['student_name']}, Lab: {r['lab_title']}, Score: {r['final_score']}, Status: {r['status']}")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
