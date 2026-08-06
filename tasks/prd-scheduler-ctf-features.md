# PRD: Cyber Range Platform — Lab Scheduler & CTF Event Engine

## Document Metadata
- **Feature Name**: Automated Lab Scheduler & Full CTFd Competition Engine
- **Target Location**: `/tasks/prd-scheduler-ctf-features.md`
- **Design Alignment**: Adheres strictly to [prd-cyber-range-platform.md](file:///home/cyberrange/Desktop/CyberRange/prd-cyber-range-platform.md) (Light Theme, Indian Rupee `₹ INR` pricing, authority blues, success greens, and purple rankings).
- **Status**: Draft for User Review & Sign-Off

---

## 1. Introduction & Overview

This Product Requirements Document (PRD) defines two major capabilities for the Cyber Range Platform:

1. **Automated Lab Scheduler**: Enables administrators to define precise calendar deployment windows for security labs. Schedules handle automated container provisioning, email notification dispatches to targeted student cohorts, live session countdown timers, and automated container teardowns upon expiry.
2. **CTFd-Style Competition Engine**: Transforms the Cyber Range platform into a full-scale Jeopardy & Attack-Defense CTF competition platform. Participants and teams can compete in timed CTF events with category matrices (Pwn, Web, Crypto, Forensics, Reverse, OSINT), dynamic point decay models, hint unlocks with penalties, live scoreboard freeze capabilities, and admin competition operations.

Both modules seamlessly extend the existing light-themed design system and integrate cleanly into the top-level navigation layout for both Admin and Student roles.

---

## 2. Goals

1. **Automated Infrastructure Lifecycle**: Eliminate manual start/stop operations for scheduled training sessions by managing automated provisioning, cohort notification, and container cleanup.
2. **Flexible CTF Modes**: Support both **Individual Operators** and **Team-Based Competitions** with team registration, captain flag submissions, and team scoreboards.
3. **Advanced Scoring Options**: Offer both **Static Scoring** and **Dynamic Point Decay Scoring** (where point value automatically scales down as solve counts increase), along with admin-controlled **Scoreboard Freeze**.
4. **Cohesive Design System Compliance**: Guarantee that all new admin and user interfaces follow the PRD light-theme palette (`#F8F9FA` background, `#0052CC` primary blue, `#28A745` success green, `#6F42C1` accent purple, `#FFA500` warning orange, `#2D3436` charcoal text).
5. **Unified Admin Governance**: Provide admins with central management tabs (`📅 Lab Scheduler` and `🚩 CTF Event Hub`) for configuring events, tracking telemetry, and managing flag submissions.

---

## 3. User Stories

### Admin User Stories

**Story 1: Automated Lab Schedule Management**
- As an admin, I want to schedule lab sessions for specific dates, times, and durations so that infrastructure runs only when required.
- I can assign schedules to specific user groups or cohorts.
- The system automatically provisions lab instances at start time, notifies assigned users via email, and tears down resources at expiry.

**Story 2: CTF Competition Setup & Configuration**
- As an admin, I want to create and configure CTF events with customizable start/end times, participation rules (Individual vs. Team), and scoring modes (Static vs. Dynamic decay).
- I can create challenges across categories (Web, Pwn, Reverse, Crypto, Forensics, OSINT, Miscellaneous), specify flag patterns (`CTF{...}`), set hints, and configure initial/minimum point parameters.

**Story 3: Live CTF Operations & Scoreboard Freeze**
- As an admin, I want to monitor live submissions, inspect solve feeds, issue broadcast announcements to participants, and freeze the public scoreboard prior to competition conclusion to preserve suspense.

### Student / Participant User Stories

**Story 4: Scheduled Lab Access & Notifications**
- As a student, I want to view my upcoming scheduled labs with countdown clocks on my dashboard and receive email alerts 10 minutes prior to session commencement.

**Story 5: CTF Competition Portal & Category Grid**
- As a participant/team captain, I want to browse available CTF challenges in a Jeopardy-style category matrix, view challenge descriptions, download attached artifacts, and unlock hints.
- I can submit flags (`CTF{...}`) and receive instant feedback, points, and solve streak visual effects.

**Story 6: Real-Time CTF Leaderboard & Solves Graph**
- As a participant, I want to view live scoreboard rankings, team solve timelines, and dynamic point graphs tracking competition progress.

---

## 4. Functional Requirements

### 📅 Module 1: Automated Lab Scheduler (`/admin/scheduler`)

1. **Schedule Creation & Calendar Modal**:
   - Admins can create schedules selecting: Target Lab(s), Target Cohort/Group, Start Date & Time, End Date & Time, Auto-Provisioning toggle, and Email Reminder toggle (e.g. 10m before start).
2. **Schedule Management Dashboard**:
   - Tabular and Calendar views showing upcoming, active, and completed schedules.
   - Status badges: `Upcoming` (Gray), `Provisioning` (Yellow Pulse), `Live / Active` (Green), `Teardown In Progress` (Orange), `Completed` (Blue).
   - Quick action controls: Edit Schedule, Force Start Now, Extend Session (+15m / +1h), and Immediate Teardown.
3. **Automated Provisioning & Teardown Trigger**:
   - Background lifecycle runner evaluating active schedules, launching lab instances, and triggering automated teardown routines at expiration.
4. **Student Dashboard Schedule Widgets**:
   - Live countdown clocks on student dashboards showing upcoming and active allocated windows with one-click "Launch Workspace" routing when live.

---

### 🚩 Module 2: CTFd-Style Competition Engine

#### 2.1 Admin CTF Control Hub (`/admin/ctf`)

5. **Competition Management**:
   - Event creation wizard: Title, Banner/Logo, Description, Mode Selector (`Individual` vs `Team`), Scoring System (`Static` vs `Dynamic Decay`), Start/End Timestamps, and Public Visibility toggle.
6. **Challenge Bank Manager**:
   - Form for adding/editing challenges: Title, Category (Web, Pwn, Reverse, Crypto, Forensics, OSINT, Misc), Description (Markdown supported), Attachments/Links, Flag string (Exact or Regex match), Base Points, Minimum Points, and Decay Rate (solves parameter).
   - Hint Manager: Text description, Unlock Cost (Point penalty), and Hide/Show state.
7. **Live Operations & Scoreboard Controls**:
   - **Scoreboard Freeze Toggle**: Admin button to freeze public scoreboard updates at a custom timestamp before event end.
   - **Broadcast Announcement System**: Modal to push real-time pop-up notices to all connected CTF participants.
   - **Submission Logs & Manual Overrides**: Real-time audit log of all flag attempts (Correct, Incorrect, Rate-limited) with ability for admins to manually reward or invalidate points.

#### 2.2 Student CTF Participant Portal (`/ctf` & `/ctf/events/:eventId`)

8. **CTF Event Hub Page (`/ctf`)**:
   - Event cards highlighting active, upcoming, and archived CTF competitions with countdown timers and "Enter Event" actions.
9. **Team Management Portal (when Mode = Team)**:
   - Team creation flow (Team Name, Access Code, Captain tag), Team Join modal (via 6-digit Invite Code), and Team Roster management.
10. **Jeopardy Category Matrix Layout (`/ctf/events/:eventId/challenges`)**:
    - Filterable category grid displaying challenge cards grouped by domain (Web Exploitation, Binary Exploitation, Cryptography, Reverse Engineering, Digital Forensics).
    - Solved status visual badges (Green Checkmark for Solved, Point Value tags, Solved Count indicator).
11. **Interactive Challenge Details Modal**:
    - Markdown instructions renderer, downloadable file assets list, hint unlock modal with points penalty warning, Flag Submission input box, and real-time validation response banner (Pass / Fail / Already Solved).
12. **CTF Leaderboard & Solve Progress (`/ctf/events/:eventId/scoreboard`)**:
    - Side-by-side view featuring:
      - **Interactive Multi-Line Solve Chart**: SVG timeline graph plotting score progress over time for top teams/individuals.
      - **Standings Table**: Rank, Participant/Team Name, Solves breakdown badge grid, Total Points, and Last Solve Timestamp.
    - **Scoreboard Freeze Indicator**: Distinct banner notification displayed to participants when the admin has frozen standings.

---

## 5. Non-Goals (Out of Scope)

- **Third-Party CTFd API Sync**: We will build native, clean React components and state rather than wrapping external CTFd embeds or iFrames.
- **Physical Hardware/Hardware CTF**: Wireless/SDR or physical device control (software/virtual lab challenges only).
- **Payment for CTF Entry**: CTF participation is included within platform user/group access.

---

## 6. Design & Aesthetics Considerations

All new pages must conform to the **PRD Light Theme Design System**:

| Design Token | Value | Applied UI Component |
|---|---|---|
| **Background Light** | `#F8F9FA` | Page canvas, empty states, and card background soft fills |
| **Primary Blue** | `#0052CC` | Primary buttons, Active CTF tab navigation, CTF banners |
| **Success Green** | `#28A745` | Solved challenge badges, active scheduled lab indicators |
| **Warning Orange** | `#FFA500` | Hint penalties, pending teardown warnings, urgent alerts |
| **Accent Purple** | `#6F42C1` | CTF Category pills, Leaderboard ranks, podium gold/purple cards |
| **Neutral Dark** | `#2D3436` | Primary high-contrast body typography & headers |

---

## 7. Technical Architecture & Routing

### New Frontend Routes

#### Admin Routes
- `/admin/scheduler` – Lab Scheduler & Automated Infrastructure Windows
- `/admin/ctf` – CTF Competition Manager & Challenge Bank Hub
- `/admin/ctf/events/:eventId/edit` – Event & Challenge Configuration Editor

#### Student Routes
- `/ctf` – CTF Competition Portal Home (Events List)
- `/ctf/events/:eventId` – Competition Arena (Jeopardy Matrix Grid & Challenge Modals)
- `/ctf/events/:eventId/scoreboard` – Live Scoreboard & Solves Progress Visualizer

### File Placement Checklist
- `src/pages/admin/LabSchedulerPage.tsx`
- `src/pages/admin/CtfAdminPage.tsx`
- `src/pages/user/CtfPortalPage.tsx`
- `src/pages/user/CtfArenaPage.tsx`
- `src/pages/user/CtfScoreboardPage.tsx`
- `src/types/scheduler.ts` & `src/types/ctf.ts`
- `src/components/admin/AdminSidebar.tsx` (Update with Scheduler & CTF navigation items)

---

## 8. Success Metrics

1. **Zero Manual Downtime Overhead**: 100% of scheduled labs initiate and tear down automatically based on calendar rules.
2. **CTF Submission Velocity**: Real-time flag validation feedback rendered within <200ms.
3. **Comprehensive Coverage**: Full support for both individual and team CTF modes with dynamic point decay options.
4. **Clean Design Consistency**: Zero light-theme violations or unstyled elements across mobile, tablet, and desktop viewports.

---

## 9. Open Questions & Approvals

1. **Ready for Implementation Task Breakdown?**
   - Once approved, we will update `webpage-inventory.md` and create `tasks/tasks-scheduler-ctf.md` following the task creation workflow.

---
*Document prepared for Cyber Range Platform Frontend Engineering Team.*
