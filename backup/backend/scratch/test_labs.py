import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.api.v1.endpoints.labs_api import get_labs

def test():
    db = db_manager.get_session()
    try:
        user = db.query(User).filter(User.email == "uk03072005@gmail.com").first()
        if not user:
            print("User not found")
            return
        print(f"Testing labs for user: {user.name}, email: {user.email}, id: {user.id}")
        
        # Invoke get_labs logic directly
        res = get_labs(db=db, current_user=user)
        print("Labs query succeeded! Total labs returned:", len(res))
        if len(res) > 0:
            print("First lab keys:", res[0].keys())
            
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
