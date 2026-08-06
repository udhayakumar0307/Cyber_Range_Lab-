import os
import sys

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi.testclient import TestClient
from app.main import app
from app.database.manager import db_manager
from app.models.user import User

def run_endpoint_tests():
    print("="*60)
    print("STARTING BACKEND ENDPOINT AND AUTHENTICATION TESTS")
    print("="*60)
    
    # Initialize the database (this will auto-create tables and seed default users)
    db_manager.init_db(force=True)
    
    client = TestClient(app)
    
    # 1. Test Default Admin Authentication (TASK 5)
    print("\n[*] Testing default admin login...")
    login_payload = {
        "email": "admin@cyberrange.in",
        "password": "password"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200, f"Failed to login: {response.text}"
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["role"] == "admin"
    admin_token = res_data["token"]
    print("[OK] Default admin authenticated successfully.")
    
    # 2. Test Default Demo User Authentication (TASK 6)
    print("\n[*] Testing default demo user login...")
    user_login_payload = {
        "email": "user@cyberrange.in",
        "password": "password"
    }
    response = client.post("/api/v1/auth/login", json=user_login_payload)
    assert response.status_code == 200, f"Failed to login: {response.text}"
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["role"] == "user"
    print("[OK] Default demo user authenticated successfully.")
    
    # 3. Test Registration Endpoint (TASK 8)
    print("\n[*] Testing registration of a new user...")
    new_user_email = "alex.mercer@cyberrange.in"
    
    # Ensure user does not exist first
    session = db_manager.get_session()
    existing = session.query(User).filter(User.email == new_user_email).first()
    if existing:
        session.delete(existing)
        session.commit()
    session.close()
    
    register_payload = {
        "name": "Alex Mercer",
        "email": new_user_email,
        "password": "securepassword123"
    }
    response = client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == 201, f"Failed to register: {response.text}"
    reg_data = response.json()
    assert reg_data["email"] == new_user_email
    assert reg_data["name"] == "Alex Mercer"
    assert reg_data["role"] == "user"
    print("[OK] User registered successfully.")
    
    # Test duplicate registration rejection
    print("\n[*] Testing duplicate registration rejection...")
    response = client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == 400
    assert "Email already registered" in response.json()["message"]
    print("[OK] Duplicate registration rejected correctly.")

    # 4. Test Login of Newly Registered User (TASK 7)
    print("\n[*] Testing login of the new user...")
    new_login_payload = {
        "email": new_user_email,
        "password": "securepassword123"
    }
    response = client.post("/api/v1/auth/login", json=new_login_payload)
    assert response.status_code == 200, f"Failed to login: {response.text}"
    new_res_data = response.json()
    assert new_res_data["success"] is True
    user_token = new_res_data["token"]
    print("[OK] Newly registered user logged in successfully and JWT generated.")
    
    # 5. Test Profile Retrieval (TASK 9)
    print("\n[*] Testing profile retrieval GET /api/v1/auth/me...")
    headers = {
        "Authorization": f"Bearer {user_token}"
    }
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200, f"Failed to get profile: {response.text}"
    profile_data = response.json()
    assert profile_data["email"] == new_user_email
    assert profile_data["name"] == "Alex Mercer"
    assert profile_data["role"] == "user"
    print("[OK] Profile retrieved successfully from database.")
    
    print("\n" + "="*60)
    print("[OK] ALL BACKEND ENDPOINT AND AUTHENTICATION TESTS PASSED! [OK]")
    print("="*60)

if __name__ == "__main__":
    run_endpoint_tests()
