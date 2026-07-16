## Relevant Files

- `src/types/scheduler.ts` - TypeScript interfaces for lab scheduling windows, cohort assignments, auto-provisioning triggers, and state models.
- `src/types/ctf.ts` - Data definitions for CTF events, Jeopardy challenge categories, flag submission logs, dynamic scoring formulas, and team rosters.
- `src/pages/admin/LabSchedulerPage.tsx` - Admin schedule management portal with calendar overview, window creation dialogs, and instant force start / teardown triggers.
- `src/pages/admin/CtfAdminPage.tsx` - Admin CTF control hub for competition lifecycle, challenge bank builder, broadcast announcement manager, and scoreboard freeze controls.
- `src/pages/user/CtfPortalPage.tsx` - Student CTF competition hub for active/upcoming event listings, team registration, and roster setup.
- `src/pages/user/CtfArenaPage.tsx` - Interactive Jeopardy challenge matrix displaying domain categories, flag submit forms, asset downloads, and hint unlock options.
- `src/pages/user/CtfScoreboardPage.tsx` - Live CTF competition scoreboard featuring interactive multi-line SVG solve progression graphs and frozen state alerts.
- `src/components/admin/AdminSidebar.tsx` - Updated Admin navigation bar equipped with `📅 Lab Scheduler` and `🚩 CTF Event Hub` links.
- `src/components/user/UserSidebar.tsx` - Updated Student navigation bar equipped with `🚩 CTF Portal` link.
- `src/App.tsx` - Router wiring for all newly introduced Admin and Student CTF/Scheduler routes.

---

### Notes

- Working directly on the `main` branch.
- Design strictly enforces PRD Light Theme palette:
  - Background: Soft Off-White (`#F8F9FA`)
  - Primary Blue: Security Authority (`#0052CC`)
  - Success Green: Passed/Active (`#28A745`)
  - Warning Orange: Alerts/Teardown warnings (`#FFA500`)
  - Accent Purple: Ranks/Podiums/Categories (`#6F42C1`)
  - Text Primary: Dark Charcoal (`#2D3436`)

---

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

---

## Tasks

- [ ] 0.0 Working on Main Branch
  - [ ] 0.1 Confirm clean state and branch awareness on `main`

- [ ] 1.0 Create Schema Models & Interfaces
  - [ ] 1.1 Create `src/types/scheduler.ts` containing interfaces for `ScheduleItem`, `ScheduleStatus`, `ScheduleCreationPayload`, and `ScheduleFilter`.
  - [ ] 1.2 Create `src/types/ctf.ts` containing interfaces for `CtfEvent`, `CtfChallenge`, `CtfCategory`, `CtfSubmission`, `CtfTeam`, and `CtfScoreboardEntry`.

- [ ] 2.0 Implement Admin Automated Lab Scheduler (`/admin/scheduler`)
  - [ ] 2.1 Build `src/pages/admin/LabSchedulerPage.tsx` featuring statistics summary header (Active Schedules, Next Auto-Start, Teardown Windows).
  - [ ] 2.2 Create interactive Calendar & Schedule Roster Table views with status badges (`Upcoming`, `Provisioning`, `Live`, `Expiring`, `Completed`).
  - [ ] 2.3 Build `ScheduleCreateModal` allowing admins to pick target labs, assigned groups, start/end dates & times, auto-teardown options, and reminder notifications.
  - [ ] 2.4 Add quick action control triggers: `Force Start`, `Extend Window (+15m / +1h)`, and `Immediate Teardown`.

- [ ] 3.0 Implement Admin CTF Event Hub & Challenge Manager (`/admin/ctf`)
  - [ ] 3.1 Build `src/pages/admin/CtfAdminPage.tsx` featuring competition management dashboard, active event controls, and live submission log feed.
  - [ ] 3.2 Add **Scoreboard Freeze** control toggle and **Real-Time Broadcast Announcement** modal.
  - [ ] 3.3 Build `CtfChallengeModal` allowing admins to create/edit challenges across categories (Web, Pwn, Crypto, Forensics, Reverse, OSINT), set initial points, minimum points, decay rates, flag solutions (`CTF{...}`), and hint penalty costs.

- [ ] 4.0 Implement Student CTF Portal & Team Setup (`/ctf`)
  - [ ] 4.1 Build `src/pages/user/CtfPortalPage.tsx` showcasing active, upcoming, and archived CTF event cards with live ticking countdown clocks.
  - [ ] 4.2 Build `TeamRegistrationModal` supporting team creation (Team Name, Invite Code, Captain Tag) and joining via 6-digit access code.

- [ ] 5.0 Implement Interactive Jeopardy Challenge Arena (`/ctf/events/:eventId`)
  - [ ] 5.1 Build `src/pages/user/CtfArenaPage.tsx` featuring Jeopardy-style category columns (Web, Pwn, Crypto, Reverse, Forensics, OSINT).
  - [ ] 5.2 Build `ChallengeDetailsModal` displaying challenge description (Markdown), asset attachments, hint reveal confirmation (with point penalty warnings), and flag submission box (`CTF{...}`).
  - [ ] 5.3 Implement instant flag validation feedback banner with score animation, solved badge transitions, and streak counters.

- [ ] 6.0 Implement CTF Scoreboard & Progression Visualizer (`/ctf/events/:eventId/scoreboard`)
  - [ ] 6.1 Build `src/pages/user/CtfScoreboardPage.tsx` with top-3 gold/silver/bronze champion podium cards.
  - [ ] 6.2 Render an interactive multi-line SVG score trajectory graph tracking points over time for competing teams and individual operators.
  - [ ] 6.3 Implement CTF standings table with detailed category solve badge breakdowns and a **Scoreboard Freeze** notification banner when active.

- [ ] 7.0 Navigation Sidebar & Route Wiring Integration
  - [ ] 7.1 Update `src/components/admin/AdminSidebar.tsx` to include navigation links for `📅 Lab Scheduler` (`/admin/scheduler`) and `🚩 CTF Event Hub` (`/admin/ctf`).
  - [ ] 7.2 Update `src/components/user/UserSidebar.tsx` to include `🚩 CTF Portal` (`/ctf`).
  - [ ] 7.3 Wire all new routes in `src/App.tsx` and verify seamless navigation across both Admin and Student portals.
  - [ ] 7.4 Verify clean build via `npm run build`.
