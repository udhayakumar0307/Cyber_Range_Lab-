import os
import uvicorn
from app.main import app

if __name__ == "__main__":
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.join(backend_dir, "app")
    # Restrict reloading strictly to the 'app' source folder, ignoring logs and database files
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=[app_dir],
        reload_excludes=[
            "**/logs/**",
            "**/__pycache__/**",
            "**/.pytest_cache/**",
            "**/*.pyc"
        ]
    )
