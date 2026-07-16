# PRD: Cyber Range Platform — Admin CTF Lifecycle & Event Configuration Engine

## Document Metadata
- **Feature Name**: Admin CTF Event Lifecycle Controls & Event Configuration Wizard
- **Target Location**: `/tasks/prd-ctf-lifecycle-management.md`
- **Design Alignment**: Adheres strictly to [prd-cyber-range-platform.md](file:///home/cyberrange/Desktop/CyberRange/prd-cyber-range-platform.md) (Light Theme palette: `#F8F9FA` background, `#0052CC` primary blue, `#28A745` success green, `#6F42C1` accent purple, `#FFA500` warning orange, `#2D3436` dark charcoal).
- **Status**: Draft for User Review & Sign-Off

---

## 1. Introduction & Overview

This PRD extends the existing **CTFd Competition Hub** by adding complete **Admin Event Lifecycle Controls** and a full-featured **CTF Competition Configuration & Creation Wizard**.

Administrators can now launch, pause, resume, extend, or end CTF events in real-time, as well as configure event parameters including participation modes, max team sizes, dynamic point decay rates, rate limits, custom rules markdown, and prize structures. Participants in the competition arena will experience real-time status banners and dynamic submission lock/unlock behavior based on active event states.

---

## 2. Goals

1. **Full Operational Authority**: Grant administrators direct one-click control over CTF event lifecycles (`Start Now`, `Pause Submissions`, `Resume`, `Extend Window`, `Force End`).
2. **Comprehensive Competition Customization**: Provide a multi-section Configuration Wizard for configuring event metadata, team sizing, scoring mechanics, rate limiting, competition rules, and prize cards.
3. **Real-Time Participant Arena Reactivity**: Dynamically adapt participant flag submission UI (`/ctf/events/:eventId`) to active lifecycle states (`Live`, `Paused`, `Extended`, `Concluded`).
4. **Design System & Architectural Consistency**: Maintain adherence to the PRD Light Theme palette and seamlessly integrate controls into `/admin/ctf`.

---

## 3. User Stories

### Admin User Stories

**Story 1: CTF Event Creation & Configuration**
- As an admin, I want to create a new CTF event or edit an existing competition with custom metadata, team size constraints, scoring mechanisms, rules, and prize lists.

**Story 2: Real-Time Lifecycle Control**
- As an admin, I want to start a CTF competition ahead of time, pause flag submissions during emergency maintenance, resume when ready, extend duration by custom increments (+30m, +1h, +2h), or force end the competition.

### Student / Participant User Stories

**Story 3: Real-Time Event Status Adaptation**
- As a participant, I want to clearly see if a CTF competition is currently `Upcoming`, `Live`, `Paused`, `Extended`, or `Concluded`, with explicit feedback when flag submissions are locked during pause or after event conclusion.

---

## 4. Functional Requirements

### 🎛️ Module 1: Admin CTF Lifecycle & Event Configurator (`/admin/scheduler` & `/admin/ctf`)

1. **Lifecycle Control Panel (Active Banner & Roster Table)**:
   - Status indicators: `Draft / Upcoming` (Blue), `Live & Active` (Green Pulse), `Paused / Locked` (Amber), `Extended` (Purple Badge), `Concluded` (Gray).
   - Lifecycle Action Triggers:
     - **Start Competition Now**: Moves status to `Live`, initializes competition clocks, and unlocks submission forms.
     - **Pause Submissions**: Freezes flag submission processing, locks input fields for participants, and displays an admin pause banner.
     - **Resume Submissions**: Restores active submission processing and removes pause banners.
     - **Extend Event (+30m / +1h / +2h)**: Appends time to event `endTime` and notifies active competitors via real-time banners.
     - **Force End Competition**: Concludes competition, finalizes standings, and locks all flags permanently.

2. **CTF Competition Configuration Wizard Modal**:
   - **Basic Metadata**: Event Title, Tagline, Description, Banner Image URL, Public Visibility toggle.
   - **Participation Rules**: Mode Selector (`Individual Operators` vs `Team Competition`), Max Team Size (1–5 players limit), Access Code requirement toggle.
   - **Scoring & Security Mechanics**: Scoring System (`Static Points` vs `Dynamic Decay Rate`), Base Points, Minimum Points, Solves Decay Multiplier, Flag Attempt Rate Limiting (e.g. max 5 attempts/minute per team).
   - **Custom Rules & Information**: Markdown textarea for formatting event guidelines, code of conduct, and prohibited techniques.
   - **Prize Pool & Awards Breakdown**: List items for 1st, 2nd, and 3rd place reward descriptions (e.g. Certificate, Voucher, Badge).

---

### 🚩 Module 2: Participant Arena Real-Time Lifecycle Reactivity (`/ctf/events/:eventId`)

3. **Dynamic Lifecycle Banners**:
   - **Paused State**: Banner displaying *"Competition Temporarily Paused by Admin — Flag Submissions Locked"*, disabling submission text inputs and buttons.
   - **Extended State**: Banner displaying *"Event Extended by Admin (+X mins remaining)"* with updated countdown clocks.
   - **Concluded State**: Banner displaying *"Competition Concluded — Submissions Closed"*, displaying final rank summaries.

---

## 5. Non-Goals (Out of Scope)

- Automated payment gateway payout for prize pools (display/announcement only).

---

## 6. Design & Aesthetics Considerations

| Status Token | Color Code | Representation |
|---|---|---|
| **Live Competition** | `#28A745` (Success Green) | Active event, live submission processing |
| **Paused Submissions** | `#FFA500` (Warning Orange) | Submissions temporarily locked by Admin |
| **Event Extended** | `#6F42C1` (Accent Purple) | Duration extended beyond original deadline |
| **Event Concluded** | `#2D3436` (Dark Charcoal) | Competition ended, final scores locked |

---

## 7. Success Metrics

1. **Instant State Transition**: State changes (Start, Pause, Resume, Extend, Stop) reflect immediately across Admin and Participant UI.
2. **Zero Form Discrepancy**: Flag submission inputs cleanly lock/unlock in exact synchronization with competition status.

---

## 8. Document Approvals

- **Status**: Ready for implementation task generation (`tasks/tasks-ctf-lifecycle-management.md`).
