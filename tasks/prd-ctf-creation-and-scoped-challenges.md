# PRD: Cyber Range Platform — CTF Competition Creator & Scoped Challenge Bank Engine

## Document Metadata
- **Feature Name**: Standalone CTF Event Creation Wizard & Per-Event Scoped Challenge Management with Challenge Cloning
- **Target Location**: `/tasks/prd-ctf-creation-and-scoped-challenges.md`
- **Design Alignment**: Adheres strictly to [prd-cyber-range-platform.md](file:///home/cyberrange/Desktop/CyberRange/prd-cyber-range-platform.md) (Light Theme palette: `#F8F9FA` background, `#0052CC` primary blue, `#28A745` success green, `#6F42C1` accent purple, `#FFA500` warning orange, `#2D3436` dark charcoal).
- **Status**: Draft for User Review & Sign-Off

---

## 1. Introduction & Overview

This Product Requirements Document (PRD) introduces two core operational capabilities for the **CTFd Competition Hub** on the Cyber Range Platform:

1. **Standalone CTF Event Creation Wizard**: A prominent **"➕ Create New CTF Event"** workflow enabling administrators to launch brand-new CTF competitions with multi-step validation (Metadata → Team Sizing & Mode → Scoring & Rate Limits → Rules & Prizes).
2. **Scoped Per-CTF Challenge Management & Cloning Engine**: Provides strict event-scoped challenge management. Admins can filter challenge banks by specific CTF events, open dedicated challenge managers for any competition, assign newly created challenges to target events, and **clone existing challenges** across competitions for rapid setup.

---

## 2. Goals

1. **Seamless Event Provisioning**: Allow admins to initialize and publish new CTF events from scratch in under 2 minutes.
2. **Strict Event-Scoped Challenge Mapping**: Guarantee every challenge is explicitly linked to its parent CTF event with clear filtering and per-competition management controls.
3. **Challenge Cloning Efficiency**: Enable administrators to copy/clone existing challenges (with flags, hints, and point parameters) into another CTF event with one click.
4. **Design System & Architectural Consistency**: Maintain adherence to the PRD Light Theme palette and seamlessly integrate controls into `/admin/ctf`.

---

## 3. User Stories

### Admin User Stories

**Story 1: Create Brand New CTF Competition**
- As an admin, I want to click a "Create New CTF Event" button to open a 4-step wizard where I can define all metadata, sizing rules, scoring models, rate limits, rules, and prizes, and publish a new CTF event to the platform.

**Story 2: Scope and Manage Challenges per CTF Event**
- As an admin, I want to filter the Challenge Bank by selecting a specific CTF event from a global dropdown, or click "Manage Challenges" directly on a competition card/row to view and edit only the challenges belonging to that CTF.

**Story 3: Assign Target CTF Event to New Challenges**
- As an admin, when adding a new challenge, I want to pick the exact target CTF event from a dropdown so it maps correctly to the intended competition.

**Story 4: Clone Existing Challenges Across Events**
- As an admin, I want to click a "Clone Challenge" action on an existing challenge card to duplicate it into another CTF competition without re-entering all instructions, flags, and hints.

---

## 4. Functional Requirements

### ➕ Module 1: CTF Event Creation Wizard Modal (`/admin/ctf`)

1. **Wizard Activation**:
   - Prominent **"➕ Create New CTF Event"** button on `/admin/ctf` opening a 4-step wizard dialog.
2. **Step 1: General Metadata**:
   - Inputs for Title, Tagline, Description, Banner Image URL, and Public Visibility toggle.
3. **Step 2: Participation & Sizing**:
   - Mode Selector (`Individual Operators` vs `Team Competition`), Max Team Size slider (1–5 players), and Invite Code requirement toggle.
4. **Step 3: Scoring Mechanics & Security**:
   - Scoring Model (`Static Fixed Points` vs `Dynamic Point Decay`), Base Points, Minimum Points, Decay Solves multiplier, and Flag Attempt Rate Limit (e.g. 5 attempts/min per player/team).
5. **Step 4: Rules & Prize Breakdown**:
   - Code of Conduct Markdown editor and Prize rewards list for Gold (1st), Silver (2nd), and Bronze (3rd) podium ranks.
6. **Publication**:
   - "Publish Competition" button that appends the new event to the active roster in `upcoming` status.

---

### 🎯 Module 2: Scoped Per-CTF Challenge Management & Cloning

7. **Global CTF Event Filter Dropdown**:
   - Filter dropdown at top of Challenge Bank tab (`"Filter by CTF Event: All Events / Event A / Event B"`).
8. **Direct Per-Event Challenge Manager**:
   - **"Manage Challenges (X)"** action button on each CTF event card and row in the competitions list that pre-filters the Challenge Bank view specifically to that CTF event.
9. **Target CTF Event Selector in Challenge Creator**:
   - Dropdown selector inside the "Add CTF Challenge" modal allowing admins to pick which CTF competition receives the challenge.
10. **Challenge Cloning Engine**:
    - **"Clone Challenge"** action button on challenge cards that opens a "Clone to Target CTF Event" modal, allowing rapid duplication of title, category, description, flag, hints, and point values into another CTF event.

---

## 5. Non-Goals (Out of Scope)

- Bulk CSV import of CTF challenges (future phase).

---

## 6. Design & Aesthetics Considerations

All modal wizards and filtering dropdowns must conform to the **PRD Light Theme Design System**:
- Canvas background: `#F8F9FA`
- Primary Blue trigger buttons: `#0052CC`
- Accent Purple CTF badges: `#6F42C1`
- Success Green status indicators: `#28A745`

---

## 7. Success Metrics

1. **Creation Speed**: Admins can initialize and publish a new CTF competition in under 2 minutes.
2. **Cloning Speed**: Challenges can be duplicated across competitions in under 5 seconds with zero lost parameters.

---

## 8. Document Approvals

- **Status**: Ready for implementation task breakdown (`tasks/tasks-ctf-creation-and-scoped-challenges.md`).
