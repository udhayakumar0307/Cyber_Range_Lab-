import os
import sys

sys.path.insert(0, "/home/anandsharmaaipdftoquiz/Downloads/backend /terraform-feature-mainwebsite-ui-updates")

os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/db"
os.environ["MIGRATION_DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/db"
os.environ["JWT_SECRET"] = "0123456789abcdef0123456789abcdef"
os.environ["GOOGLE_CLIENT_ID"] = "dummy"
os.environ["HEADSCALE_API_KEY"] = "dummy"
os.environ["HEADSCALE_API_URL"] = "http://localhost:8080"
os.environ["CORS_ALLOWED_ORIGINS"] = "https://webportal-feature-mainwebsite-ui-up.vercel.app,http://localhost:3000"
os.environ["ENABLE_DOCS"] = "true"
os.environ["RUN_WORKERS_IN_APP"] = "true"

try:
    from backend.main import app
    print("SUCCESS! FastAPI application imported successfully.")
except Exception as e:
    print("ERROR!", e)
    import traceback
    traceback.print_exc()
