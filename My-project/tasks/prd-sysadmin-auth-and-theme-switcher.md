# PRD: RangeOps — Hidden System Admin Authentication & Dual Light/Dark Theme Switcher

## Document Metadata
- **Feature Name**: Hidden System Admin Login Page & Dual Light/Dark Theme System
- **Target Location**: `/My-project/tasks/prd-sysadmin-auth-and-theme-switcher.md`
- **Working Scope**: Next.js Production Frontend (`My-project/frontend`)
- **Status**: Draft for User Review & Sign-Off

---

## 1. Introduction & Overview

This Product Requirements Document (PRD) covers two key security and UX enhancements for the **RangeOps Platform** (`My-project/frontend`):

1. **System Admin Auth Isolation**: Removing the public `Sys Admin` login option from the primary `/login` page to prevent unauthorized visibility, while maintaining full operational capability via a hidden standalone login route at `/sys-admin-login`.
2. **Dual Theme Engine & Light Theme Adoption**: Integrating the clean Light-Theme design palette from `backup` (`#F8F9FA` background, `#0052CC` primary blue, `#28A745` success green, `#6F42C1` accent purple, `#2D3436` charcoal text) as the primary Light Mode, while retaining current dark styles as Dark Mode, complete with a Sun/Moon toggle button in `Header.tsx`.

---

## 2. Goals

1. **Security Through Obscurity for Sys Admin Auth**: Conceal system administration login tabs from standard students and competitors on `/login`.
2. **Dedicated Sys Admin Portal**: Provide an unlinked, functional login route at `/sys-admin-login` for system administrator credentials (`anand@academy.io`).
3. **Harmonized Light Theme Design System**: Adopt the `backup` design system tokens for Light Mode across Next.js components.
4. **Seamless Theme Switching**: Enable one-click switching between Light Mode (default) and Dark Mode in `Header.tsx` using `next-themes`.

---

## 3. User Stories

### Public / Student User Stories
- As a student visiting `/login`, I should only see login options for regular users and CTF admins, ensuring administrative portals are hidden from public view.
- As a site visitor, I want a clean Light Mode theme by default with a Sun/Moon header toggle to switch to Dark Mode whenever preferred.

### System Administrator User Stories
- As a System Administrator, I want to access a hidden `/sys-admin-login` page to authenticate securely as `anand@academy.io` and enter the Sys Admin workspace.

---

## 4. Functional Requirements

### 🔐 Module 1: Auth Separation & Hidden Sys Admin Login Route

1. **Public Login Page Update (`app/login/page.tsx`)**:
   - Remove the `Sys Admin` segment button from the role selector tab bar.
   - Restrict public tab options to `Student / User` and `CTF Admin`.
   - Remove the Sys Admin login handler from public scope.

2. **Hidden System Admin Login Page (`app/sys-admin-login/page.tsx`)**:
   - Create a dedicated route at `/sys-admin-login`.
   - Display a high-security Sys Admin login card with email (`anand@academy.io`) and name inputs.
   - Handle authentication via `useAuth().devLogin()` and redirect to `/admin` upon success.
   - Include visual security badges indicating restricted access.

---

### 🎨 Module 2: Dual Light/Dark Theme System & Palette Integration

3. **CSS Variables & Color Token Specification (`app/globals.css`)**:
   - Configure `:root` (Light Theme - Default):
     - Background canvas: `#F8F9FA` (Soft Off-White)
     - Card / Container background: `#FFFFFF` with subtle `#E2E8F0` borders
     - Primary Blue: `#0052CC`
     - Text Primary: `#2D3436` (Dark Charcoal)
     - Text Secondary: `#636E72` (Muted Slate)
     - Success Green: `#28A745`
     - Accent Purple: `#6F42C1`
   - Configure `.dark` (Dark Theme - Current):
     - Background canvas: `#0A0A0B`
     - Card / Container background: `rgba(255, 255, 255, 0.03)` with `rgba(255, 255, 255, 0.1)` border
     - Text Primary: `#F8FAFC`

4. **Header Theme Toggle Component (`components/Header.tsx`)**:
   - Add a theme toggle button using `useTheme()` from `next-themes`.
   - Render a `Sun` icon when in Dark Mode and a `Moon` icon when in Light Mode.
   - Position the toggle in the header actions bar next to Login / Profile dropdown.
   - Persist theme preference in `localStorage`.

---

## 5. Non-Goals (Out of Scope)

- Modifying backend JWT token structures or API database schemas.

---

## 6. Theme Color Reference Matrix

| Token Name | Light Mode Value (Default) | Dark Mode Value | Purpose |
|---|---|---|---|
| `--background` | `#F8F9FA` | `#0A0A0B` | Page Canvas Background |
| `--foreground` | `#2D3436` | `#F8FAFC` | Main Body Text |
| `--primary` | `#0052CC` | `#3B82F6` | Primary Action Buttons & Links |
| `--card` | `#FFFFFF` | `#121214` | Content Container Cards |
| `--border` | `#E2E8F0` | `#27272A` | Element Dividers & Borders |

---

## 7. Success Metrics

1. **Zero Public Sys Admin Links**: No links or tabs pointing to Sys Admin login visible on `/login` or main nav.
2. **100% Theme Switching Consistency**: One-click toggle between Light and Dark modes with clean color contrast and persistence.

---

## 8. Document Approvals

- **Status**: Ready for task generation (`My-project/tasks/tasks-sysadmin-auth-and-theme-switcher.md`).
