# TechCorp Sysadmin Labs: Files Reference Guide

## Quick Navigation

### 📚 START HERE
1. **DELIVERABLES_SUMMARY.md** ← Read this first! (Overview of everything)
2. **IMPLEMENTATION_CHECKLIST.md** ← Track progress
3. **BUILD_AND_DEPLOY.md** ← How to build and deploy

### 📖 Documentation (For Students & Staff)
- **STUDENT_README.md** → Share with students
- **level_specifications_v2.md** → Complete lab specifications

### 💻 Infrastructure Files (For Deployment)
- **Dockerfile** → Build Docker image
- **provision.sh** → Set up labs inside container
- **docker-compose.yml** → Container orchestration (template)
- **generate_compose.sh** → Generate full docker-compose.yml

### ✅ Validation System (Runs Inside Containers)
- **validate_level_*.sh** → Non-readable validation scripts (created by provision.sh)
- **check_level** → Student wrapper (created by provision.sh)

---

## File Purposes & Relationships

### 1. Dockerfile
**Purpose:** Build the base Docker image  
**Contains:**
- Ubuntu 22.04 base
- All sysadmin tools (iptables, lvm2, systemd, SSH, etc.)
- SSH daemon configured on port 2222
- Directory structure (/opt/labs, /opt/validation, etc.)

**Used By:** `docker build` command  
**Creates:** Docker image `techcorp-sysadmin-labs:latest`

**Actions:**
```bash
docker build -t techcorp-sysadmin-labs:latest .
```

---

### 2. provision.sh
**Purpose:** Provisioning script (runs INSIDE the container)  
**Contains:**
- User creation (level0-level33)
- Password generation & storage
- Lab directory setup
- Objective files (OBJECTIVE.txt)
- Initial "broken" states for levels
- Validation script generation (levels 0-4 complete, 5-33 template)
- check_level wrapper creation
- Systemd timer setup

**Integration:** Add to Dockerfile:
```dockerfile
COPY provision.sh /opt/scripts/provision.sh
RUN chmod +x /opt/scripts/provision.sh && /opt/scripts/provision.sh
```

**Runs Automatically:** When container starts via Docker

**Current Status:**
- ✅ Complete for Levels 0-6
- 📋 Template for Levels 7-33 (needs completion)

---

### 3. docker-compose.yml
**Purpose:** Orchestrate 60 Docker containers  
**Contains:**
- Service definitions (student0-student59)
- Port mappings (2220-2279)
- Volume definitions (for isolation)
- Network configuration

**Usage:**
```bash
docker-compose up -d      # Start all 60
docker-compose ps         # View status
docker-compose logs -f    # View logs
docker-compose down       # Stop all
```

**Current Status:**
- Template provided (showing pattern for 3 containers)
- Use `generate_compose.sh` to create full version

---

### 4. generate_compose.sh
**Purpose:** Generate complete docker-compose.yml for 60 students  
**Contains:**
- Loop to create all 60 service definitions
- Automatic port assignment (2220-2279)
- Volume creation for each student

**Usage:**
```bash
./generate_compose.sh
# Creates docker-compose.yml with 60 services
```

**Output:** Full docker-compose.yml (~500 lines)

---

### 5. BUILD_AND_DEPLOY.md
**Purpose:** Complete deployment guide  
**Sections:**
- Prerequisites (Docker installation)
- Prepare files
- Build Docker image
- Generate docker-compose.yml
- Spin up containers
- Verify setup
- Deploy to AWS
- Monitor & troubleshoot
- Student onboarding

**For Whom:** Instructor/admin  
**When:** Read before and during deployment

---

### 6. STUDENT_README.md
**Purpose:** Student-facing guide  
**Sections:**
- How to connect via SSH
- How the challenge system works
- Lab overview (all 5 domains)
- Getting help
- Tips for success
- Troubleshooting
- Course timeline

**For Whom:** Students  
**When:** Share at course start

---

### 7. level_specifications_v2.md
**Purpose:** Complete specification for all 34 levels  
**Contains:**
- Scenario for each level
- Objective (what to solve)
- 2 hints (medium difficulty, not spoon-feeding)
- Why cheating is impossible
- Progressive learning connections

**Sections:**
- Phase 1: Permissions (Levels 0-6)
- Phase 2: Users (Levels 7-13)
- Phase 3: Services (Levels 14-20)
- Phase 4: Networking (Levels 21-27)
- Phase 5: Storage (Levels 28-33)
- Capstone (Level 33)

**For Whom:** Instructor/reference  
**When:** Review before implementation

---

### 8. IMPLEMENTATION_CHECKLIST.md
**Purpose:** Track implementation progress  
**Sections:**
- Phase 1-5 status
- Deliverables checklist
- Testing plan
- Timeline
- Risk assessment
- Success criteria

**For Whom:** Project manager/instructor  
**When:** Review weekly, update status

---

### 9. DELIVERABLES_SUMMARY.md
**Purpose:** Executive overview of everything  
**Contains:**
- What you're getting
- Key features
- Implementation status
- What needs to be done
- Architecture highlights
- Cost breakdown

**For Whom:** Decision makers  
**When:** Read first to understand scope

---

### 10. FILES_REFERENCE.md
**Purpose:** This document  
**Contains:**
- File purposes
- File relationships
- How to use each file
- Integration points

---

## Integration Flow

```
1. Start with DELIVERABLES_SUMMARY.md
   ↓
2. Review level_specifications_v2.md
   ↓
3. Review IMPLEMENTATION_CHECKLIST.md
   ↓
4. Use BUILD_AND_DEPLOY.md to:
   4a. Dockerfile → Build Docker image
   4b. provision.sh → Runs inside container
   4c. generate_compose.sh → Create docker-compose.yml
   4d. docker-compose up -d → Start 60 containers
   ↓
5. Share STUDENT_README.md with students
```

---

## File Dependencies

### For Building

```
Dockerfile
    ├── provision.sh (COPY into image)
    ├── generate_compose.sh (use locally)
    └── docker-compose.yml (use locally)
```

### For Deployment

```
docker-compose.yml (from generate_compose.sh)
    ├── Dockerfile (already built into image)
    ├── provision.sh (already in image)
    └── (runs container with all tools)
```

### For Student Use

```
STUDENT_README.md (distribute to students)
    └── Students connect via SSH
        ├── Run: check_level N
        ├── Run: cat /opt/labs/levelN/OBJECTIVE.txt
        └── Solve challenges
```

---

## Key Integration Points

### 1. Building the Docker Image

**What to do:**
```bash
# Copy provision.sh into Dockerfile context
# Modify Dockerfile to include:
COPY provision.sh /opt/scripts/provision.sh
RUN chmod +x /opt/scripts/provision.sh

# Build image
docker build -t techcorp-sysadmin-labs:latest .
```

**What provision.sh does inside container:**
- Creates users (level0-level33)
- Sets up all lab directories
- Creates validation scripts
- Sets up systemd timer

---

### 2. Generating docker-compose.yml

**What to do:**
```bash
./generate_compose.sh
```

**What it creates:**
- 60 service definitions (student0-student59)
- Port mappings (2220-2279)
- Volume definitions (for isolation)
- All in one docker-compose.yml file

---

### 3. Starting All Containers

**What to do:**
```bash
docker-compose up -d
```

**What happens:**
- 60 containers start
- provision.sh runs in each (from Dockerfile)
- Each creates its own users, labs, validation
- SSH daemons start on port 2222 (mapped to 2220-2279 externally)

---

### 4. Student Access

**What students do:**
```bash
ssh -p 2220 level0@<SERVER_IP>
```

**What they experience:**
- Connect as level0
- Read: `cat /opt/labs/level0/OBJECTIVE.txt`
- Solve challenge
- Run: `check_level 0`
- Get password for level1
- Advance to next level

---

## File Checklist

### Before Deployment
- [ ] Review DELIVERABLES_SUMMARY.md
- [ ] Review IMPLEMENTATION_CHECKLIST.md
- [ ] Approve level_specifications_v2.md (scenarios, hints, objectives)
- [ ] Review BUILD_AND_DEPLOY.md procedures

### During Implementation
- [ ] Build Dockerfile
- [ ] Run provision.sh (or integrate into Dockerfile)
- [ ] Generate docker-compose.yml
- [ ] Test with 1-5 containers first
- [ ] Verify validation scripts work
- [ ] Test end-to-end (Level 0 → Level 1)

### Before Student Launch
- [ ] Verify all 60 containers running
- [ ] Test SSH access to 5+ random containers
- [ ] Share STUDENT_README.md with students
- [ ] Conduct live demo with students
- [ ] Share access sheet (IP + port assignments)

### During Course
- [ ] Use BUILD_AND_DEPLOY.md for troubleshooting
- [ ] Use IMPLEMENTATION_CHECKLIST.md to track progress
- [ ] Monitor containers: `docker-compose ps`
- [ ] Reset broken containers: `docker-compose restart student0`

---

## Quick Commands Reference

```bash
# Build Docker image
docker build -t techcorp-sysadmin-labs:latest .

# Generate docker-compose.yml for 60 containers
./generate_compose.sh

# Start all 60 containers
docker-compose up -d

# Check all running
docker-compose ps

# View logs
docker-compose logs -f

# Access a container
docker-compose exec student0 bash

# SSH into a container (as level0)
ssh -p 2220 level0@127.0.0.1

# Reset a container
docker-compose restart student0

# Stop all containers
docker-compose down

# Clean everything (remove volumes too)
docker-compose down -v
```

---

## File Sizes

| File | Size | Lines |
|------|------|-------|
| Dockerfile | 2 KB | 65 |
| provision.sh | 15 KB | 450+ |
| docker-compose.yml | 5 KB | 100+ |
| generate_compose.sh | 1 KB | 30 |
| BUILD_AND_DEPLOY.md | 25 KB | 500+ |
| STUDENT_README.md | 20 KB | 400+ |
| level_specifications_v2.md | 50 KB | 1000+ |
| IMPLEMENTATION_CHECKLIST.md | 15 KB | 300+ |
| DELIVERABLES_SUMMARY.md | 20 KB | 400+ |
| **TOTAL** | **~150 KB** | **~3,000** |

---

## Recommended Reading Order

### For Quick Overview
1. DELIVERABLES_SUMMARY.md (5 min)
2. This file: FILES_REFERENCE.md (5 min)

### For Complete Understanding
1. DELIVERABLES_SUMMARY.md (10 min)
2. level_specifications_v2.md - at least Levels 0-6 (15 min)
3. IMPLEMENTATION_CHECKLIST.md (10 min)
4. BUILD_AND_DEPLOY.md - overview (15 min)

### Before Deployment
1. BUILD_AND_DEPLOY.md - full read (30 min)
2. Dockerfile - full read (10 min)
3. provision.sh - skim (10 min)
4. IMPLEMENTATION_CHECKLIST.md - use as guide

### For Students
1. STUDENT_README.md (send to them)
2. level_specifications_v2.md (optional reference)

---

## Support

### If you need to:

**Understand the lab system**
→ Read DELIVERABLES_SUMMARY.md

**See all 34 levels**
→ Read level_specifications_v2.md

**Deploy to AWS**
→ Follow BUILD_AND_DEPLOY.md

**Track progress**
→ Use IMPLEMENTATION_CHECKLIST.md

**Help students**
→ Use STUDENT_README.md or level_specifications_v2.md

**Understand file structure**
→ Read this file (FILES_REFERENCE.md)

---

**All files are in /mnt/user-data/outputs/ and ready to use!** 🚀
