## Relevant Files

- `src/pages/shared/RootRedirect.tsx` - Landing route `/` auto-redirect handler based on auth status and user role.
- `src/pages/shared/NotFoundPage.tsx` - Catch-all 404 error page with light-theme visual error card, valid page suggestions, and navigation CTAs.
- `src/pages/shared/ServerErrorPage.tsx` - Dedicated 500 server error page with retry controls, error code payload, and support links.
- `src/pages/shared/MaintenancePage.tsx` - System maintenance page displaying estimated downtime counter, scheduled window breakdown, and status updates.
- `src/pages/shared/UnauthorizedPage.tsx` - 403 access denied page explaining role permissions and admin access request CTA.
- `src/App.tsx` - Main router wiring all shared routes (`/`, `*`, `/error`, `/maintenance`, `/unauthorized`).

### Notes

- Working directly on the `main` branch.
- Design strictly enforces PRD Light Theme palette:
  - Background: Soft Off-White (`#F8F9FA`)
  - Primary Blue: Security Authority (`#0052CC`)
  - Success Green: Passed/Active (`#28A745`)
  - Warning Orange: Alerts/Errors (`#FFA500`)
  - Accent Purple: Ranks/Badges (`#6F42C1`)
  - Text Primary: Dark Charcoal (`#2D3436`)

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Working on Main Branch
  - [x] 0.1 Confirm repository context and status on `main` branch
- [x] 1.0 Implement Root Navigation & Auth Role Redirect (`/`)
  - [x] 1.1 Create `src/pages/shared/RootRedirect.tsx` with authentication state evaluation and role-based redirect logic
  - [x] 1.2 Provide mock auth role switcher for testing Admin vs User vs Guest landing behavior
- [x] 2.0 Implement 404 Page Not Found Route (`*`)
  - [x] 2.1 Build `src/pages/shared/NotFoundPage.tsx` featuring light-theme visual error card, quick search bar, and dashboard return CTA
- [x] 3.0 Implement 500 Server Error Page (`/error`)
  - [x] 3.1 Build `src/pages/shared/ServerErrorPage.tsx` displaying diagnostic error details, interactive retry button, and bug report action
- [x] 4.0 Implement Platform Maintenance Page (`/maintenance`)
  - [x] 4.1 Build `src/pages/shared/MaintenancePage.tsx` displaying estimated downtime clock, scheduled window breakdown, and system status link
- [x] 5.0 Implement 403 Unauthorized Access Page (`/unauthorized`)
  - [x] 5.1 Build `src/pages/shared/UnauthorizedPage.tsx` displaying missing role permissions notice, request elevated access trigger, and safe return links
  - [x] 5.2 Wire all shared routes (`/`, `*`, `/error`, `/maintenance`, `/unauthorized`) inside `src/App.tsx`
