# 🛡️ Cyber Range Platform — Frontend Portal

[![React](https://img.shields.io/badge/React-18%2B-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6%2B-[#646CFF]?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade, clean **light-themed cybersecurity training and learning platform** that enables organizations to deliver hands-on security challenges, procure training lab catalogs, allocate resources to user groups, monitor real-time telemetry, and run live security challenges.

---

## 🚀 Key Features

### 🔑 Authentication Suite (Complete Routes 1.1 – 1.4)

* **🔐 Login Page (`/login`)**:
  * Dual-mode tab switcher (**Standard Credentials** vs **Enterprise SAML 2.0 / Okta SSO**).
  * Work email format verification, password visibility toggle, and instant feedback.
* **🔑 Forgot Password Page (`/forgot-password`)**:
  * Recovery email dispatch simulator with email validation and timed reset link expiration alerts.
* **🛡️ Reset Password Page (`/reset-password`)**:
  * Dynamic complexity meter (Weak / Medium / Strong), live requirements checklist, matching password check, and `?token=expired` link expiration handler.
* **📝 Register & Onboarding Page (`/register`)**:
  * Multi-step onboarding details form transitioning to a 6-digit OTP verification pin grid with auto-advancing focus and a 45-second resend timer.

---

### 🎓 Student Portal Suite (Complete Routes 3.1 – 3.9)

* **📊 Student Dashboard (`/dashboard`) [Page 3.1]**:
  * Personalized greeting banner containing a Level/XP progress bar tracking overall experience points.
  * Overview cards displaying total score points, cohort rank, and count of completed labs.
  * Ticking active labs scheduler panel mapping allocated ranges and remaining container times.
  * Chronological activity logs monitoring recently solved flags.

* **🧪 Available Labs Catalog (`/labs`) [Page 3.2 & 3.3]**:
  * Active labs catalog featuring search fields and filtering selectors (Domains, Difficulties, Completion Status).
  * **Lab Details Modal overlay**: Objectives checklist, prerequisites, duration, and score points.
  * **Ticking container provisioning console simulator** mapping deployment progress.
  * Green **"Resume Lab"** quick-access routing directly linking to active sandbox workspaces.

* **🎛️ Lab Challenge Interface (`/labs/:labId/session/:sessionId`) [Page 3.4]**:
  * Immersive full-screen environment (no sidebar layouts to maximize width).
  * **Split-pane instructions guide (Left)**: Active objectives, unlockable hints with points penalty configurations, and a correct flags submission checker.
  * **Interactive Terminal Console Emulator (Right)**: Fully functional mock terminal accepting commands (`help`, `ls`, `cat`, `nmap` network mapping scanner, `sudo -l`, and `sys-helper` privilege escalation triggers to exploit SUID target hosts).

* **📈 Progress Tracking (`/progress`) [Page 3.5]**:
  * KPI metrics for study hours, average session duration, earned badges, and pacing stands.
  * Segmented progress indicators tracking solve ratios across security domains.
  * **Score Trajectory Line Graph**: Responsive SVG timeline chart showing score gains week-over-week.
  * **Active Study Hours Bar Graph**: SVG bar chart displaying weekly training logs.
  * Timelines feed of unlocked credentials badges and target milestone requirements.

* **🏆 Leaderboard & Scoreboard Portal (`/leaderboards`) [Pages 3.6 – 3.8]**:
  * **Personal Solves (3.6)**: Log table detailing completed labs, categories, time taken, points, and speed percentiles.
  * **Group Standings (3.7)**: Rankings list tracking peers inside the student's cohort (`Cybersecurity Batch A`), highlighting the user's standing.
  * **Global Leaderboard (3.8)**: Stands displaying top-3 gold, silver, and bronze champion podium cards.
  * **Scoreboard Dashboard (New)**: Side-by-side display featuring a multi-line SVG solve progression graph over time, alongside a final standings table containing inline sparkline trends for top operators.

* **⚙️ Profile & Settings (`/profile`) [Page 3.9]**:
  * Avatar upload box showcasing initials initials card and verification tags.
  * Account information updating inputs (Full Name, Email, Organization).
  * Security settings for resetting password credentials.
  * Notification selectors controlling email alerts (including the PRD requirement **"Notify me 10 minutes before a lab starts"**).

---

### 👑 Admin Management Suite (Complete Routes 2.1 – 2.9)

* **📊 Security Admin Dashboard (`/admin/dashboard`)**:
  * Real-time platform KPI metrics (Total Users, Active Labs, Average Score, Total Groups).
  * Quick administrative toolbar for fast user provisioning and lab procurement.
  * Interactive SVG visualizations for monthly platform engagement and lab domain completion rates.
  * Real-time operational security activity log feed with instant status filters (`All`, `Success`, `Alerts`).

* **🛒 Lab Marketplace & Catalog (`/admin/labs`)**:
  * Searchable catalog supporting difficulty level filters (Beginner, Intermediate, Advanced, Expert) and security domain categories.
  * Tabbed view switcher: **Browse Marketplace Catalog** vs **Purchased Inventory**.
  * Detailed lab preview modal showcasing prerequisites, learning objectives, skill coverage tags, and challenge module breakdown.
  * All pricing rendered in **Indian Rupees (`₹ INR`)** with localized number formatting.

* **💳 License Procurement & Checkout (`/admin/labs/:labId/purchase`)**:
  * Itemized order summary with license model selector (Single Event, Annual Subscription, Per-User Seats with dynamic sliders).
  * Payment method selector (Corporate Card, PO / Invoice Billing, Enterprise Prepaid Credits).
  * Real-time subtotal, GST, and total price calculation in `₹ INR`.
  * Purchase confirmation modal dialog with instant inventory addition receipt.

* **👥 User Management & Provisioning (`/admin/users`)**:
  * Roster table displaying user metadata, role tags (`Admin`, `Instructor`, `User`), group assignments, status indicators (`Active`, `Inactive`), score, and activity timestamps.
  * Multi-field search & filtering (Group filter, Role filter, Status filter).
  * `BulkImportModal` featuring drag-and-drop CSV upload, validation matrix parser, syntax error flags, and batch account provisioning.

* **🏢 Group Cohort Management (`/admin/groups`)**:
  * Cohort management cards displaying description, member count, and creation date.
  * Modals for group creation and cohort roster inspection.

* **🗺️ Lab Allocation & Visibility Controls (`/admin/allocations`)**:
  * Interactive Grid Matrix: User Groups (Rows) × Purchased Security Labs (Columns).
  * Cell-by-cell visibility toggles (**Visible to Group** vs **Hidden**).
  * Scheduled access window calendar ranges (`StartDate` → `EndDate`).

* **🎛️ Lab Control Panel & Compute Telemetry (`/admin/labs/control`)**:
  * Real-time container instance status monitors (`Running`, `Paused`, `Idle`, `Stopped`).
  * Live compute telemetry: active user count per lab, CPU utilization percentage, and container uptime counters.
  * Security-gated **Emergency Stop All Labs** killswitch.

* **📈 Monitoring & Real-Time Telemetry (`/admin/monitoring`)**:
  * Live user leaderboard standings, cohort average score charts, and peak activity heatmaps.

* **⚙️ Platform Settings (`/admin/settings`)**:
  * Organization identity, inactivity session auto-logout timeout, Enterprise SSO, and notification preferences.

---

### 🌐 Shared Platform Pages (Routes 4.1 – 4.5)

* **🔄 Auth Gateway & Role Redirect (`/`)**:
  * Auto-evaluates authentication tokens and redirects users to role-based destinations. Includes an interactive dev sandbox role switcher for testing.
* **🔍 Page Not Found 404 (`*`)**: Catch-all route displaying a light-themed visual error card, quick search suggestions, and return CTAs.
* **⚠️ Internal Server Error 500 (`/error`)**: Dedicated exception page displaying system diagnostics, timestamp payload, and retry controls.
* **🛠️ System Maintenance Mode (`/maintenance`)**: Scheduled infrastructure maintenance page.
* **🔒 Unauthorized Access 403 (`/unauthorized`)**: Gated page explaining permission levels.

---

### 🔑 Interactive Onboarding Mockups (Pages 1.1 – 1.4)

Static HTML mockup templates are located in the **[auth-mockups](auth-mockups)** directory.
* **🔑 Login Page ([index.html](auth-mockups/index.html))**
* **✉️ Forgot Password Page ([forgot-password.html](auth-mockups/forgot-password.html))**
* **🔄 Reset Password Page ([reset-password.html](auth-mockups/reset-password.html))**
* **📝 Register Page ([register.html](auth-mockups/register.html))**

---

## 🎨 Design System & Aesthetics

Built in accordance with the PRD **Light Theme Palette**:

| Color Token | Hex Code | Purpose |
|---|---|---|
| **Background Light** | `#F8F9FA` | Soft off-white canvas to minimize eye strain |
| **Primary Blue** | `#0052CC` | Security authority, primary CTA buttons & active links |
| **Success Green** | `#28A745` | Passed challenges, active statuses, positive metrics |
| **Warning Orange** | `#FFA500` | Lab alerts, medium difficulty badges |
| **Accent Purple** | `#6F42C1` | Leaderboards, rankings, CSV import features |
| **Neutral Dark** | `#2D3436` | Primary high-contrast body typography |

---

## 🛠️ Technology Stack

* **Frontend Library**: [React 18](https://react.dev/)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite 6](https://vitejs.dev/)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Routing**: [React Router Dom v7](https://reactrouter.com/)

---

## 💻 Getting Started

### Installation & Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/umadhatri/cyberrange.git
   cd cyberrange
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.
4. **Build for production**:
   ```bash
   npm run build
   ```

---

## 📁 Repository Structure

```
CyberRange/
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminLayout.tsx          # Admin layout structure
│   │   │   ├── AdminSidebar.tsx         # Admin navigation sidebar
│   │   │   └── ...                      # Roster modals, create modals
│   │   └── user/
│   │       ├── UserLayout.tsx           # Student layout frame (header, main container)
│   │       └── UserSidebar.tsx          # Student navigation sidebar
│   ├── pages/
│   │   ├── admin/
│   │   │   └── ...                      # 2.1 - 2.9 Admin portal pages
│   │   ├── auth/
│   │   │   ├── ForgotPasswordPage.tsx   # 1.2 Password recovery page
│   │   │   ├── LoginPage.tsx            # 1.1 Login & SAML SSO page
│   │   │   ├── RegisterPage.tsx         # 1.4 Onboarding & 6-digit OTP page
│   │   │   └── ResetPasswordPage.tsx    # 1.3 Password complexity reset page
│   │   ├── user/
│   │   │   ├── UserDashboard.tsx        # 3.1 Student main dashboard
│   │   │   ├── AvailableLabs.tsx        # 3.2 & 3.3 Available labs catalog
│   │   │   ├── ChallengeSession.tsx     # 3.4 Interactive terminal console
│   │   │   ├── ProgressTracking.tsx     # 3.5 Learning achievements & graphs
│   │   │   ├── LeaderboardPortal.tsx    # 3.6 - 3.8 Stands logs, cohort & scoreboard
│   │   │   └── UserProfile.tsx          # 3.9 Student credentials & settings
│   │   └── shared/
│   │       └── ...                      # 4.1 - 4.5 System shared views
│   ├── types/
│   │   └── admin.ts                     # TypeScript models & data interfaces
│   ├── App.tsx                          # Role routing & App mappings
│   ├── index.css                        # Tailwind v4 configuration & styles
│   └── main.tsx                         # DOM mounting point
├── auth-mockups/                        # Interactive static mockups (1.1 - 1.4)
├── tasks/                               # Task tracking documents
├── index.html                           # Application entry HTML
├── package.json                         # Dependencies & scripts
└── README.md                            # Main project documentation
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
