import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.database.connection import create_db_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from app.core.security import create_access_token

def test_profile_direct():
    print("==================================================")
    print("STEP 1: CONNECTING DIRECTLY TO AWS RDS POSTGRESQL")
    print("==================================================")
    engine = create_db_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.role == "user").first()
        if not user:
            user = db.query(User).first()

        print(f"[OK] Test User found: id={user.id}, email='{user.email}', role='{user.role}'")

        token = create_access_token(data={"sub": user.email, "role": user.role})
        headers = {"Authorization": f"Bearer {token}"}
        client = TestClient(app)

        print("\n==================================================")
        print("STEP 2: TESTING GET /api/v1/user/profile")
        print("==================================================")
        res = client.get("/api/v1/user/profile", headers=headers)
        assert res.status_code == 200, f"GET /profile failed: {res.status_code}"
        print(f"[OK] Profile Data: {res.json()}")

        print("\n==================================================")
        print("STEP 3: TESTING PUT /api/v1/user/profile (ONBOARDING COMPLETION)")
        print("==================================================")
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
            "roll_number": "CY23B042"
        }
        put_res = client.put("/api/v1/user/profile", json=update_payload, headers=headers)
        assert put_res.status_code == 200, f"PUT /profile failed: {put_res.text}"
        print(f"[OK] Profile Update Response: {put_res.json()}")

        # Verify database fields directly
        db.expire_all()
        user_db = db.query(User).filter(User.id == user.id).first()
        assert user_db.profile_completed == True
        assert user_db.phone == "+91 9988776655"
        assert user_db.city == "Chennai"
        print(f"[OK] PostgreSQL DB Verified: profile_completed={user_db.profile_completed}, phone='{user_db.phone}'")

        print("\n==================================================")
        print("STEP 4: TESTING REAL STATS API (/api/v1/user/statistics)")
        print("==================================================")
        stats_res = client.get("/api/v1/user/statistics", headers=headers)
        assert stats_res.status_code == 200
        print(f"[OK] Real Statistics: {json.dumps(stats_res.json(), indent=2)}")

        print("\n==================================================")
        print("STEP 5: TESTING THEME PERSISTENCE (/api/v1/user/appearance)")
        print("==================================================")
        app_res = client.put("/api/v1/user/appearance", json={"theme": "dark"}, headers=headers)
        assert app_res.status_code == 200
        
        db.expire_all()
        user_db = db.query(User).filter(User.id == user.id).first()
        assert user_db.theme == "dark"
        print(f"[OK] Theme in AWS RDS PostgreSQL DB Verified: theme='{user_db.theme}'")

        print("\n==================================================")
        print("STEP 6: TESTING SETTINGS & SECURITY ENDPOINTS")
        print("==================================================")
        sett_res = client.get("/api/v1/user/settings", headers=headers)
        assert sett_res.status_code == 200
        sec_res = client.get("/api/v1/user/security", headers=headers)
        assert sec_res.status_code == 200
        print(f"[OK] Settings & Security APIs responded successfully!")

        print("\n==================================================")
        print("SUCCESS! ALL PROFILE, ONBOARDING, THEME, & SETTINGS TESTS PASSED!")
        print("==================================================")
    finally:
        db.close()

if __name__ == "__main__":
    test_profile_direct()
