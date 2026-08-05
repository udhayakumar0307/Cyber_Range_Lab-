import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.models.user_progress import UserProgress
from app.models.lab import Lab

def test():
    db = db_manager.get_session()
    try:
        user = db.query(User).filter(User.email == "uk03072005@gmail.com").first()
        if not user:
            print("User not found")
            return
        print(f"User: {user.name}, id: {user.id}")
        
        # Check UserLabProgress
        ulp = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == user.id,
            UserLabProgress.lab_id == "lab1-recon"
        ).all()
        print(f"UserLabProgress rows for lab1-recon: {len(ulp)}")
        for r in ulp:
            print(f"  module_id: {r.module_id}, status: {r.status}")
            
        # Check UserProgress
        up = db.query(UserProgress).filter(
            UserProgress.user_id == str(user.id),
            UserProgress.track_id == "recon"
        ).all()
        print(f"UserProgress rows for track recon: {len(up)}")
        for r in up:
            print(f"  module_id: {r.module_id}, completed: {r.completed}")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
