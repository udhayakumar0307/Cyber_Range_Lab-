import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.api.v1.endpoints.user_profile import get_dashboard

def test():
    db = db_manager.get_session()
    try:
        user = db.query(User).filter(User.email == "uk03072005@gmail.com").first()
        if not user:
            print("User not found")
            return
        print(f"Testing dashboard for user: {user.name}, email: {user.email}, id: {user.id}")
        
        # Invoke get_dashboard logic directly or call it
        res = get_dashboard(current_user=user, db=db)
        print("Dashboard query succeeded! Response keys:", res.keys())
        print("Dashboard summary stats:", res.get("stats"))
            
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
