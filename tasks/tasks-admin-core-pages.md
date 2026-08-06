## Relevant Files

- `src/types/admin.ts` - TypeScript interfaces and types for Admin metrics, Lab Marketplace items, Purchases, Users, and Groups.
- `src/components/admin/AdminLayout.tsx` - Unified layout frame providing Admin Sidebar navigation and top header bar.
- `src/components/admin/AdminSidebar.tsx` - Navigation sidebar tailored for Admin workflows with active route highlighting.
- `src/components/admin/MetricsCard.tsx` - Reusable card component for key performance indicators (KPIs) and stat counters.
- `src/pages/admin/AdminDashboard.tsx` - Main hub page (`/admin/dashboard`) displaying metric counters, quick actions, performance charts, and activity log.
- `src/pages/admin/LabMarketplace.tsx` - Marketplace catalog (`/admin/labs`) supporting search, category filters, sorting, tabbed view (Catalog vs Inventory), and details modal.
- `src/components/admin/LabDetailModal.tsx` - Modal component displaying full lab specifications, learning objectives, difficulty breakdown, and purchase CTA.
- `src/pages/admin/LabPurchaseConfirmation.tsx` - Checkout route (`/admin/labs/:labId/purchase`) with line item breakdown, license tier options, payment preview, and receipt confirmation.
- `src/pages/admin/UserManagement.tsx` - User administration suite (`/admin/users`) featuring multi-filter table, user role tags, status switches, and CSV bulk import.
- `src/components/admin/UserAddModal.tsx` - Modal for creating new users or editing existing user attributes.
- `src/components/admin/BulkImportModal.tsx` - Modal with drag-and-drop CSV file selector, data preview matrix, and import confirmation.

### Notes

- Executing work directly on the `main` branch.
- Theme enforces the accessible light mode color palette from PRD section 7:
  - Background: Soft Off-White (`#F8F9FA`)
  - Primary Blue: Security Authority (`#0052CC`)
  - Success Green: Passed/Active (`#28A745`)
  - Warning Orange: Failed/Alerts (`#FFA500`)
  - Accent Purple: Leaderboards/Ranks (`#6F42C1`)
  - Text Primary: Dark Charcoal (`#2D3436`)

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Working on Main Branch
  - [x] 0.1 Confirm working directory context and verify status on `main` branch
- [x] 1.0 Foundational Setup & Shared Admin Components
  - [x] 1.1 Define TypeScript models (`src/types/admin.ts`) for metrics, labs, license tiers, users, and CSV import schemas
  - [x] 1.2 Implement `AdminSidebar` component with light-theme palette, route navigation items, and responsive mobile toggle
  - [x] 1.3 Implement `AdminLayout` container wrapper integrating top header bar, notification indicator, and sidebar
  - [x] 1.4 Create reusable `MetricsCard` component supporting trend badges, numerical targets, and customizable icon slots
- [x] 2.0 Implement Admin Dashboard (`/admin/dashboard`)
  - [x] 2.1 Build KPI metrics cards grid (Total Users, Active Labs, Average User Score, Total Groups Created)
  - [x] 2.2 Build Quick Actions bar for instant access to user addition, lab allocation, lab catalog, and live control panel
  - [x] 2.3 Construct visual charts for platform metrics (User Growth over time, Lab Completion Rates, Session Volume)
  - [x] 2.4 Add real-time operational activity log feed showing recent lab starts, completed challenges, and system events
- [x] 3.0 Implement Lab Marketplace & Inventory (`/admin/labs`)
  - [x] 3.1 Build search and multi-filtering controls (search input, difficulty dropdown, price tier filter, sorting options)
  - [x] 3.2 Build tab navigation toggle between "Browse Marketplace Catalog" and "My Purchased Inventory"
  - [x] 3.3 Render responsive Lab Card grid with difficulty badges, pricing info, duration, and action buttons
  - [x] 3.4 Build `LabDetailModal` overlay displaying complete description, skill matrix, prerequisites, and purchase button
- [x] 4.0 Implement Lab Purchase Confirmation (`/admin/labs/:labId/purchase`)
  - [x] 4.1 Build checkout summary panel displaying selected lab title, duration, base price, and module outline
  - [x] 4.2 Implement interactive License Type selector (Single License, 1-Year Subscription, Enterprise Bulk) recalculating totals in real time
  - [x] 4.3 Implement simulated payment method selector and itemized cost breakdown with tax calculation
  - [x] 4.4 Implement purchase submission action with animated confirmation dialog, success toast, and redirect to inventory
- [x] 5.0 Implement User Management (`/admin/users`)
  - [x] 5.1 Implement filter & search header bar for user query, group filter, status filter, and bulk actions trigger
  - [x] 5.2 Build comprehensive User Data Table with user metadata columns, status indicator chips, group tags, and action dropdown
  - [x] 5.3 Implement `UserAddModal` and `UserEditModal` for adding new users or updating profile credentials and group assignments
  - [x] 5.4 Implement `BulkImportModal` supporting CSV file drop, syntax/field parsing preview, error summary, and batch upload
  - [x] 5.5 Implement user deletion confirmation modal dialog with warning before removing users
