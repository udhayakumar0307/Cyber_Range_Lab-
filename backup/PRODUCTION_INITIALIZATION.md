# CyberRange Production Deployment & Initialization Guide

This document details the production initialization architecture for the CyberRange Platform, outlining system data creation policies, first-run experiences, and administration procedures.

---

## 1. System Data Policy

To ensure production integrity and data privacy, **CyberRange ships with ZERO demo or placeholder business data**.

### A. Automatically Created System Data
Upon executing initial system migrations and seeding (`python scripts/migrate.py && python scripts/seed.py`), the platform automatically initializes only standard system configuration:

1. **System Security Roles**:
   - `admin`: Platform Administrator
   - `instructor`: Training Range Instructor
   - `user`: Trainee / Student
2. **Catalog Lab Definitions & Modules**:
   - Static security lab track definitions (e.g. *Network Reconnaissance*, *Cloud Security*, *OT/ICS Security Simulator*, *Command Line Fundamentals*, *Cryptography Basics*).
   - Corresponding scenario learning modules.
3. **Milestone Achievements**:
   - System badge criteria (e.g., *First Lab*, *100 Points Milestone*, *Linux Track Mastery*).

### B. Business Data Policy (Zero Auto-Creation)
The platform **NEVER** automatically creates business entities. On a fresh deployment, the database starts with:
- `0` User Training Groups (No demo groups like *Red Team* or *Blue Team*)
- `0` Trainee Accounts
- `0` Purchased Lab Licenses
- `0` Assigned Scenarios
- `0` Earned Certificates
- `0` Activity Logs

---

## 2. First-Run Setup Instructions

Follow these steps when provisioning a fresh CyberRange instance:

### Step 1: Database Migration & Schema Creation
Run standard Alembic / SQLAlchemy schema migrations:
```bash
cd backend
python scripts/migrate.py
```

### Step 2: System Catalog & Role Provisioning
Populate system catalog tracks, roles, and achievement definitions:
```bash
cd backend
python scripts/seed.py
```

### Step 3: Provision Platform Administrator
Create the initial Platform Administrator account:
```bash
cd backend
python scripts/bootstrap_admin.py
```
*(Follow prompt to set email, full name, and password for your organization's primary admin).*

---

## 3. Administrative Workflows

### Creating the First Training Group
1. Log in to the **Admin Portal** using your administrator credentials.
2. Navigate to **Group Management** (`/admin/groups`).
3. Click **+ Create Group**.
4. Enter your organization's group name (e.g., *Cyber Defense Division - Q3*, *SOC Analyst Batch*) and optional description.
5. Click **Create Group**.

### Provisioning Trainees & Users
1. Navigate to **User Management** (`/admin/users`).
2. Option A: Click **+ Add User** to create single accounts.
3. Option B: Click **Bulk CSV Import** to batch-provision trainees using standard `.csv` or `.xlsx` rosters.

### Assigning Scenarios & Labs
1. Navigate to **Lab Allocation** (`/admin/allocations`).
2. Select target **Training Group**.
3. Allocate available purchased or catalog labs to the selected group.
