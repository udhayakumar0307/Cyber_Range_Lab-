## Relevant Files

- `src/types/ctf.ts` - Extended data definitions for event status lifecycle (`upcoming`, `live`, `paused`, `concluded`), rate limits, max team size, custom rules markdown, and prize structures.
- `src/pages/admin/CtfAdminPage.tsx` - Admin CTF control hub enhanced with lifecycle buttons (`Start`, `Pause`, `Resume`, `Extend`, `End`) and full Multi-Section Event Configurator Wizard.
- `src/pages/user/CtfPortalPage.tsx` - Student CTF competition portal updated with event lifecycle badges and action routing.
- `src/pages/user/CtfArenaPage.tsx` - Interactive Jeopardy challenge arena updated with dynamic lifecycle status banners and flag submission lock/unlock logic.

---

### Notes

- Working directly on the `main` branch.
- Design strictly enforces PRD Light Theme palette:
  - Background: Soft Off-White (`#F8F9FA`)
  - Primary Blue: Security Authority (`#0052CC`)
  - Success Green: Live Active Event (`#28A745`)
  - Warning Orange: Paused Submissions (`#FFA500`)
  - Accent Purple: Extended Event Window (`#6F42C1`)
  - Text Primary: Dark Charcoal (`#2D3436`)

---

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

---

## Tasks

- [x] 0.0 Working on Main Branch
  - [x] 0.1 Confirm clean state and branch awareness on `main`

- [x] 1.0 Extend Data Schema Models in `src/types/ctf.ts`
  - [x] 1.1 Add `CtfEventStatus` type (`'upcoming' | 'live' | 'paused' | 'concluded'`).
  - [x] 1.2 Update `CtfEvent` interface to include `status: CtfEventStatus`, `maxTeamSize?: number`, `rateLimitAttempts?: number`, `rulesMarkdown?: string`, `prizes?: { rank: number; title: string; reward: string }[]`, and `extendedMinutes?: number`.

- [x] 2.0 Implement One-Click Lifecycle Action Controls in `src/pages/admin/CtfAdminPage.tsx`
  - [x] 2.1 Add status action toolbar to Active Event Highlight Banner and CTF Event Roster Table.
  - [x] 2.2 Implement `handleStartEvent(eventId)` action to transition event state to `live` and start competition timer.
  - [x] 2.3 Implement `handlePauseEvent(eventId)` and `handleResumeEvent(eventId)` actions to toggle submission lock state.
  - [x] 2.4 Implement `handleExtendEvent(eventId, minutes)` to append extra execution time (`+30m`, `+1h`, `+2h`).
  - [x] 2.5 Implement `handleEndEvent(eventId)` to force end the competition, lock flag processing, and finalize standings.

- [x] 3.0 Implement CTF Event Configuration Wizard Modal in `src/pages/admin/CtfAdminPage.tsx`
  - [x] 3.1 Build `CtfConfigWizardModal` supporting multi-section tabs: `General Metadata`, `Participation & Sizing`, `Scoring & Rate Limits`, `Rules & Guidelines`, and `Prize Breakdown`.
  - [x] 3.2 Add form inputs for Title, Description, Banner URL, Mode (Individual vs Team), Max Team Size slider (1–5 players), Scoring System (Static vs Dynamic), Rate Limits (attempts/min), Rules Markdown, and Prize rewards list.
  - [x] 3.3 Connect configuration state save handler to update event data dynamically.

- [x] 4.0 Update Student Arena & Portal for Lifecycle Reactivity
  - [x] 4.1 Update `src/pages/user/CtfPortalPage.tsx` to display active lifecycle status badges (`Live`, `Paused`, `Extended`, `Concluded`) on event cards.
  - [x] 4.2 Update `src/pages/user/CtfArenaPage.tsx` to render real-time state banners (`"Competition Paused by Admin — Submissions Locked"`, `"Event Extended by +1 Hour"`, `"Competition Concluded — Submissions Closed"`).
  - [x] 4.3 Lock flag submission input forms and submit buttons in `CtfArenaPage.tsx` when status is `paused` or `concluded`.

- [x] 5.0 Verification & Code Health Check
  - [x] 5.1 Execute `npm run build` to verify clean compilation with zero TypeScript errors.
