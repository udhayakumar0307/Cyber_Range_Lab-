import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.api.v1.endpoints.user_profile import (
    get_statistics,
    get_completed_labs,
    get_activity_graph,
    get_settings,
    get_security_details,
    get_sessions,
    get_user_purchased_rentals,
    get_user_assignments
)

class DummyRequest:
    def __init__(self):
        self.headers = {"User-Agent": "Mozilla/5.0"}
        self.client = DummyClient()

class DummyClient:
    def __init__(self):
        self.host = "127.0.0.1"

def test():
    db = db_manager.get_session()
    try:
        user = db.query(User).filter(User.email == "uk03072005@gmail.com").first()
        if not user:
            print("User not found")
            return
        print(f"Testing endpoints for user: {user.name}, email: {user.email}, id: {user.id}")
        
        # Test statistics
        try:
            res = get_statistics(current_user=user, db=db)
            print("get_statistics: success")
        except Exception as e:
            print("get_statistics: failed with error:", e)
            
        # Test completed-labs
        try:
            res = get_completed_labs(current_user=user, db=db)
            print("get_completed_labs: success")
        except Exception as e:
            print("get_completed_labs: failed with error:", e)

        # Test activity-graph
        try:
            res = get_activity_graph(current_user=user, db=db)
            print("get_activity_graph: success")
        except Exception as e:
            print("get_activity_graph: failed with error:", e)

        # Test settings
        try:
            res = get_settings(current_user=user, db=db)
            print("get_settings: success")
        except Exception as e:
            print("get_settings: failed with error:", e)

        # Test security
        try:
            req = DummyRequest()
            res = get_security_details(request=req, current_user=user, db=db)
            print("get_security_details: success")
        except Exception as e:
            print("get_security_details: failed with error:", e)

        # Test sessions
        try:
            res = get_sessions(current_user=user, db=db)
            print("get_sessions: success")
        except Exception as e:
            print("get_sessions: failed with error:", e)

        # Test rentals
        try:
            res = get_user_purchased_rentals(current_user=user, db=db)
            print("get_user_purchased_rentals: success")
        except Exception as e:
            print("get_user_purchased_rentals: failed with error:", e)

        # Test assignments
        try:
            res = get_user_assignments(current_user=user, db=db)
            print("get_user_assignments: success")
        except Exception as e:
            print("get_user_assignments: failed with error:", e)

    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
