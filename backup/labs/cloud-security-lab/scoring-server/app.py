#!/usr/bin/env python3
import os
import sys
import re
import docker
import json
import time
import hashlib
import threading
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, abort

import boto3
from seed import seed, LOCALSTACK_ENDPOINT, AWS_REGION, STUDENT_ID, LAB_SEED, generate_flag

app = Flask(__name__)

# Scoring storage file
SCORING_DATABASE = Path("/data/leaderboard.json")
SCORING_DATABASE.parent.mkdir(parents=True, exist_ok=True)

leaderboard = {}
submissions = []

# Load/Save Leaderboard helpers
def load_leaderboard():
    global leaderboard, submissions
    if SCORING_DATABASE.exists():
        try:
            with open(SCORING_DATABASE, 'r') as f:
                data = json.load(f)
                leaderboard = data.get("leaderboard", {})
                submissions = data.get("submissions", [])
        except Exception as e:
            print(f"[!] Error loading leaderboard: {e}", file=sys.stderr)

def save_leaderboard():
    try:
        with open(SCORING_DATABASE, 'w') as f:
            json.dump({"leaderboard": leaderboard, "submissions": submissions}, f, indent=2)
    except Exception as e:
        print(f"[!] Error saving leaderboard: {e}", file=sys.stderr)

# ROT13 Encoder
def rot13(text: str) -> str:
    res = []
    for c in text:
        if 'a' <= c <= 'z':
            res.append(chr((ord(c) - ord('a') + 13) % 26 + ord('a')))
        elif 'A' <= c <= 'Z':
            res.append(chr((ord(c) - ord('A') + 13) % 26 + ord('A')))
        else:
            res.append(c)
    return "".join(res)

# Rate limiting data structure: client_ip -> [timestamps]
rate_limits = {}

def is_rate_limited(ip: str) -> bool:
    now = time.time()
    if ip not in rate_limits:
        rate_limits[ip] = []
    # Filter timestamps older than 60 seconds
    rate_limits[ip] = [t for t in rate_limits[ip] if now - t < 60]
    if len(rate_limits[ip]) >= 15: # Max 15 attempts per minute
        return True
    rate_limits[ip].append(now)
    return False

# Background Seeding & Escalation Monitor Thread
def background_worker():
    # 1. Run seed script
    try:
        seed()
    except Exception as e:
        print(f"[!] Seeding failed: {e}", file=sys.stderr)
        return

    # Load configuration
    config = {}
    if os.path.exists("config.json"):
        with open("config.json", "r") as f:
            config = json.load(f)

    # 2. Start monitoring loop for IAM privilege escalation
    iam = boto3.client("iam", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)
    s3 = boto3.client("s3", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)
    
    print("[*] Starting privilege escalation monitoring thread...")
    while True:
        try:
            # Check if developer has attached AdminPolicy or any wildcard policies
            policies = iam.list_user_policies(UserName="developer")
            policy_names = policies.get("PolicyNames", [])
            
            # Check if the restricted bucket should be provisioned
            is_escalated = False
            for p_name in policy_names:
                if "AdminPolicy" in p_name:
                    is_escalated = True
                    break
                # Inspect actual policy document for admin-like access
                try:
                    p_doc = iam.get_user_policy(UserName="developer", PolicyName=p_name)
                    doc_str = json.dumps(p_doc.get("PolicyDocument", {}))
                    if '"Action": "*"' in doc_str or '"Action": ["*"]' in doc_str:
                        is_escalated = True
                        break
                except Exception:
                    pass
            
            if is_escalated and config.get("restricted_bucket"):
                bucket_name = config["restricted_bucket"]
                
                # Check if bucket already exists, otherwise create it dynamically
                try:
                    s3.head_bucket(Bucket=bucket_name)
                except Exception:
                    # Create the restricted S3 bucket dynamically
                    s3.create_bucket(Bucket=bucket_name)
                    
                    # Block all public access for the restricted S3 bucket
                    s3.put_public_access_block(
                        Bucket=bucket_name,
                        PublicAccessBlockConfiguration={
                            "BlockPublicAcls": True,
                            "IgnorePublicAcls": True,
                            "BlockPublicPolicy": True,
                            "RestrictPublicBuckets": True
                        }
                    )
                    print(f"[+] PrivEsc detected! Created restricted bucket: {bucket_name}")
                
                # Verify flags are loaded
                flags = {}
                if os.path.exists("flags.json"):
                    with open("flags.json", "r") as f:
                        flags = json.load(f)
                
                # Write Stage 4 and Stage 5 direction flags
                s3.put_object(
                    Bucket=bucket_name,
                    Key="flag4.txt",
                    Body=f"Stage 4 Flag: {flags.get('stage4', 'N/A')}\nYou successfully escalated access!".encode("utf-8")
                )
                s3.put_object(
                    Bucket=bucket_name,
                    Key="flag5.txt",
                    Body=b"The final flag (Stage 5 Flag) has been relocated to AWS Secrets Manager for security. Retrieve the secret named 'company/final/flag' using your administrator credentials to obtain the flag."
                )

        except Exception as e:
            # Silence errors if LocalStack is resetting or user doesn't exist yet
            pass
            
        time.sleep(3)

# App endpoints
@app.route('/')
def index():
    student_id = os.environ.get('STUDENT_ID', 'student')
    
    # Get this student's data
    student_data = leaderboard.get(student_id, {
        'points': 0,
        'solved': {}
    })
    
    config = {}
    if os.path.exists("config.json"):
        with open("config.json", "r") as f:
            config = json.load(f)

    scores = {
        'total_points': student_data.get('points', 0),
        'solved': student_data.get('solved', {})
    }
    
    return render_template('index.html', 
                           student_id=student_id,
                           lab_seed=LAB_SEED,
                           config=config,
                           scores=scores)

@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})

@app.route('/api/submit-flag', methods=['POST'])
def submit_flag():
    if is_rate_limited(request.remote_addr):
        return jsonify({"status": "error", "message": "Rate limit exceeded. Please wait a moment."}), 429

    try:
        data = request.get_json()
        student_id = data.get('student_id', '').strip()
        module = int(data.get('module', 1))
        submitted_flag = data.get('submitted_flag', '').strip()
        
        if not student_id:
            return jsonify({"status": "error", "message": "student_id required"}), 400
        if not submitted_flag:
            return jsonify({"status": "error", "message": "submitted_flag required"}), 400
        
        # Load parsed ans.txt data
        expected_flag = None
        try:
            from ans_parser import parse_ans_txt
            ans_data = parse_ans_txt("ans.txt")
            if module in ans_data and ans_data[module].get("objectives"):
                expected_flag = ans_data[module]["objectives"][0].get("flag")
        except Exception:
            pass

        if not expected_flag:
            # Fallback to seeded flags or generated calculation
            flags = {}
            if os.path.exists("flags.json"):
                with open("flags.json", "r") as f:
                    flags = json.load(f)
            expected_flag = flags.get(f"stage{module}") or generate_flag(student_id, 2, module, LAB_SEED)

        is_correct = (submitted_flag == expected_flag)
        
        submission = {
            "timestamp": datetime.now().isoformat(),
            "student_id": student_id,
            "module": module,
            "submitted": submitted_flag,
            "expected": expected_flag,
            "correct": is_correct
        }
        submissions.append(submission)
        
        if is_correct:
            # Dynamic operations triggered by correct flag submissions
            if module == 1:
                # Stage 1 solved -> upload system.log to S3 public bucket containing Developer credentials
                config = {}
                if os.path.exists("config.json"):
                    with open("config.json", "r") as f:
                        config = json.load(f)
                
                if config.get("public_bucket") and config.get("developer_access_key"):
                    s3 = boto3.client("s3", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)
                    
                    # Obfuscate Stage 2 flag with ROT13
                    obfuscated_flag2 = rot13(flags.get("stage2", "N/A"))
                    
                    log_content = f"""2026-07-24 10:14:02 UTC - system - INFO - Starting service checks.
2026-07-24 10:14:05 UTC - database - INFO - Connection established.
2026-07-24 10:15:10 UTC - developer - DEBUG - Temporary Session Created:
AWS_ACCESS_KEY_ID={config['developer_access_key']}
AWS_SECRET_ACCESS_KEY={config['developer_secret_key']}
AWS_DEFAULT_REGION=us-east-1
2026-07-24 10:15:12 UTC - developer - INFO - Successful login of developer user.
2026-07-24 10:16:30 UTC - storage - ERROR - Stage 2 Flag: {obfuscated_flag2} (Obfuscated using ROT13 cipher for transient transit security)
2026-07-24 10:17:00 UTC - system - INFO - Service checks complete.
"""
                    s3.put_object(
                        Bucket=config["public_bucket"],
                        Key="system.log",
                        Body=log_content.encode("utf-8")
                    )
                    print(f"[+] Stage 1 solved. Provisioned system.log containing credentials in S3.")

            # Calculate points per module
            module_points = {1: 100, 2: 150, 3: 200, 4: 250, 5: 300}
            points = module_points.get(module, 100)
            
            # Update leaderboard
            if student_id not in leaderboard:
                leaderboard[student_id] = {
                    "points": 0,
                    "solved": {},
                    "first_submit": datetime.now().isoformat()
                }
            
            mod_key = f"mod{module}"
            if mod_key not in leaderboard[student_id]["solved"]:
                leaderboard[student_id]["solved"][mod_key] = {
                    "points": points,
                    "timestamp": datetime.now().isoformat()
                }
                leaderboard[student_id]["points"] += points
            
            save_leaderboard()
            return jsonify({
                "status": "correct",
                "message": "Flag captured successfully!",
                "points": leaderboard[student_id]["points"],
                "solved": leaderboard[student_id]["solved"]
            })
        else:
            save_leaderboard()
            return jsonify({"status": "incorrect", "message": "Incorrect flag value."}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/reset', methods=['POST'])
def reset_progress():
    student_id = request.json.get('student_id', 'student')
    
    # 1. Reset S3, Secrets Manager, and IAM state on LocalStack
    try:
        config = {}
        if os.path.exists("config.json"):
            with open("config.json", "r") as f:
                config = json.load(f)
        
        s3 = boto3.client("s3", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)
        
        # Delete system.log from public bucket
        if config.get("public_bucket"):
            try:
                s3.delete_object(Bucket=config["public_bucket"], Key="system.log")
            except Exception:
                pass
        
        # Delete restricted bucket and contents
        if config.get("restricted_bucket"):
            try:
                objects = s3.list_objects_v2(Bucket=config["restricted_bucket"])
                for obj in objects.get("Contents", []):
                    s3.delete_object(Bucket=config["restricted_bucket"], Key=obj["Key"])
                s3.delete_bucket(Bucket=config["restricted_bucket"])
            except Exception:
                pass

        # Reset IAM user policies to initial state
        iam = boto3.client("iam", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)
        try:
            policies = iam.list_user_policies(UserName="developer")
            for p in policies.get("PolicyNames", []):
                if p != "DeveloperInitialPolicy":
                    iam.delete_user_policy(UserName="developer", PolicyName=p)
        except Exception:
            pass

        # Reset Secrets Manager secret
        secretsmanager = boto3.client("secretsmanager", endpoint_url=LOCALSTACK_ENDPOINT, region_name=AWS_REGION)
        flags = {}
        if os.path.exists("flags.json"):
            with open("flags.json", "r") as f:
                flags = json.load(f)
        
        try:
            secretsmanager.delete_secret(SecretId="company/final/flag", ForceDeleteWithoutRecovery=True)
            time.sleep(1)
        except Exception:
            pass

        try:
            secretsmanager.create_secret(
                Name="company/final/flag",
                SecretString=json.dumps({"flag5": flags.get("stage5", "N/A")})
            )
        except Exception:
            pass

        print(f"[*] Reset completed for student: {student_id}")
    except Exception as e:
        print(f"[!] Error during AWS reset: {e}", file=sys.stderr)

    # 2. Reset leaderboard record
    if student_id in leaderboard:
        leaderboard[student_id] = {
            "points": 0,
            "solved": {},
            "first_submit": datetime.now().isoformat()
        }
    save_leaderboard()

    return jsonify({
        "status": "success",
        "message": "Progress reset successfully.",
        "points": 0,
        "solved": {}
    })

# Terminal session envs
terminal_envs = {}

def get_terminal_env(student_id):
    if student_id not in terminal_envs:
        terminal_envs[student_id] = {
            "AWS_DEFAULT_REGION": "us-east-1",
            "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        }
    return terminal_envs[student_id]

@app.route('/api/terminal/run', methods=['POST'])
def terminal_run():
    try:
        data = request.get_json()
        student_id = data.get('student_id', 'student')
        command = data.get('command', '').strip()
        
        if not command:
            return jsonify({"output": "", "exit_code": 0})
        
        # Check if it is a reset env command
        if command in ("clear", "reset"):
            if student_id in terminal_envs:
                del terminal_envs[student_id]
            return jsonify({"output": "[Shell environment variables reset]", "exit_code": 0})

        # Check if it is an export command  (e.g. export KEY=value or export KEY="value")
        export_match = re.match(r'^export\s+([A-Za-z0-9_]+)\s*=\s*(.+)$', command)
        if export_match:
            env_key = export_match.group(1)
            env_val = export_match.group(2).strip()
            # Strip surrounding single or double quotes
            if (env_val.startswith('"') and env_val.endswith('"')) or \
               (env_val.startswith("'") and env_val.endswith("'")):
                env_val = env_val[1:-1]
            
            # Save in state
            envs = get_terminal_env(student_id)
            envs[env_key] = env_val
            return jsonify({
                "output": f"[{env_key} saved to session]",
                "exit_code": 0
            })
            
        # Run command inside lab2-student container using docker python SDK
        try:
            client = docker.from_env()
            container = client.containers.get("lab2-student")
            
            envs = get_terminal_env(student_id)
            
            # Execute command using bash -c to support pipeline, chaining, etc.
            exec_res = container.exec_run(
                ["bash", "-c", command],
                environment=envs,
                workdir="/root"
            )
            
            output = exec_res.output.decode("utf-8", errors="ignore")
            exit_code = exec_res.exit_code
            return jsonify({
                "output": output,
                "exit_code": exit_code
            })
        except Exception as e:
            return jsonify({
                "output": f"Error executing command inside container: {e}",
                "exit_code": 1
            })
    except Exception as e:
        return jsonify({
            "output": f"Server error: {e}",
            "exit_code": 1
        })

@app.route('/modules/<filename>')
def view_module(filename):
    return render_template('view_md.html', filename=filename)

@app.route('/modules/raw/<filename>')
def view_module_raw(filename):
    """Serve raw markdown content for client-side rendering."""
    from flask import Response
    modules_dir = Path(__file__).parent.parent / 'modules'
    safe_name = Path(filename).name  # Prevent path traversal
    file_path = modules_dir / safe_name
    if not file_path.exists() or not file_path.is_file():
        return Response("# Module not found\n\nThe requested module guide does not exist.", status=404, mimetype='text/plain')
    return Response(file_path.read_text(encoding='utf-8'), mimetype='text/plain')

if __name__ == '__main__':
    load_leaderboard()
    
    # Start the background seeding and escalation monitoring thread
    t = threading.Thread(target=background_worker, daemon=True)
    t.start()
    
    app.run(host='0.0.0.0', port=5000)
