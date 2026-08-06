import os
import sys
import json

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi.testclient import TestClient
from app.main import app
from app.database.manager import db_manager
from app.models.user import User
from app.core.security import create_access_token

def test_profile_and_settings_pipeline():
    print("==================================================")
    print("STEP 1: INITIALIZING DATABASE & TEST CLIENT")
    print("==================================================")
    db_manager.init_db()
    client = TestClient(app)
    db = db_manager.get_session()

    try:
        # Retrieve or create active user
        user = db.query(User).filter(User.email == "student@cyberrange.io").first()
        if not user:
            user = db.query(User).filter(User.role == "user").first()
        if not user:
            user = db.query(User).first()

        print(f"[OK] Test User found: id={user.id}, email='{user.email}'")

        token = create_access_token(data={"sub": user.email, "role": user.role})
        headers = {"Authorization": f"Bearer {token}"}

        print("\n==================================================")
        print("STEP 2: TESTING GET & PUT /api/v1/user/profile")
        print("==================================================")

        res = client.get("/api/v1/user/profile", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        p_data = res.json()
        print(f"[OK] GET Profile response: name='{p_data['name']}', account_type='{p_data['account_type']}', completed={p_data['profile_completed']}")

        # Update profile
        update_payload = {
            "name": "Alex Enterprise Operator",
            "phone": "+91 9988776655",
            "dob": "1998-05-15",
            "gender": "Male",
            "country": "India",
            "state": "Tamil Nadu",
            "city": "Chennai",
            "account_type": "STUDENT",
            "department": "Cybersecurity & Forensic Science",
            "course": "B.Tech Cyber Defence",
            "year": 3,
            "roll_number": "CY23B042",
            "profile_photo": "https://cyberrange.io/avatars/alex.png"
        }

        put_res = client.put("/api/v1/user/profile", json=update_payload, headers=headers)
        assert put_res.status_code == 200, f"Expected 200, got {put_res.status_code}: {put_res.text}"
        print(f"[OK] PUT Profile response: {put_res.json()}")

        # Verify database update
        db.expire_all()
        user = db.query(User).filter(User.id == user.id).first()
        assert user.profile_completed == True
        assert user.phone == "+91 9988776655"
        assert user.city == "Chennai"
        print(f"[OK] Database verified: profile_completed={user.profile_completed}, phone='{user.phone}', city='{user.city}'")

        print("\n==================================================")
        print("STEP 3: TESTING GET /api/v1/user/statistics")
        print("==================================================")

        stats_res = client.get("/api/v1/user/statistics", headers=headers)
        assert stats_res.status_code == 200
        stats_data = stats_res.json()
        print(f"[OK] Statistics API response: {json.dumps(stats_data, indent=2)}")
        assert "total_score" in stats_data
        assert "global_rank" in stats_data

        print("\n==================================================")
        print("STEP 4: TESTING PUT /api/v1/user/appearance (DATABASE PERSISTENCE)")
        print("==================================================")

        app_res = client.put("/api/v1/user/appearance", json={"theme": "dark", "accent_color": "#0052CC"}, headers=headers)
        assert app_res.status_code == 200
        print(f"[OK] PUT Appearance response: {app_res.json()}")

        db.expire_all()
        user = db.query(User).filter(User.id == user.id).first()
        assert user.theme == "dark"
        print(f"[OK] Theme in PostgreSQL database verified: theme='{user.theme}'")

        print("\n==================================================")
        print("STEP 5: TESTING GET /api/v1/user/settings & /security")
        print("==================================================")

        sett_res = client.get("/api/v1/user/settings", headers=headers)
        assert sett_res.status_code == 200
        print(f"[OK] Settings API response: {json.dumps(sett_res.json(), indent=2)}")

        sec_res = client.get("/api/v1/user/security", headers=headers)
        assert sec_res.status_code == 200
        sec_data = sec_res.json()
        print(f"[OK] Security API response: recent_logs_count={len(sec_data['recent_login_history'])}")

        print("\n==================================================")
        print("ALL PROFILE & SETTINGS PIPELINE VERIFICATIONS PASSED!")
        print("==================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_profile_and_settings_pipeline()
