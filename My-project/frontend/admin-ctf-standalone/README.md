# Standalone Admin CTF Module

This folder contains all the frontend components, pages, utility functions, and type definitions required to run the Administrative CTF Control Deck page (`/admin-ctf`).

You can copy this folder and easily drop it into any Next.js (App Router) application.

## Directory Structure

```text
admin-ctf-standalone/
├── app/
│   └── admin-ctf/
│       └── page.tsx             # The main Admin CTF page dashboard (modals, roster, telemetry, billing)
├── components/
│   ├── Header.tsx               # Site global header navigation component
│   ├── CTFLeaderboardView.tsx   # Scoring graph & standing charts (Recharts-based)
│   ├── toast.tsx                # Toast notification component & queue management
│   └── ui/                      # Core Shadcn UI design components:
│       ├── avatar.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dropdown-menu.tsx
│       └── input.tsx
├── lib/
│   ├── api.ts                   # Central backend API gateway and client client definitions
│   ├── auth.ts / auth.tsx       # Authentication hooks and provider re-exports
│   ├── auth-provider.tsx        # Session state provider (DevLogin, SSO, Entitlements cache)
│   ├── content-id.ts            # UUID equivalence normalize helper
│   ├── logger.ts                # Dev & Prod logging and reporting wrapper
│   ├── role-home.ts             # Workspace entry redirect routers based on roles
│   └── utils.ts                 # Utility helpers (Shadcn cn class merger)
└── README.md                    # This instruction guide
```

## Setup & Integration

To integrate this module into a target Next.js app:

1. **Copy Directories**: 
   Merge the `app/`, `components/`, and `lib/` folders into the root directory of your target Next.js application.
   
2. **Install Dependencies**:
   Ensure the following npm packges are installed in the destination project:
   ```bash
   npm install lucide-react recharts clsx tailwind-merge class-variance-authority @radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-slot
   ```
   
3. **Environment Variables**:
   Define the backend endpoint in your `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
   ```

4. **Tailwind Config**:
   Verify that Tailwind CSS configuration supports the custom colors and animations used (e.g. `border-white/10`, `bg-[#070709]`).
