# Product Requirements Document (PRD): Real-Container Terminal Integration for Network Reconnaissance Lab (lab1-recon)

## 1. Introduction/Overview
Currently, the Network Reconnaissance Lab (`lab1-recon`) on the active website uses a simulated frontend shell in `ChallengeSession.tsx` that mimics command execution (like `nmap` and `cat`) using JavaScript regular expressions and local mock state. 

This document outlines the requirements to upgrade `lab1-recon` to use a real containerized terminal environment (similar to the interactive ssh-over-websocket terminal in the Puzzle lab), while retaining the manual flag submission input fields and the original multi-module instructional layout.

---

## 2. Goals
- **Real Command Execution**: Enable students to run real Linux, networking, and scanning commands (like `nmap`, `ftp`, `ssh`, `sys-helper`) inside a real, isolated Docker environment.
- **Retain Manual Submissions**: Retain the current module list layout, instructional guides, and manual flag validation input boxes.
- **Seamless Frontend Connection**: Replace the mocked frontend terminal state with a live xterm.js terminal instance bridging to the backend container over a WebSocket.
- **Preserve Lab Seed & Customization**: Support deterministic student seeds (`LAB_SEED`) for generating individualized flags inside the real container and validating them correctly on the backend.
- **Strict Student Isolation**: Ensure each student gets their own isolated subnet and container pair to avoid flag spoilers and scanning port conflicts.
- **Auto-healing Environments**: Implement an ephemeral resource model where environments are fresh-started on session creation/resume.

---

## 3. User Stories
1. **As a student**, I want to open the Network Reconnaissance Lab and see a live terminal where I can run real `nmap` scans against the vulnerable target network (`10.10.0.10`) instead of typing preset simulated commands.
2. **As a student**, I want to discover flags by interacting with real services (FTP server, MySQL database, SUID binaries) running on the target machine.
3. **As a student**, I want to copy the flags I find in the live terminal, paste them into the module input boxes on the webpage, and submit them for manual verification and score updates.
4. **As a teacher/administrator**, I want to ensure that students cannot bypass the exercise by typing static, pre-calculated flags in a simulated environment, but must instead perform the actual technical recon steps.

---

## 4. Functional Requirements

### 4.1. Backend & Provisioning (Docker SDK)
1. **Isolated Subnets**:
   - The backend must dynamically provision an isolated Docker bridge network (e.g., `lab1-net-<user_id>`) for each active student session using the Python Docker SDK.
2. **Container Life-Cycle Management (Option A: Ephemeral)**:
   - The backend must provision a fresh pair of containers for each active session:
     - **Student Workspace Container**: Built from `student-env/Dockerfile`. Contains the tools (nmap, ftp, netcat, etc.) and connects to the private network.
     - **Vulnerable Services Target Container**: Built from `vulnerable-services/Dockerfile`. Runs the target services at a fixed IP (e.g., `10.10.0.10`).
   - On session end (logout, expiration, or timeout), both containers and the custom bridge network must be stopped, removed, and cleaned up to free host resources.
   - Resuming a session spins up a brand-new container pair from original images (any modifications inside the workspace container are discarded; submitted flags are persisted in the PostgreSQL database).
3. **Deterministic Seed Initialization**:
   - The backend must inject the student's ID and deterministic `LAB_SEED` as environment variables into both containers upon startup.
4. **Terminal WebSocket Bridging**:
   - The backend must expose a WebSocket terminal route: `/api/v1/terminal/ws/lab1-recon?token=...`
   - This WebSocket must spawn a pseudo-terminal (PTY) session and redirect stdin/stdout of the active **Student Workspace Container** to the websocket.

### 4.2. Frontend Upgrade
1. **xterm.js Integration**:
   - Remove the mock shell execution engine and command history array currently defined in `ChallengeSession.tsx`.
   - Embed the `RealTerminal` component (reusing standard xterm.js and the fit addon) on the right side of the screen when `labId === 'lab1-recon'`.
2. **Manual Flag Submission Panels**:
   - Keep the existing sidebar navigation showing the 5 modules, description, objectives, and hints.
   - Retain the submission form inputs where the user enters and submits the flags.
   - On submitting a flag, query `/api/v1/recon/submit` to perform manual verification.

---

## 5. Non-Goals (Out of Scope)
- **Automatic In-Container Grading**: This PRD does not require the backend to monitor the student's command history or folder status to auto-advance levels. Progress only advances when the student manually submits the correct flag.
- **Removing Mock Fallbacks**: The mock terminal codebase can remain in the frontend code for local development/testing where Docker is not running, but it must be completely bypassed in production when connecting to a live session.

---

## 6. Technical Considerations

### 6.1. Backend API Updates (`recon_api.py` / `terminal_api.py`)
- Define helper functions to provision the network and containers programmatically using `docker.from_env()`.
- Bind the PTY directly to `/bin/bash` in the student workspace container, exposing it via the `/api/v1/terminal/ws/lab1-recon` WebSocket.

### 6.2. Network Routing
- Ensure that the student container can scan and ping `10.10.0.10` (the vulnerable target container), but has no path to external networks or the system host.

---

## 7. Success Metrics
- **Correct Validation**: Flags generated inside the target container's files (based on the deterministic seed) exactly match the expected flags validated by `/api/v1/recon/submit`.
- **Latency**: Terminal keystrokes and command outputs have sub-100ms roundtrip latency.
- **Resource Cleanup**: When a study session expires or is closed, both the student workspace and vulnerable target containers are successfully pruned.
