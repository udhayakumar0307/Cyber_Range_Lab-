## Relevant Files

- `My-project/frontend/app/login/page.tsx` - Public login page to be updated by removing Sys Admin tab and form.
- `My-project/frontend/app/sys-admin-login/page.tsx` - New standalone secret login page for System Administrators.
- `My-project/frontend/app/globals.css` - CSS tokens update adopting the `backup` light-theme palette as default `:root` styling while preserving `.dark`.
- `My-project/frontend/components/Header.tsx` - Main navigation bar updated with Sun/Moon theme switcher toggle button.
- `My-project/frontend/components/theme-provider.tsx` - Theme provider wrapper using `next-themes`.

---

### Notes

- Main working directory: `My-project/frontend`.
- Design palette for Light Theme (Default):
  - Canvas Background: `#F8F9FA`
  - Primary Action Blue: `#0052CC`
  - Success Green: `#28A745`
  - Accent Purple: `#6F42C1`
  - Primary Text: `#2D3436`
  - Secondary Text: `#636E72`

---

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, check it off in this markdown file by changing `- [ ]` to `- [x]`.

---

## Tasks

- [x] 0.0 Working in `My-project/frontend` Directory
  - [x] 0.1 Confirm working context inside Next.js frontend app

- [x] 1.0 Remove Sys Admin Login from Public Login Page
  - [x] 1.1 Update `app/login/page.tsx` to remove `admin` from `activeRole` options.
  - [x] 1.2 Remove `Sys Admin` segment tab button and `handleAdminLogin` from public login form.
  - [x] 1.3 Keep public login form tabs strictly for `Student / User` and `CTF Admin`.

- [x] 2.0 Create Standalone Hidden Sys Admin Login Page
  - [x] 2.1 Create `app/sys-admin-login/page.tsx` with high-security Sys Admin branding.
  - [x] 2.2 Implement authentication form validating `anand@academy.io` and `anand` inputs using `devLogin()`.
  - [x] 2.3 Add automatic redirect to `/admin` upon successful login.

- [x] 3.0 Integrate Light Theme Palette Tokens in `app/globals.css`
  - [x] 3.1 Update `:root` variables to reflect `backup` Light-Theme values (`#F8F9FA` background, `#0052CC` primary blue, `#2D3436` text).
  - [x] 3.2 Verify `.dark` class variables preserve current RangeOps dark aesthetic.

- [x] 4.0 Add Theme Toggle Button to Header
  - [x] 4.1 Import `useTheme` from `next-themes` and `Sun` / `Moon` icons from `lucide-react` in `components/Header.tsx`.
  - [x] 4.2 Add theme toggle button in header action area.
  - [x] 4.3 Ensure toggle switches between `light` and `dark` modes seamlessly.

- [x] 5.0 Verification & Build Health Check
  - [x] 5.1 Run `npm run build` inside `My-project/frontend` to verify clean compilation. (Compiled 38 routes in 2.2s with zero errors)
