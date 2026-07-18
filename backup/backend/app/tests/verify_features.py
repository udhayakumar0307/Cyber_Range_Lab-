import os
import shutil
import sys
import time

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings
from app.database.manager import db_manager
from app.models.user import User
from app.models.role import Role

def run_tests():
    print("="*60)
    print("STARTING AUTOMATED BACKEND INFRASTRUCTURE TESTS")
    print("="*60)
    
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(backend_dir, ".env")
    env_backup = os.path.join(backend_dir, ".env.backup")
    
    if os.path.exists(env_path):
        shutil.copy2(env_path, env_backup)
        print("[*] Backed up original .env file.")
    else:
        print("[!] Warning: .env file not found. Testing with defaults.")
        
    try:
        # ---- 1. Test SQLite Connection & Seeding ----
        db_path_1 = os.path.join(backend_dir, "test_db_1.db")
        if os.path.exists(db_path_1):
            os.remove(db_path_1)
            
        print("\n[*] Testing SQLite connection and table creation...")
        with open(env_path, "w") as f:
            f.write("ENV=development\n")
            f.write("SECRET_KEY=testkey123\n")
            f.write("DATABASE_URL=sqlite:///" + db_path_1.replace("\\", "/") + "\n")
            f.write("ADMIN_USERNAME=sqliteadmin\n")
            f.write("ADMIN_EMAIL=admin@example.com\n")
            f.write("ADMIN_PASSWORD=Password1!\n")
            
        db_manager.init_db(force=True)
        assert os.path.exists(db_path_1), "test_db_1.db was not created!"
        print("[OK] SQLite database file created successfully.")
        
        session = db_manager.get_session()
        users_count = session.query(User).count()
        admin_user = session.query(User).filter(User.email == "admin@example.com").first()
        assert users_count == 3, f"Expected 3 users, found {users_count}"
        assert admin_user is not None, "Admin user not found"
        assert admin_user.role == "admin", f"Expected admin role, got {admin_user.role}"
        print(f"[OK] Seeding success. User name: {admin_user.name}, role: {admin_user.role}")
        session.close()
        
        # Test health check response
        assert db_manager.check_health() is True
        print("[OK] SQLite health check is working (returns True).")
        
        # ---- 2. Test PostgreSQL Connection & Seeding ----
        print("\n[*] Testing PostgreSQL connection and table creation...")
        # Point to docker PostgreSQL instance
        postgres_url = "postgresql://postgres:postgres@localhost:5432/cyberrange"
        
        with open(env_path, "w") as f:
            f.write("ENV=development\n")
            f.write("SECRET_KEY=testkey123\n")
            f.write("DATABASE_URL=" + postgres_url + "\n")
            f.write("ADMIN_USERNAME=pgadmin\n")
            f.write("ADMIN_EMAIL=admin@example.com\n")
            f.write("ADMIN_PASSWORD=Password1!\n")
            
        db_manager.init_db(force=True)
        print("[OK] PostgreSQL connection initialized successfully.")
        
        session_pg = db_manager.get_session()
        users_count_pg = session_pg.query(User).count()
        admin_user_pg = session_pg.query(User).filter(User.email == "admin@example.com").first()
        assert users_count_pg >= 3, f"Expected at least 3 users in PostgreSQL, found {users_count_pg}"
        assert admin_user_pg is not None, "Admin user not found in PostgreSQL"
        assert admin_user_pg.role == "admin", f"Expected admin role in PG, got {admin_user_pg.role}"
        print(f"[OK] PostgreSQL Seeding success. User email: {admin_user_pg.email}, role: {admin_user_pg.role}")
        session_pg.close()
        
        # Test health check dynamically
        assert db_manager.check_health() is True
        assert db_manager.engine.dialect.name == "postgresql", f"Expected pg dialect, got {db_manager.engine.dialect.name}"
        print("[OK] PostgreSQL health check is working and detects dialect name.")
        
        # Clean up SQLite test file
        db_manager.shutdown()
        if os.path.exists(db_path_1):
            os.remove(db_path_1)
        print("[*] Cleaned up temporary SQLite database file.")
        
        print("\n" + "="*60)
        print("[OK] ALL BACKEND AND DATABASE INFRASTRUCTURE TESTS PASSED SUCCESSFULLY! [OK]")
        print("="*60)
        
    finally:
        # Restore backup .env
        if os.path.exists(env_backup):
            shutil.copy2(env_backup, env_path)
            os.remove(env_backup)
            print("[*] Restored original .env file.")

if __name__ == "__main__":
    run_tests()
