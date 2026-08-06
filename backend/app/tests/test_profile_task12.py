import os
import sys
import json
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.base import Base
from app.models.user import User
from app.models.audit_log import AuditLog
from app.api.v1.endpoints.user_profile import (
    get_profile, 
    update_profile, 
    upload_profile_photo, 
    delete_profile_photo,
    get_statistics, 
    ProfileUpdate
)
from fastapi import UploadFile
from unittest.mock import MagicMock

def run_task12_tests():
    print("==================================================")
    print("1. INITIALIZING UNIT TEST DATABASE")
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
            account_type="STUDENT",
            profile_completed=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        print(f"[OK] Test User Created: id={user.id}, email='{user.email}', profile_completed={user.profile_completed}")

        req_mock = MagicMock()
        req_mock.headers.get.return_value = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"
        req_mock.client.host = "127.0.0.1"

        print("\n==================================================")
        print("2. TESTING PUT /profile (ONBOARDING PROFILE SAVE)")
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
            semester=5,
            roll_number="CY23B042"
        )
        up_res = update_profile(payload=update_data, request=req_mock, current_user=user, db=db)
        print(f"[OK] Profile Update Response: {up_res}")

        db.expire_all()
        updated_user = db.query(User).filter(User.id == user.id).first()
        assert updated_user.profile_completed == True
        assert updated_user.phone == "+91 9876543210"
        assert updated_user.semester == 5
        print(f"[OK] Database Column Verification Passed: profile_completed={updated_user.profile_completed}, semester={updated_user.semester}")

        # Verify Audit Log
        audit = db.query(AuditLog).filter(AuditLog.user_id == user.id, AuditLog.action == "Profile Created").first()
        assert audit is not None
        print(f"[OK] Audit Log Verified: action='{audit.action}', status='{audit.status}', ip='{audit.ip_address}'")

        print("\n==================================================")
        print("3. TESTING POST /profile/photo (PHOTO UPLOAD)")
        print("==================================================")
        dummy_file = UploadFile(filename="avatar.png", file=io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"))
        
        # Async test call for upload_profile_photo
        import asyncio
        upload_res = asyncio.run(upload_profile_photo(request=req_mock, file=dummy_file, current_user=updated_user, db=db))
        print(f"[OK] Upload Response: {upload_res}")

        db.expire_all()
        photo_user = db.query(User).filter(User.id == user.id).first()
        assert photo_user.profile_photo is not None
        print(f"[OK] User profile_photo column updated: '{photo_user.profile_photo}'")

        upload_audit = db.query(AuditLog).filter(AuditLog.user_id == user.id, AuditLog.action == "Photo Uploaded").first()
        assert upload_audit is not None
        print(f"[OK] Photo Upload Audit Log Verified: action='{upload_audit.action}'")

        print("\n==================================================")
        print("4. TESTING DELETE /profile/photo (PHOTO REMOVAL)")
        print("==================================================")
        del_res = delete_profile_photo(request=req_mock, current_user=photo_user, db=db)
        print(f"[OK] Delete Photo Response: {del_res}")

        db.expire_all()
        removed_photo_user = db.query(User).filter(User.id == user.id).first()
        assert removed_photo_user.profile_photo is None
        print(f"[OK] User profile_photo column reset to None successfully.")

        del_audit = db.query(AuditLog).filter(AuditLog.user_id == user.id, AuditLog.action == "Photo Deleted").first()
        assert del_audit is not None
        print(f"[OK] Photo Delete Audit Log Verified: action='{del_audit.action}'")

        print("\n==================================================")
        print("TASK 12 ALL USER PROFILE INTEGRATION TESTS PASSED SUCCESSFULLY!")
        print("==================================================")
    finally:
        db.close()

if __name__ == "__main__":
    run_task12_tests()
