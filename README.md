# 🛡️ Cyber Range Platform — Frontend Portal

[![React](https://img.shields.io/badge/React-18%2B-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6%2B-[#646CFF]?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade, clean **light-themed cybersecurity training and learning platform** that enables organizations to deliver hands-on security challenges, procure training lab catalogs, allocate resources to user groups, monitor real-time telemetry, and run live security challenges.

---

## 🚀 Key Features

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
  * Itemized order summary with license model selector:
    * **Single Event License** (Base rate)
    * **1-Year Unlimited Annual Subscription**
    * **Per-User Seat Allocation** (Interactive slider with dynamic pricing recalculations)
  * Payment method selector (Corporate Card, PO / Invoice Billing, Enterprise Prepaid Credits).
  * Real-time subtotal, 8% tax/GST, and total price calculation in `₹ INR`.
  * Purchase confirmation modal dialog with instant inventory addition receipt.

* **👥 User Management & Provisioning (`/admin/users`)**:
  * Roster table displaying user metadata, role tags (`Admin`, `Instructor`, `User`), group assignments, status indicators (`Active`, `Inactive`), score, and activity timestamps.
  * Multi-field search & filtering (Group filter, Role filter, Status filter).
  * `UserAddModal` & `UserEditModal` for managing single-user credentials.
  * `BulkImportModal` featuring drag-and-drop CSV upload, validation matrix parser, syntax error flags, and batch account provisioning.
  * User deletion confirmation dialog.

* **🏢 Group Cohort Management (`/admin/groups`)**:
  * Cohort management cards displaying description, member count, and creation date.
  * `GroupCreateModal` for configuring new training cohorts.
  * `GroupMembersModal` for inspecting cohort rosters and quick-assigning users.

* **🗺️ Lab Allocation & Visibility Controls (`/admin/allocations`)**:
  * Interactive Grid Matrix: User Groups (Rows) × Purchased Security Labs (Columns).
  * Cell-by-cell visibility toggles (**Visible to Group** vs **Hidden**).
  * Scheduled access window calendar ranges (`StartDate` → `EndDate`).
  * Group-level batch visibility shortcuts (`All On` / `All Off`).

* **🎛️ Lab Control Panel & Compute Telemetry (`/admin/labs/control`)**:
  * Real-time container instance status monitors (`Running`, `Paused`, `Idle`, `Stopped`).
  * Live compute telemetry: active user count per lab, CPU utilization percentage, and container uptime counters.
  * Controls to start, pause, or terminate lab environments with confirmation dialogs.
  * Security-gated **Emergency Stop All Labs** killswitch.

* **📈 Monitoring & Real-Time Telemetry (`/admin/monitoring`)**:
  * Live user leaderboard standings with trophy/medal badges.
  * Cohort average score comparison charts and peak activity heatmaps.
  * Telemetry export functionality.

* **⚙️ Platform Settings (`/admin/settings`)**:
  * Organization identity profile settings.
  * Security configuration (Inactivity session auto-logout timeout, Enterprise SSO / SAML toggle).
  * Automated email notification preferences.

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

### Prerequisites

* **Node.js**: `v18.0.0` or higher
* **npm**: `v9.0.0` or higher

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
│   │   └── admin/
│   │       ├── AdminLayout.tsx          # Main layout frame with sidebar & header
│   │       ├── AdminSidebar.tsx         # Navigation sidebar with route items
│   │       ├── BulkImportModal.tsx      # CSV file dropzone & data preview
│   │       ├── GroupCreateModal.tsx     # Cohort creation modal
│   │       ├── GroupMembersModal.tsx    # Cohort roster management
│   │       ├── LabDetailModal.tsx       # Lab specs & learning objectives
│   │       ├── MetricsCard.tsx          # Reusable KPI counter widget
│   │       └── UserAddModal.tsx         # Single user add/edit modal
│   ├── pages/
│   │   └── admin/
│   │       ├── AdminDashboard.tsx       # 2.1 Admin main hub
│   │       ├── AdminSettings.tsx        # 2.9 Platform configurations
│   │       ├── GroupManagement.tsx      # 2.5 Training group cohorts
│   │       ├── LabAllocation.tsx        # 2.6 Lab-group visibility grid
│   │       ├── LabControlPanel.tsx      # 2.7 Compute instance lifecycle
│   │       ├── LabMarketplace.tsx       # 2.2 Lab catalog & inventory
│   │       ├── LabPurchaseConfirmation.tsx # 2.3 Checkout flow (₹ INR)
│   │       ├── MonitoringAnalytics.tsx  # 2.8 Telemetry & leaderboards
│   │       └── UserManagement.tsx       # 2.4 User roster administration
│   ├── types/
│   │   └── admin.ts                     # TypeScript models & data interfaces
│   ├── App.tsx                          # React Router definitions
│   ├── index.css                        # Tailwind v4 configuration & base styles
│   └── main.tsx                         # DOM mounting root
├── tasks/                               # Task tracking documents
├── index.html                           # Application entry HTML
├── package.json                         # Dependencies & scripts
├── vite.config.ts                       # Vite & Tailwind plugin setup
└── README.md                            # Project documentation
```

---

## 🔮 Future Architecture Roadmap

* **Python Backend Interfacing**: The frontend client architecture is designed to interface via REST APIs & WebSockets with a Python server (FastAPI / Django REST Framework).
* **User Role Workflows**: Developing the Regular User workflow pages (User Dashboard, Lab Session Environment, Challenge Submission Flag validation, Personal & Global Leaderboards).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
