## Relevant Files

- `src/pages/admin/CtfAdminPage.tsx` - Primary file for all new CTF event creation, scoped challenge management, and cloning functionality.
- `src/types/ctf.ts` - Data schema, already has `CtfEventStatus`, `CtfEvent`, and `CtfChallenge` interfaces needed.
- `tasks/prd-ctf-creation-and-scoped-challenges.md` - Source PRD for this implementation.

---

### Notes

- Working directly on the `main` branch.
- All new CTF events are created in `upcoming` status by default.
- Challenge cloning duplicates: title, category, description, flag, hints, and point parameters.
- Design strictly enforces PRD Light Theme palette:
  - Background: `#F8F9FA`
  - Primary Blue: `#0052CC`
  - Success Green: `#28A745`
  - Warning Orange: `#FFA500`
  - Accent Purple: `#6F42C1`
  - Text Primary: `#2D3436`

---

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

---

## Tasks

- [x] 0.0 Working on Main Branch
  - [x] 0.1 Confirm clean state on `main` and review existing `CtfAdminPage.tsx` implementation.

- [x] 1.0 Update State Management in `src/pages/admin/CtfAdminPage.tsx`
  - [x] 1.1 Confirm `events` and `challenges` are managed via `useState` (already done — verify).
  - [x] 1.2 Add `selectedEventFilter` state (`'all' | string`) for Challenge Bank filtering.
  - [x] 1.3 Derive `filteredChallenges` from `challenges` using `selectedEventFilter` and pass into Challenge Bank grid.

- [x] 2.0 Implement 4-Step "Create New CTF Event" Wizard Modal
  - [x] 2.1 Add **"➕ Create New CTF Event"** button to the top action bar in `CtfAdminPage.tsx`.
  - [x] 2.2 Create `isCreateEventWizardOpen` boolean state and `createWizardStep` state (`1 | 2 | 3 | 4`).
  - [x] 2.3 Build **Step 1 — General Metadata**: Title, Tagline, Description, Banner Image URL, Start/End datetime inputs, and Public Visibility toggle.
  - [x] 2.4 Build **Step 2 — Participation & Sizing**: Mode selector (`Individual` vs `Team`), Max Team Size slider (1–5 players), and Access Code toggle.
  - [x] 2.5 Build **Step 3 — Scoring & Rate Limits**: Static vs Dynamic scoring selector, Base Points, Minimum Points, and Flag Rate Limit (attempts/min) inputs.
  - [x] 2.6 Build **Step 4 — Rules & Prizes**: Markdown textarea for Code of Conduct rules + Prize Breakdown inputs for Gold, Silver, and Bronze ranks.
  - [x] 2.7 Implement step navigation controls: `Back` and `Next` buttons with form validation per step, and a final `Publish Competition` submit button on Step 4.
  - [x] 2.8 On submission, append the new `CtfEvent` object (with `status: 'upcoming'`, a generated `id`, and `totalChallenges: 0`) to the `events` state array.

- [x] 3.0 Implement Scoped Challenge Management (Filter Dropdown + Per-Event Button)
  - [x] 3.1 Add a **"Filter by CTF Event"** `<select>` dropdown at the top of the Challenge Bank tab, populating options from the current `events` array plus an `"All Events"` default.
  - [x] 3.2 Wire the dropdown `onChange` to `setSelectedEventFilter` to drive challenge list filtering.
  - [x] 3.3 Add a **"Manage Challenges (X)"** button to each event row in the CTF Competitions roster table that sets `selectedEventFilter` to that event's ID and switches `activeTab` to `'challenges'`.

- [x] 4.0 Add "Target CTF Event" Dropdown to Challenge Creator Modal
  - [x] 4.1 Add a `newChallengeEventId` state initialized to the first event's ID.
  - [x] 4.2 Add a **"Target CTF Event"** `<select>` dropdown inside the existing "Add CTF Challenge" modal populated from the `events` array.
  - [x] 4.3 Wire `newChallengeEventId` to the created challenge's `eventId` field on submission.

- [x] 5.0 Implement Challenge Cloning Engine
  - [x] 5.1 Add a **"Clone"** icon button to each challenge card in the Challenge Bank grid.
  - [x] 5.2 Create `isCloneModalOpen` boolean state and `challengeToClone` state (`CtfChallenge | null`).
  - [x] 5.3 Build **Clone Challenge Modal**: Display source challenge title and category, and show a `<select>` dropdown of all available CTF events as the clone target.
  - [x] 5.4 On confirmation, create a duplicate `CtfChallenge` object (new unique `id`, new `eventId` from target selection, `isSolved: false`, `solveCount: 0`, all other fields copied) and append to `challenges` state.

- [x] 6.0 Verification & Commit
  - [x] 6.1 Execute `npm run build` to verify zero TypeScript compilation errors. ✅ PASSED
  - [x] 6.2 Commit and push all changes to `main` with message `feat: add CTF event creation wizard and scoped challenge management`.
