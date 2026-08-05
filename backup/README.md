# 🛡️ Cyber Range Platform

> Enterprise-Grade Cybersecurity Training, Assessment & Virtual Lab Platform

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue)
![Docker](https://img.shields.io/badge/Docker-Lab_Containers-2496ED)
![AWS](https://img.shields.io/badge/AWS-Secrets_Manager_%26_SES-orange)

---

# 🚀 Overview

Cyber Range is a production-grade, enterprise-ready cybersecurity training platform that enables universities, companies, and training centers to host practical security learning through containerized, isolated virtual labs.

The platform handles role-based access control (RBAC), hour-based lab rental workflows, automated student lab scheduling, CTF arenas, real-time telemetry, and platform-wide audit logging.

> Decoupled async threat monitoring, auto-sync registry ingestion, real-time database hourly auditing, and cascade deletion capabilities represent high-quality production engineering.

---

# 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, React Router.
- **Backend**: FastAPI, SQLAlchemy (Object-Relational Mapping), Pydantic validation, Alembic migrations.
- **Database**: PostgreSQL (AWS RDS) with connection pooling (`pool_pre_ping=True` and `pool_recycle` connections).
- **Workers**: Standalone Python asynchronous background daemon loops.
- **Infrastructure & Secrets**: Docker engines, AWS Application Load Balancers, AWS Secrets Manager, and Amazon Simple Email Service (SES).

---

# 🔐 Security & Secrets Management

- **AWS Secrets Manager**: Securely stores platform secrets (DB URLs, Razorpay keys, JWT codes). Loaded dynamically on startup via the `AWS_SECRET_NAME` flag.
- **ALB Client IP Trust (Proxy Matching)**: Centralized request extraction via `get_client_ip(request)` reads `X-Forwarded-For` and `X-Real-IP` header arrays to log actual client IPs instead of Load Balancer proxy addresses.
- **Intrusion Detection (HIDS)**: Standalone security loop analyzes system logs to detect brute-force DDoS indicators (e.g., >150 requests/min from a single IP) and RBAC privilege violations, committing unresolved security alerts to the database.
- **Role-Based Access Control (RBAC)**: Strict separation between System Administrators (`SYSTEM_ADMIN`), Organization Administrators (`ADMIN`), and Students (`USER`). Protected API routes guard operational system paths.

---

# 🔑 Login & Authentication System

- **Dual-Tier Authentication**: Protects accounts using standard username/password combinations verified by bcrypt hashing and secure JWT access tokens.
- **Email OTP Verification**: Registration triggers a secure one-time passcode (OTP) delivered to the user's email via Amazon SES. Accounts remain locked until verified.
- **Key-Locked System Portal**: Entering the system portal `/admin/system` requires a verified system security key validation check (with dynamic 15-minute brute-force IP lockout protection).

---

# 🐳 Labs & Docker Virtualization

- **Available Labs & Catalog**: Catalog containing beginner, intermediate, and advanced labs. Supports categories like OT SCADA Security, Web Penetration, and Binary Exploitation.
- **EC2 Docker SDK Sync**: A background daemon (`docker.py`) integrates with the EC2 host Docker engine. It programmatically inspects images, pulls required lab configs, and prunes orphaned running containers.
- **Hour-Based Lab Allocations**: Allows admins to rent labs by the hour with customizable schedules and durations (30 min, 45 min, 60 min, 75 min, 90 min) with automatic session duration calculation.
- **Background Hourly Deductor**: A background worker checks active study sessions every 30 seconds and deducts execution time from the student's or organization's `hours_remaining` database balance.

---

# 🏆 CTF Puzzles & Score System

- **CTF Challenges**: Provides capture-the-flag arenas with challenge submissions.
- **Dynamic Score Sync**: An async evaluator loop (`scoremanager.py`) audits flag submissions, calculates total scores/XP progress, and updates platform leaderboards in real-time.
- **Automatic Achievements**: Syncs achievements, level meters, and finished labs count for user profiles.

---

# 💳 Payment & Billing System

- **Razorpay Integration**: Production checkout system tracking transactions, payments, and invoices.
- **Real-Time Revenue Dashboard**: Collects order metadata and maps manual lab allocations to `orders` and `payments` tables to dynamically display SaaS metrics.
- **Hourly Pricing Tiers**: Configures price per hour for catalog labs (Beginner ₹100, Intermediate ₹200, Advanced ₹300, Custom overrides) with inline sysadmin catalog updates.

---

# 📂 Detailed Project Structure

```
CyberRange
│
├── backend/
│   ├── alembic/                         # Database schema migrations
│   │
│   ├── app/
│   │   ├── api/                         # FastAPI routing module
│   │   │   └── v1/
│   │   │       └── endpoints/
│   │   │           ├── auth.py          # JWT/OTP auth
│   │   │           ├── admin_api.py     # Admin schedules and cohorts
│   │   │           ├── system_audit_api.py # Sysadmin governance and lab managers
│   │   │           └── payment_api.py   # Razorpay webhook integrations
│   │   │
│   │   ├── core/                        # Application configurations
│   │   │   └── config.py                # AWS Secrets Manager loader
│   │   │
│   │   ├── database/                    # SQLAlchemy connection pools
│   │   │
│   │   ├── models/                      # Database entities (with security_alert)
│   │   │
│   │   ├── services/                    # Background mailer workers
│   │   │
│   │   └── main.py                      # Application entry point
│   │
│   └── requirements.txt                 # Backend dependencies
│
├── src/                                 # Frontend codebase (React + Vite)
│   ├── components/                      # Reusable components
│   ├── context/                         # Auth/Theme contexts
│   ├── pages/                           # Application route layouts
│   │   └── admin/
│   │       ├── SystemPortal.tsx         # Unified light-themed Sysadmin panel
│   │       ├── LabAllocation.tsx        # Scheduled lab presets (30m, 45m, 60m, 90m)
│   │       └── PurchasedLabsPage.tsx    # Visual hourly rentals statistics
│   │
│   └── App.tsx                          # Router layout mappings
│
├── worker/                              # Standalone Worker Daemon Service
│   ├── worker_manager.py                # Main worker orchestrator
│   ├── security.py                      # HIDS logs security checker
│   ├── docker.py                        # Docker SDK container sync and pruner
│   ├── laballocator.py / puzzleallocator# Auto-sync registry file scanners
│   ├── labmanager.py                    # Hourly billing deductor loop
│   ├── scoremanager.py                  # XP points leaderboard sync loop
│   ├── databasemanager.py               # SQLAlchemy pool health checker
│   └── alb_config.json                  # AWS Application Load Balancer template
│
└── README.md                            # Documentation entry point
```

---

# 🚀 Getting Started

## 1. Setup Environment
Configure credentials in `backend/.env` (or setup `AWS_SECRET_NAME` to fetch secrets from AWS Secrets Manager):
```env
DATABASE_URL=postgresql://user:pass@host:port/dbname
SYSTEM_ADMIN_SECURITY_KEY=your_sysadmin_security_key
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
AWS_SECRET_NAME=cyberrange-production-secrets
```

## 2. Run Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 3. Run Standalone Worker Daemon
```bash
python worker/worker_manager.py
```

## 4. Run Frontend
```bash
npm install
npm run dev
```
