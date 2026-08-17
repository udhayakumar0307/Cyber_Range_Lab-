## Relevant Files

- `backend/app/api/v1/endpoints/terminal_api.py` - WebSocket route handler for bridging the browser xterm console to a Docker container shell session.
- `backend/app/api/v1/endpoints/recon_api.py` - API route for flag submission verification, seed progress evaluation, and database score logging.
- `src/pages/user/ChallengeSession.tsx` - Frontend React layout containing the modules sidebar and terminal interface.
- `src/components/RealTerminal.tsx` - Frontend terminal component using xterm.js and FitAddon to establish the websocket bridge.

### Notes

- Unit and endpoint tests can be executed on the backend with: `pytest backend/app/tests/` or running specific files.
- The React frontend dev server should be run locally using `npm run dev` to verify the xterm socket connection.
- Ensure that Python dependencies like `docker` are installed on the backend workspace.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Ensure on main branch
  - [x] 0.1 Pull the latest updates and ensure you are working directly on the main branch
- [x] 1.0 Docker SDK Container & Network Provisioning (Backend)
  - [x] 1.1 Implement helper functions using the Docker SDK to dynamically create an isolated bridge subnet (`lab1-net-<user_id>`) for each student session.
  - [x] 1.2 Implement logic to build/verify local images and spawn two fresh containers: `lab1-student-<user_id>` (student workspace) and `lab1-target-<user_id>` (vulnerable target environment).
  - [x] 1.3 Programmatically inject the student email/ID and the session-specific `LAB_SEED` environment variables into both containers.
  - [x] 1.4 Implement strict cleanup routines to prune both containers and their custom bridge networks immediately when the study session ends or logs out.
- [x] 2.0 WebSocket Terminal API & Bridging Route (Backend)
  - [x] 2.1 Update the `/api/v1/terminal/ws/{lab_id}` WebSocket endpoint to support `lab1-recon` requests.
  - [x] 2.2 Configure the route to identify and connect to the user-specific `lab1-student-<user_id>` container.
  - [x] 2.3 Bridge the websocket payload stream directly to a live Linux PTY executing `/bin/bash` in the workspace container.
- [x] 3.0 RealTerminal Component Integration in Challenge Session (Frontend)
  - [x] 3.1 Import the `RealTerminal` component inside `ChallengeSession.tsx`.
  - [x] 3.2 Replace the simulated in-memory command interpreter with `<RealTerminal labId="lab1-recon" />` when `labId === 'lab1-recon'`.
  - [x] 3.3 Wire the JWT `token` from `useAuth()` into `RealTerminal` so the WS authenticates correctly against the backend.
  - [x] 3.4 Add provision/teardown lifecycle: call `POST /recon/provision` on lab mount, `POST /recon/teardown` on unmount; show status in terminal header badge.
  - [x] 3.5 Remove simulated objective-tick gate for recon flag submission — students submit flags they find in the live terminal, not fake commands.
  - [x] 3.6 Retain the manual flag input forms, modules list, and hints sections in the left sidebar layout.
- [x] 4.0 End-to-End Integration, Flag Validation, & Pruning Tests (Testing)
  - [x] 4.1 Perform end-to-end local testing to ensure starting a session provisions the Docker container pair correctly.
  - [x] 4.2 Validate flags seeded in target container match expected deterministic format and land in correct locations (FTP, DB, filesystem).
  - [x] 4.3 Confirm student container can reach target via nmap and FTP (0% packet loss ping, ports 21/22/80/3306/8888 open).
  - [x] 4.4 Confirm teardown removes all containers and the isolated bridge network cleanly (no lab1 resources remaining).
  - [x] 4.5 Verify that pasting and submitting flags via the UI triggers the correct database scoring reconciliation.
