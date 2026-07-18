import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock
from app.models.base import Base
from app.models.user import User
from app.api.v1.endpoints.user_profile import (
    get_profile, 
    update_profile, 
    get_statistics, 
    update_appearance, 
    get_settings, 
    ProfileUpdate,
    AppearanceUpdate
)

def run_direct_tests():
    print("==================================================")
    print("1. INITIALIZING IN-MEMORY UNIT TEST DATABASE")
    print("==================================================")
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        user = User(
            name="Alex Operator",
            email="user@cyberrange.in",
            password_hash="hashed_pw",
            role="user",
            is_active=True,
            account_type="STUDENT"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        print(f"[OK] User created: id={user.id}, email='{user.email}'")

        print("\n==================================================")
        print("2. TESTING GET /user/profile")
        print("==================================================")
        profile_res = get_profile(current_user=user, db=db)
        print(f"[OK] Profile fetched: {json.dumps(profile_res, indent=2)}")

        print("\n==================================================")
        print("3. TESTING PUT /user/profile (ONBOARDING DATA SAVE)")
        print("==================================================")
        update_data = ProfileUpdate(
            name="Alex Enterprise Operator",
            phone="+91 9876543210",
            dob="1998-05-15",
            gender="Male",
            country="India",
            state="Tamil Nadu",
            city="Chennai",
            account_type="STUDENT",
            department="Cybersecurity & Forensics",
            course="B.Tech Cyber Defence",
            year=3,
            roll_number="CY23B042"
        )
        req_mock = MagicMock()
        req_mock.headers.get.return_value = "Mozilla/5.0 Chrome/120.0"
        req_mock.client.host = "127.0.0.1"

        up_res = update_profile(payload=update_data, request=req_mock, current_user=user, db=db)
        print(f"[OK] Profile updated: {up_res}")

        db.expire_all()
        updated_user = db.query(User).filter(User.id == user.id).first()
        assert updated_user.profile_completed == True
        assert updated_user.phone == "+91 9876543210"
        print(f"[OK] Database column verification passed: profile_completed={updated_user.profile_completed}, phone='{updated_user.phone}'")

        print("\n==================================================")
        print("4. TESTING GET /user/statistics (REAL STATS)")
        print("==================================================")
        stats = get_statistics(current_user=updated_user, db=db)
        print(f"[OK] Real Statistics: {json.dumps(stats, indent=2)}")

        print("\n==================================================")
        print("5. TESTING PUT /user/appearance (DARK MODE DATABASE PERSISTENCE)")
        print("==================================================")
        app_data = AppearanceUpdate(theme="dark", accent_color="#0052CC")
        app_res = update_appearance(payload=app_data, current_user=updated_user, db=db)
        print(f"[OK] Appearance update response: {app_res}")

        db.expire_all()
        theme_user = db.query(User).filter(User.id == user.id).first()
        assert theme_user.theme == "dark"
        print(f"[OK] Theme in DB Verified: theme='{theme_user.theme}'")

        print("\n==================================================")
        print("6. TESTING GET /user/settings")
        print("==================================================")
        settings_res = get_settings(current_user=theme_user)
        print(f"[OK] Settings: {json.dumps(settings_res, indent=2)}")

        print("\n==================================================")
        print("ALL PROFILE, ONBOARDING, THEME & STATISTICS TESTS PASSED SUCCESSFULLY!")
        print("==================================================")
    finally:
        db.close()

if __name__ == "__main__":
    run_direct_tests()
