#!/usr/bin/env python3
"""
TechCorp Internal API - Port 9000 (Module 3)
Intentionally leaks information that guides students to Module 4-5
"""

import sys
import json
from flask import Flask, jsonify, request

FLAG_MOD3 = sys.argv[1] if len(sys.argv) > 1 else "FLAG{techcorp_lab1_mod3_default}"

app = Flask(__name__)

# Intentionally leak server info in every response
@app.after_request
def add_headers(response):
    response.headers["Server"] = "TechCorp-API/1.0 Python/3.10 Flask/2.3"
    response.headers["X-Powered-By"] = "TechCorp Internal Systems"
    response.headers["X-API-Version"] = "1.0.3-beta"
    return response

@app.route("/")
def index():
    """Root endpoint - lists available endpoints (information disclosure)"""
    return jsonify({
        "service": "TechCorp Internal API",
        "version": "1.0.3-beta",
        "status": "running",
        "endpoints": [
            "/status",
            "/employees", 
            "/services",
            "/debug"
        ],
        "note": "/debug endpoint contains sensitive information (intentional for testing)"
    })

@app.route("/status")
def status():
    """System status endpoint"""
    return jsonify({
        "db": "connected",
        "ftp": "running",
        "ssh": "running",
        "admin_console": "running on port 8888",
        "uptime_seconds": 4072341
    })

@app.route("/employees")
def employees():
    """Employee list - no authentication required (vulnerability)"""
    return jsonify({
        "employees": [
            {"id": 1, "username": "admin",   "role": "administrator", "email": "admin@techcorp.internal"},
            {"id": 2, "username": "jsmith",  "role": "employee",      "email": "jsmith@techcorp.internal"},
            {"id": 3, "username": "bjones",  "role": "employee",      "email": "bjones@techcorp.internal"},
            {"id": 4, "username": "sysadmin","role": "sysadmin",      "email": "sysadmin@techcorp.internal"},
            {"id": 5, "username": "backup",  "role": "backup-admin",  "email": "backup@techcorp.internal"}
        ]
    })

@app.route("/services")
def services():
    """Internal services list - hints at hidden services"""
    return jsonify({
        "internal_services": [
            {"name": "FTP",          "port": 21,   "status": "active"},
            {"name": "SSH",          "port": 22,   "status": "active"},
            {"name": "HTTP",         "port": 80,   "status": "active"},
            {"name": "MySQL",        "port": 3306, "status": "active"},
            {"name": "API",          "port": 9000, "status": "active (you are here)"},
            {"name": "Admin Console", "port": 8888, "status": "active", "note": "For administrators only"}
        ],
        "hint": "Admin console password is stored in backup user's SSH configuration"
    })

@app.route("/debug")
def debug():
    """
    Debug endpoint - intentionally exposes sensitive information
    This is a classic information disclosure vulnerability
    
    In Module 3, students discover this endpoint and extract the API key (flag)
    and receive hints about Module 4-5 (where the admin password is stored)
    """
    return jsonify({
        "debug": {
            "internal_api_key": FLAG_MOD3,
            "admin_notes": {
                "password_storage": "Admin console password stored in encrypted config file",
                "backup_user": "backup account has admin console details",
                "backup_location": "/home/backup/.ssh/id_rsa.notes",
                "note": "Password hint is: '[check sysadmin note in database for clue]'"
            },
            "internal_hints": {
                "module_4": "Try authenticating as 'backup' user via SSH or FTP",
                "module_5": "Admin console password is discoverable from backup user's files",
                "password_format": "Format: techcorp_[something]_[year]"
            },
            "system_info": {
                "os": "Linux",
                "kernel": "5.15.0",
                "hostname": "techcorp-internal",
                "admin_console_location": "port 8888 - raw TCP socket service"
            }
        }
    })

# Error handling - intentionally verbose for debugging learning
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Endpoint not found",
        "note": "Try: /status, /employees, /services, or /debug",
        "hint": "If you found this, you're on the right track!"
    }), 404

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=9000, debug=False)