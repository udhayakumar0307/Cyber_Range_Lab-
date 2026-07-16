# 🛡️ Cyber Range Platform

[![React](https://img.shields.io/badge/React-18%2B-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6%2B-[#646CFF]?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade, clean **light-themed cybersecurity training and assessment platform**. Cyber Range allows organizations to provision security lab environments, allocate challenge suites, monitor user performance in real-time, and execute hands-on terminal exercises.

---

## 🚀 Overview & Key Modules

### 🎓 Student Portal Suite
- **Dashboard (`/dashboard`)**: Personal greeting banner, Level/XP progress bar, cohort rank, active container time remaining, and recent solve feeds.
- **Labs Catalog & Preview (`/labs`)**: Searchable lab library filtered by domain and difficulty, detailed overview modal, and active lab resume actions.
- **Interactive Lab Sandbox (`/labs/:labId/session/:sessionId`)**: Immersive full-screen environment featuring split-pane objectives & hints on the left, and an interactive terminal console (`nmap`, `cat`, `sudo`, SUID privilege escalation emulator) on the right.
- **Progress Analytics (`/progress`)**: SVG score trajectories, domain proficiency heatmaps, weekly study hour stats, and milestone achievement badges.
- **Leaderboards & Scoreboard (`/leaderboards`)**: Personal solve log, cohort standings, top-3 global podiums, and multi-line solve progression graphs.
- **Profile & Settings (`/profile`)**: Account credentials, avatar manager, and lab notification options.

### 👑 Admin Management Suite
- **Executive Dashboard (`/admin/dashboard`)**: High-level platform KPIs, rapid user provisioning triggers, monthly activity charts, and security action logs.
- **Lab Marketplace (`/admin/labs`)**: Catalog filtered by difficulty and domain, preview modal, purchased inventory tab, and localized pricing in **`₹ INR`**.
- **License Procurement (`/admin/labs/:labId/purchase`)**: Dynamic pricing models (Single Event, Annual, Seats), tax breakdown, corporate payment options, and instant inventory sync.
- **User & Group Management (`/admin/users`, `/admin/groups`)**: Searchable roster tables, CSV drag-and-drop batch importer, role toggles (`Admin`, `Instructor`, `User`), and cohort group controls.
- **Lab Allocations (`/admin/allocations`)**: Interactive Group Matrix mapping access visibility and scheduled lab availability windows.
- **Compute Telemetry & Control (`/admin/labs/control`, `/admin/monitoring`)**: Live container status indicators (`Running`, `Paused`, `Stopped`), CPU & RAM usage telemetry, live user leaderboards, and an emergency stop killswitch.

### 🔐 Authentication Suite
- **Login (`/login`)**: Dual-mode authentication (Standard Credentials vs Enterprise SAML 2.0 / Okta SSO) with password toggle.
- **Password Recovery (`/forgot-password`, `/reset-password`)**: Recovery link dispatch, password complexity meter, and link expiration handlers.
- **Registration & OTP (`/register`)**: Account registration form followed by a 6-digit auto-advancing OTP pin code grid.

### 🌐 System & Shared Views
- **Auth Gateway (`/`)**: Smart role-based auto-redirection with interactive dev testing switcher.
- **Utility Pages**: Styled **404 Not Found** (`*`), **500 Server Error** (`/error`), **Maintenance Mode** (`/maintenance`), and **403 Unauthorized** (`/unauthorized`) routes.

---

## 🎨 Design System

Designed according to the platform's PRD **Light Theme Design System**:

| Color Token | Hex Code | Usage |
|---|---|---|
| **Background Light** | `#F8F9FA` | Off-white canvas for clarity and reduced glare |
| **Primary Blue** | `#0052CC` | Security authority, main call-to-action triggers |
| **Success Green** | `#28A745` | Solved flags, active container status, growth metrics |
| **Warning Orange** | `#FFA500` | Lab alerts, medium difficulty level tags |
| **Accent Purple** | `#6F42C1` | Leaderboard ranks, podium highlights, CSV utilities |
| **Dark Charcoal** | `#2D3436` | High-contrast typography & structural headers |

---

## 🛠️ Technology Stack

| Domain | Technology |
|---|---|
| **Core Framework** | [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) |
| **Build & Bundling** | [Vite 6](https://vitejs.dev/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Iconography** | [Lucide React](https://lucide.dev/) |
| **Navigation & Routing** | [React Router Dom v7](https://reactrouter.com/) |

---

## 💻 Quick Start

### Prerequisites
- Node.js (v18.x or higher recommended)
- npm or pnpm

### Setup Commands
```bash
# 1. Clone the repository
git clone https://github.com/umadhatri/cyberrange.git
cd cyberrange

# 2. Install dependencies
npm install

# 3. Launch local development server
npm run dev

# 4. Build for production release
npm run build
```

---

## 📁 Repository Structure

```
CyberRange/
├── src/
│   ├── components/
│   │   ├── admin/             # Admin layout, sidebar, and management modals
│   │   └── user/              # Student layout & sidebar components
│   ├── pages/
│   │   ├── admin/             # Admin pages (2.1 - 2.9)
│   │   ├── auth/              # Auth pages (1.1 - 1.4)
│   │   ├── user/              # Student pages (3.1 - 3.9)
│   │   └── shared/            # Utility pages (404, 500, maintenance, etc.)
│   ├── types/                 # Data schemas & TypeScript interfaces
│   ├── App.tsx                # Central router & application routes
│   └── index.css              # Global styles & Tailwind v4 tokens
├── tasks/                     # Development task tracking documentation
└── README.md
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
