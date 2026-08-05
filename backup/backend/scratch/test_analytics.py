import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.manager import db_manager
from app.models.user import User
from app.api.v1.endpoints.reporting import get_analytics_groups, get_analytics_group_details

def test():
    db = db_manager.get_session()
    try:
        user = db.query(User).filter(User.role == "admin").first()
        if not user:
            # Fallback to any user
            user = db.query(User).first()
        print(f"Testing analytics using user: {user.email}")
        
        # Test get_analytics_groups
        groups = get_analytics_groups(current_user=user, db=db)
        print(f"get_analytics_groups: success. Returned {len(groups)} groups.")
        for g in groups:
            print(f"  Group: {g.get('name')}, members: {g.get('memberCount')}, active labs: {g.get('activeLabsCount')}")
            
            # Test details
            details = get_analytics_group_details(group_id=g.get('id'), current_user=user, db=db)
            print(f"    Details: success. Total assignments: {details.get('assigned_labs_count')}")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
