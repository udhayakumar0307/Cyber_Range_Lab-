# Linux Security and Cyber Defense Workshop

This is a separate assignable catalog product, `linux-security-workshop`, at
`/labs/linux-security-workshop`. It contains 12 independent 100-point exercises
(1,200 points), ordered by the revised two-day proposal. Existing Linux course
question IDs and grades remain separate. The question bank is the sibling
`linux-sysadmin-autograder` repository; its `workshop.course.yaml` records times,
tiers, original lab IDs, and optional stretch references.

## Delivery sequence

| Day | Time | Workshop exercise | Source / purpose |
| --- | --- | --- | --- |
| 1 | 13:30–14:05 | WS-CORE-001 | RHSA-SHELL-001 |
| 1 | 14:05–14:40 | WS-CORE-002 | RHSA-USERS-001 |
| 1 | 14:40–15:15 | WS-CORE-003 | RHSA-FILE-001 |
| 1 | 15:30–16:05 | WS-CORE-004 | RHSA-PROC-001 |
| 1 | 16:05–16:35 | WS-CORE-005 | TUPE-C03-007 |
| 1 | 16:35–17:15 | WS-ADV-001 | Service failure investigation |
| 2 | 13:30–14:05 | WS-CORE-006 | RHSA-SUDO-001 |
| 2 | 14:05–14:40 | WS-CORE-007 | RHSA-SSH-001 |
| 2 | 14:40–15:10 | WS-CORE-008 | RHSA-TEXT-001 |
| 2 | 15:25–15:55 | WS-CORE-009 | RHSA-SCHED-001 |
| 2 | 15:55–16:25 | WS-ADV-002 | Persistence and privilege investigation |
| 2 | 16:25–17:15 | WS-ADV-003 | Incident capstone |

Morning theory and demonstrations follow the proposal. The first three core
exercises are Foundation; the other six are Practitioner. The sidebar shows day,
tier, and time. Optional stretch exercises remain in the Linux course and need
that course's access; they are not included in the 1,200-point denominator.

## Implementation and scope

Core packages are versioned workshop copies with unique WS IDs, allowing separate
assignments and reporting without moving the original RHSA/TUPE modules. Future
source fixes must also be reviewed for the corresponding workshop copy.

The three advanced packages use a controlled single-host simulation. The service
is a background report worker running as `reportsvc`, not systemd or an HTTP
server. Faults are invalid PATH and incorrect input ownership/mode. Incident
scenarios add an unauthorized SSH key, broad sudo drop-in, and inert cron beacon
simulation, with synthetic authentication evidence. They do not execute malware
or contact outside hosts. The approved baseline is in `/workspace/asset-register.txt`.

Students investigate with sudo in the workspace, write `remediate.sh`, then run
`submit remediate.sh`. Grading starts from a clean container and runs the submitted
script twice. Interactive edits alone are not submitted. Structured findings are
created by the script. Automated marks cover actual state and findings; the
trainer assesses reasoning, evidence handling, and the incident timeline in the
debrief. This is a pilot workshop, not a claim of full incident-response certification.

## Build and release

From the question-bank repository, run:

```sh
venv/bin/python scripts/validate_repo.py
venv/bin/python -m unittest discover -s tests
venv/bin/python scripts/smoke-workshop.py
```

The workshop packages use `cyberrange/rhsa-base:0.7`, which includes SSH, cron,
sudo, and package tools. Rebuild/publish the trusted grading worker from the
updated bank, preserving the existing isolated worker deployment process.
An old deployed worker cannot resolve the new WS IDs.

From the CyberRange `backup` directory, build the student image:

```sh
backend/venv/bin/python scripts/build-workshop-workspace.py \
  --question-bank /path/to/linux-sysadmin-autograder
```

This creates `cyberrange/workshop-workspace:0.1` from the existing workspace image,
with practice-only setup scripts. Graders, references, and private metadata are
not copied. Provision a dedicated Fargate task definition using this image with
the existing SSH, resource limits, submission-token, and TTL conventions. Set
`WORKSHOP_WORKSPACE_TASK_DEFINITION` on the backend. Workshop starts deliberately
fail until this setting exists, avoiding a blank practice workspace.

Deploy the updated backend/frontend and set `SYSADMIN_QUESTION_BANK_ROOT` to the
updated bank. Register the catalog once (safe to repeat) from `backup/backend`:

```sh
venv/bin/python scripts/register_workshop.py
```

Registration creates a zero-priced workshop catalog and reporting rows only; it does not allocate seats,
charge accounts, or launch workspaces. Review marketplace pricing before portal
allocation. Workshop access always uses the existing portal assignment/purchase
checks. Assign `linux-security-workshop` to the workshop group through the admin
workflow. All twelve module IDs have their own progress records. A student has
one active terminal workspace slot shared with the Linux course; switching labs
replaces the previous workspace, so scripts must be saved before switching.

## Pre-workshop acceptance gates

Do these on the intended staging/deployment environment before advertising readiness:

- Create the 20–30 real participant accounts and workshop group; verify login.
- Verify assignment → workspace → practice state → submit → grade → report with
  a fresh participant account, including the advanced capstone.
- Verify an unassigned account cannot enter/start workshop labs, assignment expiry
  invalidates tokens, and the existing Linux course remains accessible as intended.
- Verify stop/start restores seeded state and previously accepted grades remain.
- Run 20–30 simultaneous starts and submissions, record failures and latency,
  and verify Fargate/vCPU limits, queue capacity, and available workshop hours.
- Give both trainers access to private reference solutions. Pre-stage the existing
  Puzzle System Hardening fallback with its own assignment/access. For a platform
  outage use printed evidence/debrief materials; an online fallback alone cannot
  address infrastructure failure.

These live cohort, cloud deployment, reset, and load gates are not proven by unit
tests or local container smoke tests. No production rollout or participant
account creation is performed by the preparation scripts automatically.

## Local validation completed

- All 12 workshop references earned 100/100 in fresh network-isolated containers.
- All three advanced scenarios reject no-op submissions at a second seed.
- All 12 student practice setups and the capstone entrypoint passed container tests.
- Student image `cyberrange/workshop-workspace:0.1` built locally; private graders
  and reference solutions are excluded from its generated build context.
- The workshop-only release passes 156 autograder tests, 49 backend Sysadmin tests, and workshop catalog
  tests, schema validation, and the frontend production build.
- Frontend build reports existing CSS/xterm warnings in unrelated components.

Repeat student image checks using `python3 scripts/smoke-workshop-workspace.py`.
Cloud publishing, catalog registration against a live database, participant access,
cohort load, and production reset/restart acceptance remain release gates.

## GitHub release branches

Application: `udhayakumar0307/Cyber_Range_Lab-`, branch
`codex/linux-security-workshop` (based on main including the newer asynchronous
workspace provisioning and terminal updates).

Question bank: `umadhatri/RHSA-question-bank`, branch
`codex/linux-security-workshop`. This branch deliberately excludes unfinished
DFIR lab and contract-v2 development from the local working directory.
Both branches must be released together before registering the workshop.
