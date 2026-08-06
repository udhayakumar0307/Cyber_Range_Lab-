import os
import shutil
from sqlalchemy import text
from app.database.manager import db_manager
from app.core.config import settings

def clean():
    print("Initializing database to clear certificate table...")
    db_manager.init_db()
    with db_manager.session_factory() as session:
        print("Truncating certificates table...")
        session.execute(text("TRUNCATE TABLE certificates CASCADE;"))
        session.commit()
        print("Certificates table cleared successfully.")

    # Path to certificates uploads
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    certs_dir = os.path.join(backend_dir, "uploads", "certificates")
    
    if os.path.exists(certs_dir):
        print(f"Cleaning files in {certs_dir}...")
        for sub in ["png", "pdf"]:
            sub_dir = os.path.join(certs_dir, sub)
            if os.path.exists(sub_dir):
                shutil.rmtree(sub_dir)
                os.makedirs(sub_dir, exist_ok=True)
                print(f"Cleared {sub_dir}")
    print("Cleanup completed successfully!")

if __name__ == "__main__":
    clean()
