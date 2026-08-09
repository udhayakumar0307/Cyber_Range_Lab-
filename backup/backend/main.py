import os
import sys

# Ensure backend directory is in sys.path and PYTHONPATH for child process reloader
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ["PYTHONPATH"] = backend_dir + (os.pathsep + os.environ["PYTHONPATH"] if "PYTHONPATH" in os.environ else "")

import uvicorn

if __name__ == "__main__":
    app_dir = os.path.join(backend_dir, "app")
    # Restrict reloading strictly to the 'app' source folder, ignoring logs and database files
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=False
    )

