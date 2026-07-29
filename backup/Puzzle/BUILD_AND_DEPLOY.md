# TechCorp Sysadmin Labs: Build & Deployment Guide

## Overview

This guide walks through building the Docker image, provisioning the labs, and deploying to AWS.

**Timeline:**
- **10-15 minutes:** Build Docker image
- **5 minutes:** Generate docker-compose.yml
- **2-3 minutes:** Spin up 60 containers (first time)
- **Total:** ~30 minutes (most time is Docker build)

---

## **Part 1: Prerequisites**

### On Your Local Machine (or EC2 instance)

```bash
# Install Docker & Docker Compose
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

# Start Docker
sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# Verify installation
docker --version
docker-compose --version
```

### AWS Setup (if deploying to EC2)

```bash
# Launch t3.xlarge instance in ap-south-1
# - Ubuntu 22.04 LTS
# - 16GB RAM (tight but doable for 60 containers)
# - 150GB EBS gp3 volume
# - Security group: allow ports 2220-2279 (or 2220:2279/tcp)
# - Allow SSH (port 22) for administration

# SSH into the instance
ssh -i your-key.pem ubuntu@<EC2_IP>
```

---

## **Part 2: Prepare Build Files**

### Directory Structure

```bash
techcorp-labs/
├── Dockerfile                    # Base image definition
├── provision.sh                  # Provisioning script (runs inside container)
├── docker-compose.yml            # Generated (or manually created)
├── generate_compose.sh           # Script to generate docker-compose.yml
├── build.sh                      # Build automation script
└── README.md                     # Student-facing documentation
```

### Setup on EC2

```bash
# Clone or copy files to EC2 instance
git clone <your-repo> techcorp-labs
cd techcorp-labs

# Make scripts executable
chmod +x provision.sh generate_compose.sh build.sh
```

---

## **Part 3: Build Docker Image**

### Option A: Automated Build (Recommended)

```bash
# Create build.sh
cat > build.sh << 'BUILDEOF'
#!/bin/bash
set -e

echo "=== Building TechCorp Sysadmin Labs Docker Image ==="

# Build image
docker build -t techcorp-sysadmin-labs:latest .

echo "Image built successfully!"
docker images | grep techcorp

# Run provisioning inside a test container
echo "Running provisioning script..."
docker run --rm -v /tmp/lab-test:/opt/labs -v /tmp/lab-test:/opt/validation techcorp-sysadmin-labs:latest /opt/scripts/provision.sh

echo "Build complete!"
BUILDEOF

chmod +x build.sh
./build.sh
```

### Option B: Manual Build

```bash
# Build Docker image
docker build -t techcorp-sysadmin-labs:latest .

# This will:
# 1. Pull ubuntu:22.04 base
# 2. Install all required packages
# 3. Configure SSH on port 2222
# 4. Create /opt directories
# 5. Set up systemd

# The build takes 3-5 minutes the first time
# Subsequent builds are faster (cached layers)
```

---

## **Part 4: Generate docker-compose.yml**

### Generate for 60 Students

```bash
# Run the generator script
./generate_compose.sh

# This creates docker-compose.yml with:
# - 60 services (student0 through student59)
# - Port mapping: 2220-2279
# - Unique volumes for each student (isolated state)
# - Shared network (techcorp-labs)

# Verify the file
head -50 docker-compose.yml
tail -50 docker-compose.yml
wc -l docker-compose.yml  # Should be ~300+ lines
```

---

## **Part 5: Spin Up Containers**

### Start All 60 Containers

```bash
# First time startup (takes a while)
docker-compose up -d

# Monitor startup
docker-compose logs -f

# Wait for all to be healthy
docker-compose ps  # Should show 60 containers as "Up"

# This will:
# 1. Create 60 containers
# 2. Run provision.sh in each (creates users, labs, validation scripts)
# 3. Start SSH daemon on port 2222 in each
# 4. Set up systemd timers for automatic validation
```

### Troubleshooting Startup

```bash
# Check if specific container is running
docker-compose ps student0

# View logs for a specific student
docker-compose logs student0

# Access a container directly (for debugging)
docker-compose exec student0 bash

# Restart a container
docker-compose restart student0

# Stop all containers
docker-compose down

# Stop and remove all data (clean slate)
docker-compose down -v
```

---

## **Part 6: Verify Setup**

### Test SSH Access

```bash
# Get initial password for level0 from logs or provision output
# Test SSH into student0 container
ssh -p 2220 level0@localhost

# You should be prompted for a password (from initial_passwords.txt)
# After login, verify environment
pwd      # Should be in /home/level0
ls -la   # See lab files
check_level 0
```

### Test a Level Challenge

```bash
# SSH into student0 as level0
ssh -p 2220 level0@localhost

# Try to cat the objective
cat /opt/labs/level0/OBJECTIVE.txt

# Try to solve level 0
ls -l /opt/labs/level0/deploy.log  # Should be perms 000 (unreadable)
chmod 644 /opt/labs/level0/deploy.log  # Fix permissions

# Check if solved
check_level 0
# Should output: ✓ Level 0 solved!
# Should show: Password for level1: <PASSWORD>

# Try the password with level1
ssh -p 2220 level1@localhost
# Should succeed with the password shown
```

---

## **Part 7: Deployment to AWS**

### Build Image on EC2

```bash
# On EC2 instance (ap-south-1)
cd /home/ubuntu/techcorp-labs

# Build image
docker build -t techcorp-sysadmin-labs:latest .

# This stores the image locally. Now you need to either:
# A) Use docker-compose locally (for testing)
# B) Push to ECR (for scalability, optional)
```

### Option A: Local Deployment (Simpler)

```bash
# On EC2 instance, generate and start containers
./generate_compose.sh
docker-compose up -d

# Verify all 60 are running
docker-compose ps | grep -c "Up"  # Should show 60

# Note the EC2 public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Access labs at: $PUBLIC_IP, ports 2220-2279"
```

### Option B: Use ECR (For Production)

```bash
# Push image to AWS ECR (optional, for scalability)
# This is useful if you want to scale to multiple EC2 instances later

# Create ECR repository
aws ecr create-repository --repository-name techcorp-labs --region ap-south-1

# Tag and push image
docker tag techcorp-sysadmin-labs:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/techcorp-labs:latest
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/techcorp-labs:latest

# Then docker-compose can reference ECR image:
# image: <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/techcorp-labs:latest
```

---

## **Part 8: Access & Connectivity**

### Get Student Access Info

```bash
# On EC2, generate a student access sheet
cat > student_access.txt << EOF
TechCorp Sysadmin Labs Access Information
==========================================

Server: <EC2_PUBLIC_IP>
Ports: 2220-2279 (one per student)

Student 0 (Alice): ssh -p 2220 level0@<EC2_PUBLIC_IP>
Student 1 (Bob):   ssh -p 2221 level0@<EC2_PUBLIC_IP>
...
Student 59:        ssh -p 2279 level0@<EC2_PUBLIC_IP>

Initial passwords: See initial_passwords.txt (admin only)

After first login, students solve level0 challenge to get level1 password.
EOF
```

### Security Hardening (Production)

```bash
# On EC2, restrict access by IP (if you know student IPs)
# Use AWS Security Groups to whitelist:
# - Inbound: Ports 2220-2279 from student IP ranges
# - Inbound: Port 22 from your admin IP (SSH management)

# Or, distribute a VPN for students to connect through

# Delete initial_passwords.txt after confirming all students can login
rm /opt/scripts/initial_passwords.txt
```

---

## **Part 9: Monitoring & Operations**

### Monitor Container Health

```bash
# Check all containers are running
docker-compose ps

# View resource usage
docker stats

# Check logs for errors
docker-compose logs | tail -100

# Check specific container
docker logs student0 | tail -20
```

### Reset a Student's Container

```bash
# Student broke their environment? Reset it:
docker-compose restart student5

# This restarts the container (data in /opt/labs is preserved via volumes)
# All initial broken states are recreated by provisioning on startup
```

### Backup Student Progress

```bash
# Export all student volumes (progress, solved challenges)
for i in {0..59}; do
    docker cp student${i}:/opt/labs ./backup/student${i}_labs_$(date +%s)
done
```

### Scale to More Students (If Needed)

```bash
# If you need more than 60 students later:
# 1. Modify generate_compose.sh (change NUM_STUDENTS=100)
# 2. Regenerate: ./generate_compose.sh
# 3. Scale up ports (2220-2319 for 100 students)
# 4. docker-compose up -d (adds new services)

# Or scale instance size: t3.2xlarge for up to 120+ students
```

---

## **Part 10: Troubleshooting**

### Container Won't Start

```bash
# Check logs
docker-compose logs student0

# Common issues:
# 1. Port already in use: docker ps | grep 2220
# 2. Out of memory: docker stats
# 3. Provisioning failed: docker-compose exec student0 bash
#    Then manually check /opt/labs, /opt/validation
```

### SSH Not Working

```bash
# SSH port should be 2222 inside container, mapped to 2220 externally
# Test from EC2 instance:
ssh -p 2220 -v level0@127.0.0.1
# -v gives verbose output for debugging

# If SSH key auth fails, check:
ls -la /home/level0/.ssh/
# Should contain authorized_keys if you set up key auth
```

### Validation Scripts Not Running

```bash
# Check if systemd timer is active inside container
docker-compose exec student0 systemctl status validation-check.timer

# Check timer logs
docker-compose exec student0 journalctl -u validation-check.timer -n 20

# Manually run validation
docker-compose exec student0 /opt/validation/validate_level_0.sh
```

### Performance Issues (Memory/CPU)

```bash
# Check resource limits
docker stats

# If running out of memory:
# 1. Increase EC2 instance size (t3.2xlarge)
# 2. Or reduce number of containers (docker-compose down student30-student59)
# 3. Or limit container memory: add "mem_limit: 512m" to docker-compose.yml

# Add memory limit to docker-compose.yml:
# services:
#   student0:
#     mem_limit: 512m
```

---

## **Part 11: Student Onboarding**

### What to Tell Students

```
Access Instructions:

1. Connect via SSH:
   ssh -p 2220 level0@<server_ip>
   (Replace 2220 with your assigned port)

2. Enter password:
   (Provided by instructor)

3. Read the objective:
   cat /opt/labs/level0/OBJECTIVE.txt

4. Solve the challenge

5. Check your progress:
   check_level 0

6. If solved, you'll see the password for level1

7. Continue to the next level:
   ssh level1@<server_ip> -p 2220
   (Enter password shown in step 5)
```

### Instructor Dashboard (Optional)

```bash
# Create a simple progress tracker
cat > check_all_progress.sh << 'EOF'
#!/bin/bash
echo "TechCorp Labs Progress Report"
echo "=============================="
for i in {0..59}; do
    HIGHEST_LEVEL=0
    for level in {0..33}; do
        if docker-compose exec -T student${i} test -f /opt/labs/level${level}/flag.txt 2>/dev/null; then
            HIGHEST_LEVEL=$level
        fi
    done
    echo "Student $i: Completed up to level $HIGHEST_LEVEL"
done
EOF

chmod +x check_all_progress.sh
./check_all_progress.sh
```

---

## **Quick Reference**

### Build & Deploy (One-liner)

```bash
# Start from scratch on EC2
cd techcorp-labs
docker build -t techcorp-sysadmin-labs:latest . && \
./generate_compose.sh && \
docker-compose up -d && \
echo "Labs ready at: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4), ports 2220-2279"
```

### Start/Stop/Restart

```bash
docker-compose up -d      # Start all
docker-compose down        # Stop all
docker-compose restart     # Restart all
docker-compose logs -f     # Stream logs
docker-compose ps          # List status
```

### Access Student Container

```bash
docker-compose exec student0 bash  # Root access (for admin)
ssh -p 2220 level0@127.0.0.1       # SSH as level0 (normal access)
```

---

## **Next Steps**

1. ✅ Build Docker image
2. ✅ Generate docker-compose.yml
3. ✅ Spin up 60 containers
4. ✅ Verify SSH access
5. ✅ Test Level 0 challenge
6. 📋 Distribute student access info to your learning platform
7. 📋 Monitor progress using `check_all_progress.sh` script
8. 📋 Provide support as students work through challenges

---

## **Support**

If containers fail to start:
```bash
# Full restart (clean slate)
docker-compose down -v
docker-compose up -d
```

For individual level issues, debug inside container:
```bash
docker-compose exec student0 bash
cd /opt/labs/level0
ls -la
./validate.sh  # (if exists)
```

---

**Estimated Cost (AWS ap-south-1):**
- t3.xlarge: $90-105/month
- EBS 150GB gp3: $15/month
- **Total: $105-120/month**

Safe within your $250 budget! 🎉
