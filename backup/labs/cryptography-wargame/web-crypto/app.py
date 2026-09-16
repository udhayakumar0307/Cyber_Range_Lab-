#!/usr/bin/env python3
"""
Web-crypto challenges (JWT). One file, two modes:
    python3 app.py l19   -> Level 19 "Forge the Token"       (default port 8019)
    python3 app.py l20   -> Level 20 final auth server        (default port 8020)

Both sign/verify HS256 tokens with a deliberately weak secret derived from
(STUDENT_ID, LAB_SEED) via labcrypto.weak_secret — the same value the generator
bakes into the level 20 incident bundle.
"""
import os, sys
import jwt
from flask import Flask, request, jsonify

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "common"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "common"))
import labcrypto as LC

SID = os.environ.get("STUDENT_ID", "student")
SEED = os.environ.get("LAB_SEED", "defaultseed")
MODE = sys.argv[1] if len(sys.argv) > 1 else "l19"

app = Flask(__name__)

if MODE == "l19":
    SECRET = LC.weak_secret("l19secret", SID, SEED)
    FLAG = LC.flag_for(19, SID, SEED)
    PORT = int(os.environ.get("PORT", 8019))
else:  # l20
    SECRET = LC.weak_secret("l20secret", SID, SEED)
    FLAG = LC.flag_for(20, SID, SEED)
    PORT = int(os.environ.get("PORT", 8020))


@app.route("/")
def index():
    if MODE == "l19":
        return jsonify(
            app="Level 19 — Forge the Token",
            howto=["POST /login  {\"user\":\"guest\"}  -> returns a JWT (HS256)",
                   "GET  /admin  with header  Authorization: Bearer <token>",
                   "You get the flag if your token's role is admin."])
    return jsonify(
        app="Level 20 — Auth Server",
        howto=["GET /admin with a valid admin Bearer token returns the final flag.",
               "The signing secret is hidden in the breached config you must decrypt."])


@app.route("/login", methods=["POST"])
def login():
    if MODE != "l19":
        return jsonify(error="not available"), 404
    body = request.get_json(silent=True) or {}
    user = str(body.get("user", "guest"))[:32]
    token = jwt.encode({"user": user, "role": "user"}, SECRET, algorithm="HS256")
    return jsonify(token=token, note="a normal user token. admins can read /admin.")


@app.route("/admin")
def admin():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify(error="missing bearer token"), 401
    token = auth[7:].strip()
    try:
        claims = jwt.decode(token, SECRET, algorithms=["HS256"])
    except Exception as e:
        return jsonify(error=f"invalid token: {e}"), 401
    if claims.get("role") != "admin":
        return jsonify(error="you are not an administrator"), 403
    return jsonify(flag=FLAG, message="Access granted, administrator.")


if __name__ == "__main__":
    print(f"[*] web-crypto {MODE} on :{PORT} (student={SID})", flush=True)
    app.run(host="0.0.0.0", port=PORT)
