#!/bin/bash
set -e

echo "Starting Cryptography Lab microservices..."

# Minimal progress verification microservice on port 9500
cat << 'EOF' > /app/service.py
from flask import Flask, jsonify
import sys

app = Flask(__name__)

@app.route('/progress/<user_id>/<track_id>/<module_id>')
def check_progress(user_id, track_id, module_id):
    return jsonify({
        "module_complete": True,
        "objectives": []
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9500)
EOF

python3 /app/service.py
