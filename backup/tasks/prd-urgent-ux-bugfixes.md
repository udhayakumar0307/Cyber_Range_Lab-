# PRD: Urgent UX Bug Fixes — Cyber Range Platform

## Introduction / Overview

This PRD covers **7 urgent bug fixes** identified in the Cyber Range student portal that degrade user experience, expose proprietary content, and present unfinished features. These fixes address broken navigation, incorrect scoring, content protection, and UI cleanup across the student-facing frontend and backend APIs.

**Priority:** Urgent — ship within 1–2 days  
**Branch Policy:** All changes commit directly to `main`

---

## Goals

1. **Fix broken/dead UI elements** — Remove the non-functional "View Handbook" button that confuses users
2. **Correct post-login navigation** — Students must always land on their Dashboard, not the lab marketplace
3. **Fix score accuracy** — Puzzle level completions must correctly reflect on the user's profile and stats
4. **Hide incomplete features** — CTF Competitions section must be completely hidden until the feature is ready
5. **Protect proprietary content** — Study materials must be view-only in a secure PDF viewer with no download capability
6. **Remove redundant UX friction** — Eliminate the double pop-up on puzzle level advancement

---

## User Stories

**Story 1: Dashboard as Home Base**
- As a student, when I log in, I want to land on my Dashboard so I can see my stats, progress, and quick actions — not be pushed to buy more labs.

**Story 2: Accurate Score Tracking**
- As a student who completed 3 puzzle levels, I want my profile to accurately reflect my puzzle scores and completed levels so I can track my progress.

**Story 3: Clean Navigation**
- As a student, I don't want to see buttons that don't work ("View Handbook") or menu items for features that aren't ready (CTF Competitions).

**Story 4: Secure Study Materials**
- As an instructor/admin, I want study materials to be viewable online only — students should not be able to download or screenshot proprietary PDFs.

**Story 5: Smooth Puzzle Flow**
- As a student solving puzzle levels, when I complete a level and advance, I want a single clean confirmation — not two pop-ups in sequence asking the same thing.

---

## Functional Requirements

### FR-1: Remove "View Handbook" Button

**Current behavior:** The User Dashboard shows a "View Handbook" button that links to `#help` — a non-existent anchor. Clicking it does nothing.

**Required change:** Remove the button entirely.

**File:** [`src/pages/user/UserDashboard.tsx`](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/pages/user/UserDashboard.tsx#L150-L156)

**Code to remove (lines 150–156):**
```diff
-            <a
-              href="#help"
-              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold px-4 py-2.5 rounded-xl text-xs transition-all inline-flex items-center gap-2 cursor-pointer"
-            >
-              <BookOpen className="w-4 h-4" />
-              View Handbook
-            </a>
```

Also remove the unused `BookOpen` import if no other usage exists.

---

### FR-2: Fix Post-Login Redirect to Dashboard

**Current behavior:** Standard login (`handleStandardSubmit`) correctly redirects students to `/dashboard` (line 35). However, **Google OAuth login** (`GoogleSignInButton` `onSuccess` callback) incorrectly redirects students to `/labs` (the lab marketplace).

**Required change:** Change the Google OAuth success redirect from `/labs` to `/dashboard`.

**File:** [`src/pages/auth/LoginPage.tsx`](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/pages/auth/LoginPage.tsx#L206-L212)

**Code change (line 210):**
```diff
  <GoogleSignInButton
    portal="student"
    buttonText="Continue with Google"
    onSuccess={(data) => {
      if (data.role && (data.role.toLowerCase() === 'admin' || data.role.toLowerCase() === 'super_admin')) {
        navigate('/admin/dashboard');
      } else {
-       navigate('/labs');
+       navigate('/dashboard');
      }
    }}
    onError={(err) => setErrorMsg(err)}
  />
```

---

### FR-3: Fix Puzzle Score Not Updating on Profile

**Current behavior:** After completing 3 puzzle levels, the user's profile/dashboard stats do not reflect the puzzle score. The puzzle lab tracks completions via `completed_levels` array and the backend `techcorp` session API, but the profile stats endpoints (`/api/v1/user/dashboard`, `/api/v1/user/stats`) may not be aggregating puzzle level completions into `total_score`.

**Required change:** Ensure the backend stats API correctly sums puzzle level completions into:
- `total_score` (each level awards points: Phase 1 = 50pts, Phase 2 = 75pts, Phase 3–4 = 100pts, Phase 5 = 125pts per level)
- `completed_labs` count (or a separate `completed_puzzle_levels` field)
- XP progress

**Files to investigate and fix:**
- Backend stats endpoint that serves `/api/v1/user/dashboard` and `/api/v1/user/stats`
- Backend puzzle session model — check if `techcorp_level{N}` completions are stored in a way that the stats aggregator can query
- [`src/pages/user/TechCorpLabSession.tsx`](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/pages/user/TechCorpLabSession.tsx#L114-L121) — the frontend `get_points_for_level()` function defines the point values per level, but these must match what the backend awards

**Acceptance criteria:**
1. After solving a puzzle level, the user's profile must show updated `total_score` including puzzle points
2. The dashboard "TOTAL SCORE" metric card must reflect puzzle completions
3. Score should persist across sessions (not just client-side state)

---

### FR-4: Hide CTF Competitions Section Completely

**Current behavior:** The CTF Competitions feature is incomplete but visible to students via:
1. **Sidebar menu item:** "CTF Competitions" linking to `/ctf` in [`UserSidebar.tsx` line 41](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/components/user/UserSidebar.tsx#L41)
2. **Routes in App.tsx:** Three user-facing CTF routes at [lines 379, 387, 395](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/App.tsx#L379-L395)
3. **Admin CTF route:** at [line 506](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/App.tsx#L506)

**Required change:** Hide all student-facing CTF UI elements. Specifically:

1. **Remove from sidebar** — Remove the CTF Competitions nav item from `UserSidebar.tsx`:
```diff
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Available Labs', path: '/labs', icon: FlaskConical },
    { name: 'Assignments', path: '/assigned-labs', icon: Layers },
    { name: 'Puzzle', path: '/puzzle', icon: Puzzle },
-   { name: 'CTF Competitions', path: '/ctf', icon: Flag },
    { name: 'My Statistics', path: '/statistics', icon: BarChart2 },
    { name: 'Study Material', path: '/study-material', icon: BookOpen },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];
```

2. **Comment out or remove user CTF routes** in `App.tsx` (lines 379–403) — the three `<Route>` elements for `/ctf`, `/ctf/events/:eventId`, and `/ctf/events/:eventId/scoreboard`

3. **Keep admin CTF route** (`/admin/ctf`) — admin should still be able to prepare competitions

4. Remove unused `Flag` import from `UserSidebar.tsx` if no other usage

---

### FR-5: Secure Online PDF Viewer for Study Materials

**Current behavior:** Study materials have direct download links. Two download mechanisms exist:
1. **Card-level download button** — `<a href={item.pdfUrl} download>` at [lines 284–294](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/pages/user/StudyMaterial.tsx#L284-L294)
2. **Reader modal download button** — `<a href={activeNote.pdfUrl} download>` at [lines 363–382](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/pages/user/StudyMaterial.tsx#L363-L382)
3. **Fallback download button** with `alert()` for items without `pdfUrl`

**Required change:** Replace all download buttons with a "View PDF" action that opens a **secure, dedicated PDF viewer page** at a new route (e.g., `/study-material/view/:id`).

**Viewer requirements:**
1. **Canvas-based rendering** — Use a library like `pdf.js` (Mozilla's `pdfjs-dist`) to render PDF pages onto `<canvas>` elements. Do NOT use `<iframe>` or `<embed>` as those expose native browser PDF controls
2. **No download controls** — No download button, no print button, no native PDF toolbar
3. **Right-click disabled** — `onContextMenu={(e) => e.preventDefault()}` on the viewer container
4. **Print blocked** — CSS `@media print` rule that hides/blanks the content:
   ```css
   @media print {
     .pdf-viewer-container { display: none !important; }
     body::after { content: "Printing is disabled for this content."; }
   }
   ```
5. **Visible watermark** — Overlay the logged-in user's name and email as a semi-transparent, rotated watermark across each page (discourages screenshots)
6. **Navigation** — Previous/Next page buttons, page number indicator, zoom controls
7. **Full-screen option** — Allow the viewer to go full-screen for comfortable reading

**Files to modify:**
- [`src/pages/user/StudyMaterial.tsx`](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/pages/user/StudyMaterial.tsx) — Replace download buttons with "View PDF" buttons that navigate to the viewer
- **New file:** `src/pages/user/PdfViewerPage.tsx` — Secure PDF viewer component
- [`src/App.tsx`](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/App.tsx) — Add route for `/study-material/view/:id`
- [`src/index.css`](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/index.css) — Add print-blocking CSS rules

**New dependency:** `pdfjs-dist` (Mozilla PDF.js) — install via `npm install pdfjs-dist`

---

### FR-6: Remove Redundant Second Pop-up on Puzzle Level Advancement

**Current behavior:** When a student completes a puzzle level, they experience **two sequential pop-ups**:

1. **First pop-up (Banner Overlay)** — The `showBanner` overlay at [lines 580–621](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/pages/user/TechCorpLabSession.tsx#L580-L621): Shows "Level X Completed!" with XP awarded and an "Advance to Level Y" button. The student clicks "Advance" → `handleAdvance()` runs.

2. **Second pop-up (Completion Modal)** — The `completionModal` at [lines 756–833](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/pages/user/TechCorpLabSession.tsx#L756-L833): After `handleAdvance()` succeeds, it sets `completionModal` state (lines 429–436), showing ANOTHER modal with "Continue to Next Module" and "Review Module" buttons.

**The problem:** The student has already clicked "Advance" in the first pop-up, the terminal is already reconnecting to the next level, but then a SECOND modal appears asking "Continue to Next Module" or "Review Module" — this is redundant and confusing.

**Required change:** Remove the second pop-up for intermediate levels. Keep it ONLY for the final lab completion (all 34 levels done).

**Specific code change in `handleAdvance()` ([lines 428–436](file:///home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/src/pages/user/TechCorpLabSession.tsx#L428-L436)):**
```diff
        setShowBanner(false);
        setSolvedLevel(null);

-       const isFinal = data.all_completed || data.is_completed || (completedLevels.length + 1 >= 34);
-       setCompletionModal({
-         show: true,
-         isLastModule: isFinal,
-         moduleNum: solvedLevel !== null ? solvedLevel : currentLevel,
-         moduleTitle: levelInfo?.level?.title || `Level ${solvedLevel}`,
-         points: 100,
-         totalScore: (completedLevels.length + 1) * 100,
-       });
+       const isFinal = data.all_completed || data.is_completed || (completedLevels.length + 1 >= 34);
+       if (isFinal) {
+         setCompletionModal({
+           show: true,
+           isLastModule: true,
+           moduleNum: solvedLevel !== null ? solvedLevel : currentLevel,
+           moduleTitle: levelInfo?.level?.title || `Level ${solvedLevel}`,
+           points: 100,
+           totalScore: (completedLevels.length + 1) * 100,
+         });
+       }
```

Also clean up the modal JSX: remove the "Continue to Next Module" and "Review Module" buttons (lines 791–810) since the modal will now only appear for the final lab completion celebration.

---

## Non-Goals (Out of Scope)

1. **New Handbook feature** — We are removing the button, not building a handbook page
2. **CTF feature completion** — We are hiding CTF, not building it out
3. **DRM-level PDF protection** — We are adding practical deterrents (canvas rendering, watermark, no download), not military-grade DRM. Determined users with screen recording software can still capture content
4. **Backend refactoring** — Score fix should be surgical, not a full scoring system redesign
5. **Admin portal changes** — These fixes target the student portal only (except keeping admin CTF route)

---

## Design Considerations

- **PDF Viewer page** should match the existing platform design system (slate dark/light theme, rounded-xl containers, blue accent colors)
- **Watermark** should be subtle enough to not obstruct reading but visible enough to deter sharing — recommend 15% opacity, 45° rotation, repeating tile pattern with user's full name and email
- All UI changes should respect the existing dark mode / light mode toggle

---

## Technical Considerations

1. **FR-2 (Login redirect):** Only the `GoogleSignInButton` callback needs fixing. The standard form login already redirects correctly
2. **FR-3 (Score fix):** This is primarily a backend fix. The frontend already has `get_points_for_level()` with correct point values — the backend needs to match this when aggregating stats. Check if the `techcorp_level{N}` entries in `completed_levels` are being queried by the stats endpoint
3. **FR-5 (PDF viewer):** `pdfjs-dist` is ~2MB. Use dynamic import (`React.lazy`) to avoid impacting initial bundle size. The PDF worker file needs to be served from `/public/` or configured via `pdfjsLib.GlobalWorkerOptions.workerSrc`
4. **FR-6 (Double pop-up):** The first banner is triggered by a WebSocket `level_complete` event (line 373). The second modal is triggered by `handleAdvance()` (line 429). Removing the modal setter from `handleAdvance()` is safe — the banner already handles the user-facing celebration
5. **Git workflow:** All changes commit and push directly to `main` — no feature branches

---

## Success Metrics

| Fix | Success Criteria |
|-----|------------------|
| FR-1: Handbook button | Button no longer visible on User Dashboard |
| FR-2: Login redirect | Both standard and Google OAuth login land students on `/dashboard` |
| FR-3: Puzzle scores | After solving puzzle levels, profile shows accurate total score including puzzle XP |
| FR-4: CTF hidden | No CTF menu item in sidebar, CTF routes return 404 for students |
| FR-5: PDF viewer | Study materials open in canvas-based viewer; no download/print options visible; watermark present |
| FR-6: Single pop-up | Only one celebration pop-up appears per level completion; final lab completion still shows celebration modal |

---

## Open Questions

1. **FR-3 (Score fix):** Need to verify which backend endpoint serves the dashboard stats — is it `/api/v1/user/dashboard`, `/api/v1/user/stats`, or both? Is the puzzle session data stored in the same table as other lab sessions?
2. **FR-5 (PDF viewer):** Should the backend also strip the direct PDF URL from the API response so that even inspecting network requests doesn't reveal the raw URL? (Recommended: Yes — serve PDFs through an authenticated endpoint that streams bytes, not a direct static file URL)
3. **FR-4 (CTF):** Should we also hide the admin CTF page, or keep it so admins can prepare competitions before launch?
