# ☁️ CloudCorp AWS Security Odyssey Lab

## Overview
The **CloudCorp AWS Security Odyssey** is a hands-on, multi-level AWS cloud security sandbox. Students interact with ephemeral AWS STS credentials, inspect live infrastructure, and execute real-time Boto3 state inspections to verify infrastructure security remediations across 6 levels (Level 0 through 5).

## Quest Levels
1. **Level 0: S3 Public Access & Policy Hardening** (100 XP) — Audit public S3 buckets, remove wildcard `Principal: "*"` policies, and enforce Block Public Access flags.
2. **Level 1: IAM Inline Policy Audit & Role Delegation** (150 XP) — Audit IAM roles, fix insecure `sts:AssumeRole` trust relationships, and enforce `sts:ExternalId` conditions.
3. **Level 2: EC2 SSRF & IMDSv2 Hardening** (200 XP) — Exploit SSRF to query IMDSv1 (`169.254.169.254`), then enforce IMDSv2 (`HttpTokens: required`).
4. **Level 3: Lambda, SSM & Secrets Manager Hardening** (250 XP) — Re-encrypt AWS Secrets Manager database credentials with a Customer-Managed Key (CMK).
5. **Level 4: Forensic Log Analysis & Key Revocation** (300 XP) — Analyze CloudTrail logs for unauthorized user creation, deactivate compromised keys, and remove backdoor IAM users.
6. **Level 5: Capstone: Account Governance & SCP Guardrails** (500 XP) — Attach regional compliance governance boundaries enforcing region `ap-south-1`.

## Infrastructure & IaC
- CloudFormation templates located in `cloudformation/` (`level0-s3.yaml` through `level5-governance.yaml`).
- Automated STS vended session credentials with 2-hour TTL.
- Federated one-click AWS Management Console access via `aws_lab_service.py`.
- Automated real-time Boto3 state validation via `aws_state_validator.py`.
