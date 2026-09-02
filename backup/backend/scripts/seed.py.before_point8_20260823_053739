"""
scripts/seed.py — One-time Data Seeding Script
===============================================
Run ONCE after migrate.py on a fresh deployment:

    cd backend
    python scripts/seed.py

What this script seeds:
  - Default roles
  - Default colleges
  - Default professor
  - Default achievements
  - Static lab definitions (Recon, Cloud, OT, Railroad, Water Treatment)
  - Lab modules for each static lab

This script is IDEMPOTENT — safe to re-run. Existing records are not modified.

Note: Command Line Lab modules are synced by scripts/scan_labs.py.
"""

import os
import sys
import logging

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.core.logging_config import setup_logging
setup_logging()
logger = logging.getLogger("seed")

from app.core.config import settings
settings.reload()

from app.database.manager import db_manager
db_manager.init_db()


def seed_roles(session):
    from app.models.role import Role
    for name in ["admin", "instructor", "user"]:
        if not session.query(Role).filter(Role.name == name).first():
            session.add(Role(name=name, description=f"Default {name} role"))
            logger.info(f"  Role '{name}' created.")
    session.commit()


def seed_colleges(session):
    from app.models.college import College
    colleges = [
        {"id": 1, "name": "Indian Institute of Technology Madras", "code": "IITM", "city": "Chennai", "country": "India"},
        {"id": 2, "name": "Massachusetts Institute of Technology", "code": "MIT", "city": "Cambridge", "country": "USA"},
        {"id": 3, "name": "Stanford University", "code": "STANFORD", "city": "Stanford", "country": "USA"},
    ]
    for c in colleges:
        if not session.query(College).filter(College.id == c["id"]).first():
            session.add(College(id=c["id"], name=c["name"], code=c["code"],
                                city=c["city"], country=c["country"], status="ACTIVE"))
            logger.info(f"  College '{c['name']}' created.")
    session.commit()


def seed_professor(session):
    from app.models.professor import Professor
    if not session.query(Professor).filter(Professor.id == 1).first():
        session.add(Professor(id=1, college_id=1, name="Dr. Bruce Wayne",
                              email="bruce@iitm.ac.in", department="Computer Science"))
        session.commit()
        logger.info("  Default professor created.")


def seed_achievements(session):
    from app.models.achievement import Achievement
    achievements = [
        ("first-lab", "First Lab", "Started your first security lab environment!", "shield", "first_lab", 50),
        ("first-module", "First Module", "Successfully completed your first lab module!", "check", "first_module", 100),
        ("100-points", "100 Points Milestone", "Reached a total of 100 learning points!", "star", "points_100", 100),
        ("500-points", "500 Points Milestone", "Reached a total of 500 learning points!", "award", "points_500", 200),
        ("1000-points", "1000 Points Milestone", "Reached a total of 1000 learning points!", "trophy", "points_1000", 500),
        ("linux-track", "Linux Track Mastery", "Completed the entire Linux Fundamentals Track!", "terminal", "linux_track", 300),
        ("complete-every-module", "Every Module Complete", "Successfully completed all modules in the catalog!", "zap", "all_modules", 1000),
        ("perfect-run", "Perfect Run", "Completed every module challenge on the first attempt!", "target", "perfect_run", 500),
        ("fast-solver", "Fast Solver", "Solved a module in less than 30 seconds!", "clock", "fast_solver", 250),
    ]
    for ach_id, title, desc, icon, cond, pts in achievements:
        if not session.query(Achievement).filter(Achievement.id == ach_id).first():
            session.add(Achievement(id=ach_id, title=title, description=desc, icon=icon, condition=cond, reward_points=pts))
            logger.info(f"  Achievement '{title}' created.")
    session.commit()


def seed_labs_and_modules(session):
    from app.models.lab import Lab
    from app.models.lab_module import LabModule

    labs_data = [
        {
            "id": "lab1-recon",
            "name": "Network Reconnaissance Lab",
            "category": "recon",
            "difficulty": "Intermediate",
            "max_points": 1000,
            "estimated_time": 180,
            "modules": [
                ("lab1-recon_module1", 1, "Module 1: Port Discovery & Enumeration", "Perform initial network reconnaissance and discover open TCP ports.", 100, "recon"),
                ("lab1-recon_module2", 2, "Module 2: Service Version Fingerprinting", "Fingerprint service banners and identify software versions.", 150, "recon"),
                ("lab1-recon_module3", 3, "Module 3: Hidden Service Discovery", "Locate hidden administration endpoints and unlisted HTTP paths.", 200, "recon"),
                ("lab1-recon_module4", 4, "Module 4: Credential Discovery", "Extract exposed credentials from configuration files and service logs.", 250, "recon"),
                ("lab1-recon_module5", 5, "Module 5: Full Network Infiltration (Capstone)", "Synthesize recon findings, escalate privileges, and compromise target system.", 300, "recon"),
            ],
        },
        {
            "id": "cloud-security-lab",
            "name": "Cloud Security Lab",
            "category": "cloud",
            "difficulty": "Intermediate",
            "max_points": 1000,
            "estimated_time": 180,
            "modules": [
                ("cloud-security-lab_cloud_mod1", 1, "Module 1: S3 Anonymous Reconnaissance", "Inspect public S3 storage anonymously and extract welcome flag.", 100, "cloud"),
                ("cloud-security-lab_cloud_mod2", 2, "Module 2: Log Analysis & Credential Theft", "Extract developer AWS credentials and decode ROT13 obfuscated Stage 2 flag.", 150, "cloud"),
                ("cloud-security-lab_cloud_mod3", 3, "Module 3: Lambda Function Configuration Enumeration", "Enumerate AWS Lambda resource environment variables to capture Stage 3 flag.", 200, "cloud"),
                ("cloud-security-lab_cloud_mod4", 4, "Module 4: IAM Privilege Escalation", "Escalate IAM developer privileges to unlock restricted S3 bucket.", 250, "cloud"),
                ("cloud-security-lab_cloud_mod5", 5, "Module 5: AWS Secrets Manager Exploitation", "Extract master confidential secret from AWS Secrets Manager using admin rights.", 300, "cloud"),
            ],
        },
        {
            "id": "ot-security-lab",
            "name": "OT & ICS Security Simulator Lab",
            "category": "ot",
            "difficulty": "Intermediate",
            "max_points": 1000,
            "estimated_time": 180,
            "modules": [
                ("ot-security-lab_module1", 1, "Module 1: OT Network & Protocol Reconnaissance", "Map active ICS endpoints using Modbus TCP and MQTT decoders.", 100, "ot"),
                ("ot-security-lab_module2", 2, "Module 2: PLC Register & Process Manipulation", "Analyze unauthorized setpoint changes on chemical dosing PLCs.", 150, "ot"),
                ("ot-security-lab_module3", 3, "Module 3: Modbus & S7comm Traffic PCAP Analysis", "Inspect industrial PCAP packet captures and IOC timelines.", 200, "ot"),
                ("ot-security-lab_module4", 4, "Module 4: OT Incident Response & HMI Mitigation", "Review HMI alarm logs and execute recovery workflows.", 250, "ot"),
                ("ot-security-lab_module5", 5, "Module 5: Full Industrial Network Infiltration (Capstone)", "Conduct end-to-end investigation of multi-vector SCADA network compromise.", 300, "ot"),
            ],
        },
        {
            "id": "ot-railroad-north",
            "name": "OT Railroad Signaling & Control Security Lab",
            "category": "ot",
            "difficulty": "Advanced",
            "max_points": 1000,
            "estimated_time": 180,
            "modules": [
                ("ot-railroad-north_module1", 1, "Module 1: Railroad Master PLC & Modbus Reconnaissance", "Analyze Master PLC communication and slave segment discovery.", 100, "ot"),
                ("ot-railroad-north_module2", 2, "Module 2: Train Signal & Switch Manipulation", "Inspect unauthorized coil and register writes affecting track switches.", 150, "ot"),
                ("ot-railroad-north_module3", 3, "Module 3: Logstash & Syslog Telemetry Forensics", "Correlate Logstash syslog collector logs with SCADA events.", 200, "ot"),
                ("ot-railroad-north_module4", 4, "Module 4: Zeek Rule Audit & Traffic Detection", "Audit Zeek IDS signatures for malicious Modbus command injection.", 250, "ot"),
                ("ot-railroad-north_module5", 5, "Module 5: Railroad Network Infiltration (Capstone)", "Execute complete forensics and mitigate active train control exploits.", 300, "ot"),
            ],
        },
        {
            "id": "ot-water-treatment",
            "name": "OT Water Treatment Facility Security Lab",
            "category": "ot",
            "difficulty": "Intermediate",
            "max_points": 1000,
            "estimated_time": 180,
            "modules": [
                ("ot-water-treatment_module1", 1, "Module 1: Water Plant Modbus Coil Scanning", "Scan Modbus coils and registers across water filtration PLCs.", 100, "ot"),
                ("ot-water-treatment_module2", 2, "Module 2: Chemical Dosing Setpoint Inspection", "Identify anomalous dosing pump flow rates and setpoints.", 150, "ot"),
                ("ot-water-treatment_module3", 3, "Module 3: SCADA HMI Telemetry & Alarm Analysis", "Audit HMI web dashboard metrics and active process alarms.", 200, "ot"),
                ("ot-water-treatment_module4", 4, "Module 4: PLC Register Manipulation Defense", "Remediate unauthorized register writes and reset dosing coils.", 250, "ot"),
                ("ot-water-treatment_module5", 5, "Module 5: Facility Network Defense (Capstone)", "Complete full forensic audit and secure water treatment telemetry.", 300, "ot"),
            ],
        },
        {
            "id": "puzzle-lab",
            "name": "Puzzle — System Hardening",
            "category": "puzzle",
            "difficulty": "Advanced",
            "max_points": 2400,
            "estimated_time": 240,
            "description": "Practical sysadmin & system hardening puzzle challenges covering file permissions, ownership, setuid, umask, user provisioning, password aging, setgid shared repos, and sudoers configuration.",
            "modules": [
                ("puzzle-lab_module1", 1, "Level 0 -> Level 1: The Permission Audit Begins", "Fix deploy log file permissions for user alice.", 100, "puzzle"),
                ("puzzle-lab_module2", 2, "Level 1 -> Level 2: Hidden Configuration Discovery", "Find and read hidden secret configuration file.", 100, "puzzle"),
                ("puzzle-lab_module3", 3, "Level 2 -> Level 3: Ownership & Access Control", "Change configuration file ownership to root:techcorp.", 150, "puzzle"),
                ("puzzle-lab_module4", 4, "Level 3 -> Level 4: Special Permissions -- setuid", "Set setuid bit on system status utility script.", 150, "puzzle"),
                ("puzzle-lab_module5", 5, "Level 4 -> Level 5: Process Isolation & SUID Audit", "Audit filesystem SUID binaries and strip elevated privileges.", 200, "puzzle"),
                ("puzzle-lab_module6", 6, "Level 5 -> Level 6: umask & Default Permissions", "Calculate and enforce secure 0022 umask.", 200, "puzzle"),
                ("puzzle-lab_module7", 7, "Level 6 -> Level 7: Practical Permission Audit Challenge", "Audit multi-file permission modes against AUDIT_SPEC.txt.", 250, "puzzle"),
                ("puzzle-lab_module8", 8, "Level 7 -> Level 8: On-board the New Team", "Provision user accounts and junior_admins group.", 250, "puzzle"),
                ("puzzle-lab_module9", 9, "Level 8 -> Level 9: Password Policies & Shadow File", "Configure 90-day password aging policies with chage.", 300, "puzzle"),
                ("puzzle-lab_module10", 10, "Level 9 -> Level 10: Group Permissions & Shared Resources", "Configure setgid on shared repository directory.", 300, "puzzle"),
                ("puzzle-lab_module11", 11, "Level 10 -> Level 11: sudo Basics & sudoers Security", "Configure NOPASSWD sudo rules with visudo.", 350, "puzzle"),
                ("puzzle-lab_module12", 12, "Level 11 -> Level 12: sudo with Specific Commands", "Grant restricted root commands via sudoers.", 100, "puzzle"),
                ("puzzle-lab_module13", 13, "Level 12 -> Level 13: Account Locking and Expiration", "Manage user account locks and expiration dates.", 100, "puzzle"),
                ("puzzle-lab_module14", 14, "Level 13 -> Level 14: Practical User Provisioning Scenario", "Audit user accounts, groups, and shell configurations.", 150, "puzzle"),
                ("puzzle-lab_module15", 15, "Level 14 -> Level 15: systemd Basics - Service Control", "Manage systemd service states and auto-start.", 100, "puzzle"),
                ("puzzle-lab_module16", 16, "Level 15 -> Level 16: Service Dependencies & Ordering", "Configure service dependencies and startup order.", 100, "puzzle"),
                ("puzzle-lab_module17", 17, "Level 16 -> Level 17: Creating Custom systemd Services", "Build and install custom unit file definitions.", 150, "puzzle"),
                ("puzzle-lab_module18", 18, "Level 17 -> Level 18: Logs & journalctl", "Query system service logs with journalctl.", 100, "puzzle"),
                ("puzzle-lab_module19", 19, "Level 18 -> Level 19: Service Security - User Context", "Restrict service privileges to dedicated service accounts.", 150, "puzzle"),
                ("puzzle-lab_module20", 20, "Level 19 -> Level 20: Troubleshooting Failing Services", "Debug crashing unit services and fix configuration.", 150, "puzzle"),
                ("puzzle-lab_module21", 21, "Level 20 -> Level 21: Real Scenario - App Service", "Deploy and secure production app service unit.", 200, "puzzle"),
                ("puzzle-lab_module22", 22, "Level 21 -> Level 22: Network Interfaces & IP Config", "Configure IP addresses, subnet masks, and gateways.", 100, "puzzle"),
                ("puzzle-lab_module23", 23, "Level 22 -> Level 23: DNS & Hostname Configuration", "Configure local DNS resolution and hostname settings.", 100, "puzzle"),
                ("puzzle-lab_module24", 24, "Level 23 -> Level 24: iptables Basics - Firewall Rules", "Write iptables chain rules for packet filtering.", 150, "puzzle"),
                ("puzzle-lab_module25", 25, "Level 24 -> Level 25: Port Filtering & Service Exposure", "Expose allowed service ports and drop untrusted traffic.", 150, "puzzle"),
                ("puzzle-lab_module26", 26, "Level 25 -> Level 26: Network Connectivity Debugging", "Diagnose routing and firewall connectivity issues.", 150, "puzzle"),
                ("puzzle-lab_module27", 27, "Level 26 -> Level 27: Stateful Rules & Rate Limiting", "Implement stateful connection tracking and rate limits.", 200, "puzzle"),
                ("puzzle-lab_module28", 28, "Level 27 -> Level 28: Security Hardening Scenario", "Complete network firewall hardening audit.", 200, "puzzle"),
                ("puzzle-lab_module29", 29, "Level 28 -> Level 29: Partitions & fdisk", "Create disk partitions and partition tables.", 100, "puzzle"),
                ("puzzle-lab_module30", 30, "Level 29 -> Level 30: Filesystem Creation & Mounting", "Format ext4/xfs filesystems and configure /etc/fstab.", 150, "puzzle"),
                ("puzzle-lab_module31", 31, "Level 30 -> Level 31: Logical Volume Manager (LVM)", "Create physical volumes, volume groups, and logical volumes.", 200, "puzzle"),
                ("puzzle-lab_module32", 32, "Level 31 -> Level 32: Disk Usage Analysis & Cleanup", "Analyze du/df usage and recover disk space.", 100, "puzzle"),
                ("puzzle-lab_module33", 33, "Level 32 -> Level 33: Backup & Restore Basics", "Create compressed tar/rsync system backups.", 150, "puzzle"),
                ("puzzle-lab_module34", 34, "Level 33 -> Level 34: Capstone Infrastructure Audit", "Perform full infrastructure security and storage audit.", 250, "puzzle"),
            ],
        },
    ]

    for lab_data in labs_data:
        modules = lab_data.pop("modules")
        lab = session.query(Lab).filter(Lab.id == lab_data["id"]).first()
        if not lab:
            lab = Lab(status="ACTIVE", **lab_data)
            session.add(lab)
            session.flush()
            logger.info(f"  Lab '{lab_data['name']}' created.")

        # Seed modules (only if not already present)
        for mod_id, mod_num, mod_title, mod_desc, mod_pts, mod_track in modules:
            if not session.query(LabModule).filter(LabModule.id == mod_id).first():
                session.add(LabModule(
                    id=mod_id, lab_id=lab_data["id"], module_number=mod_num,
                    title=mod_title, description=mod_desc, points=mod_pts,
                    display_order=mod_num, track=mod_track
                ))
                logger.info(f"    Module '{mod_title}' created.")

    session.commit()


def seed_default_users(session):
    from app.models.user import User
    from app.core.security import get_password_hash

    users_to_seed = [
        # Internal CyberRange Enterprise Accounts
        {
            "name": "CyberRange Admin",
            "email": "admin@cyberrange.in",
            "password": "password",
            "role": "super_admin",
            "account_type": "internal",
            "account_status": "active",
            "email_verified": True,
            "tenant_id": "cyberrange",
            "is_internal": True,
        },
        {
            "name": "System Administrator",
            "email": "sysadmin@cyberrange.in",
            "password": "sysadmin_password_2026",
            "role": "super_admin",
            "account_type": "internal",
            "account_status": "active",
            "email_verified": True,
            "tenant_id": "cyberrange",
            "is_internal": True,
        },
        {
            "name": "Support Engineer",
            "email": "support@cyberrange.in",
            "password": "password",
            "role": "support_engineer",
            "account_type": "internal",
            "account_status": "active",
            "email_verified": True,
            "tenant_id": "cyberrange",
            "is_internal": True,
        },
        {
            "name": "Security Admin",
            "email": "secadmin@cyberrange.in",
            "password": "password",
            "role": "security_admin",
            "account_type": "internal",
            "account_status": "active",
            "email_verified": True,
            "tenant_id": "cyberrange",
            "is_internal": True,
        },
        # Student / External Accounts
        {
            "name": "Student Account",
            "email": "student@college.edu",
            "password": "password",
            "role": "student",
            "account_type": "student",
            "account_status": "active",
            "email_verified": True,
            "tenant_id": "default",
            "is_internal": False,
        },
        {
            "name": "Student User",
            "email": "user@gmail.com",
            "password": "password",
            "role": "student",
            "account_type": "student",
            "account_status": "active",
            "email_verified": True,
            "tenant_id": "default",
            "is_internal": False,
        },
    ]

    for u_data in users_to_seed:
        user = session.query(User).filter(User.email == u_data["email"]).first()
        if not user:
            pwd_hash = get_password_hash(u_data.pop("password"))
            user = User(password_hash=pwd_hash, **u_data)
            session.add(user)
            logger.info(f"  User '{u_data['email']}' created (is_internal={u_data['is_internal']}).")
        else:
            # Update existing user to reflect correct internal status
            user.is_internal = u_data["is_internal"]
            user.account_type = u_data["account_type"]
            user.role = u_data["role"]
            user.tenant_id = u_data["tenant_id"]
            logger.info(f"  User '{u_data['email']}' updated (is_internal={u_data['is_internal']}).")

    session.commit()


def main():
    with db_manager.transaction() as session:
        logger.info("Seeding roles...")
        seed_roles(session)
        logger.info("Seeding colleges...")
        seed_colleges(session)
        logger.info("Seeding professor...")
        seed_professor(session)
        logger.info("Seeding default users...")
        seed_default_users(session)
        logger.info("Seeding achievements...")
        seed_achievements(session)
        logger.info("Seeding labs and modules...")
        seed_labs_and_modules(session)
    logger.info("Seed complete.")


if __name__ == "__main__":
    main()
