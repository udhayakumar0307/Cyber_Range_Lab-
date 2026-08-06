# 🛡️ SecureGuard Cloud Security Lab (Lab 2)

A hands-on, dockerised **AWS Cloud Misconfiguration CTF lab** designed to teach cloud security attack techniques in an isolated local environment. Based on the SecureGuard multi-container CTF framework modelled after TryHackMe-style rooms.

---

## 📋 What You'll Learn

| Stage | Attack Technique | Difficulty |
|-------|-----------------|------------|
| Module 1 | S3 Anonymous Reconnaissance | ⭐ Trivial |
| Module 2 | Credential Theft & Log Analysis | ⭐ Easy |
| Module 3 | Cloud Resource Enumeration | ⭐⭐ Medium |
| Module 4 | IAM Privilege Escalation | ⭐⭐ Medium |
| Module 5 | Corporate Secrets Infiltration | ⭐⭐⭐ Hard |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   cloud-security-net (10.20.0.0/24)         │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐   │
│  │ lab2-target  │    │ lab2-scoring │    │ lab2-student│   │
│  │ LocalStack   │    │ Flask CTF UI │    │ Kali Linux  │   │
│  │ 10.20.0.10   │    │ 10.20.0.99   │    │ 10.20.0.50  │   │
│  │ :4566        │    │ :5000        │    │ (workspace) │   │
│  └──────────────┘    └──────────────┘    └─────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- **`lab2-target`** — LocalStack emulating AWS (S3, IAM, Lambda, Secrets Manager)
- **`lab2-scoring`** — Flask scoring dashboard with built-in web terminal
- **`lab2-student`** — Kali Linux workstation with AWS CLI, boto3, jq

---

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Launch the Lab

```bash
git clone https://github.com/umadhatri/cyberrange.git
cd cyberrange/cloud-security-lab
docker compose up --build -d
```

Open the dashboard at: **http://localhost:5000**

### Stop the Lab

```bash
docker compose down
```

---

## 🖥️ Dashboard Features

| Tab | Description |
|-----|-------------|
| **Challenges** | 5 staged modules with objectives and inline flag submission |
| **Kali Terminal** | In-browser shell connected to the Kali workstation container |
| **Scoreboard** | Progress tracker with points and timestamps |
| **Credentials & Lab** | AWS keys and bucket names (conditionally revealed per stage) |

---

## 🔑 Dynamic Flags

Flags are deterministically generated per student using SHA-256 hashing:

```
FLAG{techcorp_lab2_modX_<student_id>_<hash8>}
```

Set a custom student ID and seed via environment variables before launching:

```bash
STUDENT_ID=alice LAB_SEED=myseed docker compose up -d
```

---

## 📁 Directory Structure

```
cloud-security-lab/
├── docker-compose.yml          # Multi-container orchestration
├── scoring-server/
│   ├── Dockerfile
│   ├── app.py                  # Flask API + terminal backend
│   ├── seed.py                 # AWS resource seeding (LocalStack)
│   └── templates/
│       ├── index.html          # Main CTF dashboard
│       └── view_md.html        # Markdown guide viewer
├── student-env/
│   └── Dockerfile              # Kali Linux workstation
└── modules/
    ├── MODULE_1.md             # Stage 1 guide
    ├── MODULE_2.md             # Stage 2 guide
    ├── MODULE_3.md             # Stage 3 guide
    ├── MODULE_4.md             # Stage 4 guide
    └── MODULE_5.md             # Stage 5 guide
```

---

## 🛡️ Built With

- [LocalStack](https://localstack.cloud/) — AWS cloud emulation
- [Flask](https://flask.palletsprojects.com/) — Scoring server backend
- [Docker](https://www.docker.com/) — Container orchestration
- Kali Linux — Student workstation

---

## ⚠️ Disclaimer

This lab is designed for **educational purposes only** in an isolated local environment. Do not use these techniques against real AWS accounts or production environments without explicit authorisation.
