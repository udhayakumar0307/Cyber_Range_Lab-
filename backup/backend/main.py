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
    # Bind to 0.0.0.0 (not 127.0.0.1) so the process is reachable from outside
    # its own container/host — required behind any reverse proxy or PaaS
    # (Render/Railway/Docker etc.), otherwise upstream returns 502 Bad Gateway.
    # HOST/PORT are overridable via env vars; PORT defaults to the platform-
    # provided value when set (e.g. Render/Railway inject $PORT).
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    # Restrict reloading strictly to the 'app' source folder, ignoring logs and database files
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=False
    )

