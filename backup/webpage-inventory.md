# Cyber Range Platform - Webpage Inventory & Sitemap

## Overview
This document outlines all webpages required to implement the full Cyber Range Platform frontend. Pages are organized by user role (Admin, User, Shared) and include route paths, key features, and component dependencies.

---

## Quick Statistics
- **Total Pages/Routes**: 24
- **Admin-Only Pages**: 8
- **User-Only Pages**: 8
- **Shared Pages**: 5
- **Authentication Pages**: 3

---

## 1. AUTHENTICATION PAGES (Pre-Login)

### 1.1 Login Page
- **Route**: `/login`
- **Description**: Main entry point for the platform
- **Key Features**:
  - Email/password login form
  - "Remember Me" checkbox
  - Social login buttons (Google, GitHub)
  - SSO/Enterprise login toggle
  - "Forgot Password" link
  - Sign up link (if self-registration enabled)
- **Components**: LoginForm, SocialLoginButtons, SSO Selector
- **API Calls**: POST `/auth/login`

### 1.2 Forgot Password Page
- **Route**: `/forgot-password`
- **Description**: Password recovery flow
- **Key Features**:
  - Email input field
  - Submit button to send reset link
  - Success confirmation message
  - Back to login link
- **Components**: EmailForm, SuccessMessage
- **API Calls**: POST `/auth/forgot-password`

### 1.3 Reset Password Page
- **Route**: `/reset-password/:token`
- **Description**: Password reset via email link
- **Key Features**:
  - Password input field
  - Confirm password field
  - Validation (strength indicator)
  - Submit button
  - Error handling for expired tokens
- **Components**: PasswordResetForm, PasswordStrengthIndicator
- **API Calls**: POST `/auth/reset-password`

### 1.4 Register Page (Optional)
- **Route**: `/register`
- **Description**: Self-service user registration (if enabled)
- **Key Features**:
  - Full name, email, password fields
  - Email verification step
  - Terms & conditions checkbox
  - Already have account? link
- **Components**: RegistrationForm, EmailVerificationFlow
- **API Calls**: POST `/auth/register`, POST `/auth/verify-email`

---

## 2. ADMIN PAGES (Role-Protected)

### 2.1 Admin Dashboard (Main Hub)
- **Route**: `/admin/dashboard`
- **Description**: Overview of all admin operations
- **Key Features**:
  - Key metrics cards (total users, active labs, avg user score, groups created)
  - Recent activity feed
  - Quick action buttons (Add User, Allocate Lab, etc.)
  - Charts: User growth, lab completion rates, active sessions
  - Sidebar navigation to other admin pages
- **Components**: MetricsCard, ActivityFeed, QuickActionButtons, Chart, AdminSidebar
- **API Calls**: GET `/admin/dashboard/metrics`, GET `/admin/activity`

### 2.2 Lab Marketplace & Inventory
- **Route**: `/admin/labs`
- **Description**: Browse, purchase, and manage available labs
- **Key Features**:
  - Searchable/filterable lab catalog
  - Lab cards showing: name, description, difficulty, price, duration
  - "View Details" button opens lab detail modal
  - "Purchase" button for adding labs to inventory
  - Inventory section showing purchased labs
  - Bulk purchase option
  - Sort by: price, difficulty, popularity, recency
- **Components**: LabCard, LabCatalog, LabDetailModal, PurchaseForm, InventoryTable
- **API Calls**: GET `/admin/labs`, POST `/admin/labs/purchase`

### 2.3 Lab Purchase Confirmation
- **Route**: `/admin/labs/:labId/purchase` (or modal)
- **Description**: Confirmation & payment flow for lab purchases
- **Key Features**:
  - Lab summary (name, cost, license type)
  - License selection (single-use, annual, etc.)
  - Pricing breakdown
  - Payment method selector
  - Confirm purchase button
  - Success notification
- **Components**: PurchaseSummary, LicenseSelector, PaymentConfirmation
- **API Calls**: POST `/admin/labs/:labId/purchase`, GET `/admin/billing/methods`

### 2.4 User Management
- **Route**: `/admin/users`
- **Description**: Manage all platform users
- **Key Features**:
  - Table of all users with: name, email, group, join date, status
  - Search & filter by group, status, role
  - Add user button (opens modal or redirects to add form)
  - Edit user link (opens modal)
  - Delete user button with confirmation
  - Bulk import via CSV button
  - Export users report
  - Pagination or infinite scroll
- **Components**: UserTable, UserAddModal, UserEditModal, BulkImportForm, SearchBar, FilterPanel
- **API Calls**: GET `/admin/users`, POST `/admin/users`, PUT `/admin/users/:id`, DELETE `/admin/users/:id`, POST `/admin/users/bulk-import`

### 2.5 Group Management
- **Route**: `/admin/groups`
- **Description**: Create and organize user groups
- **Key Features**:
  - List of all groups with: name, member count, created date
  - Create new group button (opens modal)
  - Edit group button (opens modal)
  - Delete group confirmation
  - View members link (shows users in group)
  - Add/remove members from group
  - Bulk group operations
- **Components**: GroupTable, GroupCreateModal, GroupEditModal, MembersList, GroupActionsMenu
- **API Calls**: GET `/admin/groups`, POST `/admin/groups`, PUT `/admin/groups/:id`, DELETE `/admin/groups/:id`, GET `/admin/groups/:id/members`

### 2.6 Lab Allocation & Assignment
- **Route**: `/admin/allocations`
- **Description**: Assign purchased labs to specific groups
- **Key Features**:
  - Grid or table view: Groups (rows) × Labs (columns)
  - Checkbox or toggle to assign labs to groups
  - Visibility toggle (make lab visible/hidden per group)
  - Start date/end date fields for each allocation
  - Batch assignment (assign multiple labs to one group)
  - View allocation history
  - Revert allocation button
- **Components**: AllocationGrid, AllocationTable, GroupSelector, LabSelector, DateRangePicker, BatchAssignmentForm
- **API Calls**: GET `/admin/allocations`, POST `/admin/allocations`, PUT `/admin/allocations/:id`, DELETE `/admin/allocations/:id`

### 2.7 Lab Control & Status
- **Route**: `/admin/labs/control`
- **Description**: Real-time control of lab instances
- **Key Features**:
  - List of all active/scheduled labs
  - Status indicator (idle, running, paused, completed)
  - Start/Stop/Pause buttons for each lab
  - Confirmation dialog before starting/stopping
  - Active user count indicator
  - Lab duration & remaining time
  - Emergency stop button (all labs)
  - Logs or recent activity for each lab
- **Components**: LabControlPanel, LabStatusCard, ControlButtons, ConfirmationDialog, ActiveUsersIndicator
- **API Calls**: POST `/admin/labs/:labId/start`, POST `/admin/labs/:labId/stop`, GET `/admin/labs/:labId/status`, GET `/admin/labs/active-sessions`

### 2.8 Monitoring & Analytics
- **Route**: `/admin/monitoring`
- **Description**: Real-time monitoring of user progress and platform health
- **Key Features**:
  - Real-time leaderboard (top users)
  - Group performance comparison chart
  - Lab completion rates over time
  - Active user count (live update via WebSocket)
  - User progress table (each user's score, completion %, current lab)
  - Filter by group, time range, lab
  - Export analytics report
  - Performance heatmap
  - Optional: User activity timeline
- **Components**: RealtimeLeaderboard, PerformanceChart, ProgressTable, ActiveUsersIndicator, FilterPanel, ExportButton
- **API Calls**: GET `/admin/monitoring/metrics`, GET `/admin/monitoring/leaderboard`, GET `/admin/monitoring/user-progress`, WebSocket `/ws/admin/monitoring`

### 2.9 Admin Settings (Future)
- **Route**: `/admin/settings`
- **Description**: Platform configuration (future feature, can be skipped for MVP)
- **Key Features**:
  - Organization info (name, logo, colors)
  - Email notification templates
  - Lab scheduling preferences
  - User role permissions
  - API key management
- **Components**: SettingsForm, NotificationTemplateEditor, APIKeyManager
- **API Calls**: GET `/admin/settings`, PUT `/admin/settings`

### 2.10 Admin Automated Lab Scheduler
- **Route**: `/admin/scheduler`
- **Description**: Automated calendar scheduler for provisioning, email reminders, and container teardowns
- **Key Features**:
  - Calendar & tabular schedules overview
  - Schedule creation modal (Target Labs, Target Groups, Date & Time windows)
  - Auto-provisioning & email reminder dispatches
  - Force Start, Window Extension (+15m/+1h), and Immediate Teardown controls
- **Components**: ScheduleCalendar, ScheduleTable, ScheduleCreateModal, StatusBadges
- **API Calls**: GET `/admin/schedules`, POST `/admin/schedules`, PUT `/admin/schedules/:id`, DELETE `/admin/schedules/:id`

### 2.11 Admin CTF Competition Manager & Challenge Bank Hub
- **Route**: `/admin/ctf`
- **Description**: Control hub for CTFd-style Jeopardy & Attack-Defense competitions
- **Key Features**:
  - Competition creation wizard (Individual vs Team mode, Static vs Dynamic Decay scoring)
  - Challenge bank CRUD editor (Categories: Web, Pwn, Crypto, Forensics, Reverse, OSINT)
  - Flag validation string (`CTF{...}`), base points, decay parameters, and hint penalty costs
  - Scoreboard Freeze control toggle and Broadcast Announcement modal
  - Live flag submission log audit feed
- **Components**: CtfEventTable, ChallengeBankGrid, CtfChallengeModal, ScoreboardFreezeToggle, AnnouncementModal
- **API Calls**: GET `/admin/ctf/events`, POST `/admin/ctf/events`, POST `/admin/ctf/challenges`, POST `/admin/ctf/freeze`

---

## 3. USER PAGES (Role-Protected)

### 3.1 User Dashboard (Main Hub)
- **Route**: `/dashboard`
- **Description**: Personalized user overview and quick access
- **Key Features**:
  - Welcome greeting with user name
  - Quick stats: total score, current rank, labs completed
  - Progress bar (overall completion %)
  - Recent activity feed (challenges completed, rank changes)
  - Available labs carousel or quick-access grid
  - Suggested next lab (based on progress)
  - Sidebar navigation to user pages
  - Notification bell with unread count
- **Components**: WelcomeCard, StatsCard, ProgressBar, ActivityFeed, LabCarousel, UserSidebar, NotificationBell
- **API Calls**: GET `/user/dashboard`, GET `/user/stats`, GET `/user/activity`, GET `/user/notifications`

### 3.2 Available Labs
- **Route**: `/labs`
- **Description**: Browse all labs assigned to the user
- **Key Features**:
  - List/grid view of available labs
  - Lab cards showing: name, difficulty, estimated time, status (not started, in progress, completed)
  - Color-coded difficulty badges (easy/medium/hard)
  - Search & filter (by difficulty, status, type)
  - "Start Lab" button or action menu
  - Lab details modal showing full description
  - "Resume Lab" if previously started
  - Sort options (by difficulty, time, recency)
- **Components**: LabGrid, LabCard, LabDetailModal, FilterPanel, SearchBar, DifficultyBadge
- **API Calls**: GET `/user/labs`, GET `/user/labs/:labId`, POST `/user/labs/:labId/start`

### 3.3 Lab Details Modal
- **Route**: Overlay on `/labs` or `/labs/:labId`
- **Description**: Detailed info about a specific lab before starting
- **Key Features**:
  - Lab name & description
  - Difficulty level & estimated completion time
  - Learning objectives (bullet points)
  - Number of challenges & scoring breakdown
  - Prerequisite labs (if any)
  - "Start Lab" button
  - "View Stats" link (if completed before)
  - Close button
- **Components**: LabDetailModal, LearningObjectivesList, StartLabButton
- **API Calls**: GET `/user/labs/:labId`

### 3.4 Lab Challenge Interface / Session
- **Route**: `/labs/:labId/session/:sessionId`
- **Description**: Interactive lab environment where users solve challenges
- **Key Features**:
  - Challenge title & description
  - Objectives and success criteria
  - Input area (text field, file upload, or form)
  - "Submit Answer" button
  - Real-time feedback (pass/fail, points awarded)
  - Progress indicator (Challenge X of Y)
  - Timer (if time-limited)
  - Lab sidebar with challenge list
  - Hints button (if available)
  - Go back to dashboard button
  - Live score updates
  - Chat or support button (optional)
- **Components**: ChallengeDisplay, InputForm, FeedbackMessage, ProgressIndicator, Timer, ChallengeSidebar, SubmitButton
- **API Calls**: GET `/user/labs/:labId/session/:sessionId`, POST `/user/challenges/:challengeId/submit`, GET `/user/labs/:labId/session/:sessionId/progress`, WebSocket `/ws/user/session/:sessionId`

### 3.5 Progress Tracking
- **Route**: `/progress`
- **Description**: Personal progress overview and statistics
- **Key Features**:
  - Overall stats (total score, rank, labs completed, challenges solved)
  - Progress bars for each lab
  - Skill breakdown chart (categories: detection, mitigation, analysis, etc.)
  - Time spent per lab
  - Accuracy/success rate
  - Trend line (score improvement over time)
  - Export progress report
  - Filter by time range (last week, month, all-time)
- **Components**: ProgressChart, StatsCard, SkillBreakdown, LabProgressBar, TrendChart, ExportButton
- **API Calls**: GET `/user/progress`, GET `/user/progress/detailed`

### 3.6 Personal Leaderboard
- **Route**: `/leaderboards/personal`
- **Description**: User's performance in each lab
- **Key Features**:
  - Table: Lab Name, Best Score, Rank, Completion Date
  - Sort by: score, lab difficulty, date completed
  - Filter by difficulty or lab type
  - View rank distribution (percentile)
  - Compare to class average
- **Components**: PersonalLeaderboardTable, SortControls, FilterPanel, RankDistributionChart
- **API Calls**: GET `/leaderboards/personal`

### 3.7 Group Leaderboard
- **Route**: `/leaderboards/group`
- **Description**: Ranking of user within their group
- **Key Features**:
  - Table: Rank #, User Name, Total Score, Labs Completed, Last Activity
  - Highlight current user's row
  - Sort by: score, completion, activity
  - Filter by: lab, time period
  - Show user's position (e.g., "You are ranked #5 out of 45")
  - Optional: Show top 3 with badges
- **Components**: GroupLeaderboardTable, UserHighlight, RankBadge, FilterPanel
- **API Calls**: GET `/leaderboards/group`

### 3.8 Global Leaderboard
- **Route**: `/leaderboards/global`
- **Description**: Top performers across all groups and users
- **Key Features**:
  - Table: Global Rank, User Name, Group, Total Score, Labs Completed
  - Highlight current user's row (if applicable)
  - Medal/trophy icons for top 3
  - Pagination (top 100, or infinite scroll)
  - Filter by: group, lab, time period
  - Show percentage gap to #1 user
- **Components**: GlobalLeaderboardTable, TopRankBadges, UserHighlight, PaginationControls, FilterPanel
- **API Calls**: GET `/leaderboards/global`

### 3.9 User Profile (Future)
- **Route**: `/profile` (optional for MVP)
- **Description**: User's public profile and settings
- **Key Features**:
  - Avatar & bio
  - Stats summary
  - Favorite labs
  - Settings: email preferences, password change, notifications
- **Components**: ProfileHeader, StatsWidget, SettingsForm
- **API Calls**: GET `/user/profile`, PUT `/user/profile`

### 3.10 CTF Competition Portal
- **Route**: `/ctf`
- **Description**: Entry point for browsing active, upcoming, and past CTF competitions
- **Key Features**:
  - Active/Upcoming CTF event cards with ticking countdown clocks
  - Team creation & 6-digit invite code join dialogs
  - Direct enter-competition routing
- **Components**: CtfEventGrid, TeamRegistrationModal, CountdownTimer
- **API Calls**: GET `/ctf/events`, POST `/ctf/teams/create`, POST `/ctf/teams/join`

### 3.11 Jeopardy CTF Challenge Arena
- **Route**: `/ctf/events/:eventId`
- **Description**: Interactive category matrix for solving CTF challenges
- **Key Features**:
  - Filterable category grid (Web, Pwn, Crypto, Reverse, Forensics, OSINT)
  - Interactive challenge details modal with Markdown description & file asset downloads
  - Hint reveal modals with point penalty warning
  - Flag input form (`CTF{...}`) with real-time pass/fail feedback and solved badges
- **Components**: JeopardyMatrixGrid, ChallengeModal, FlagSubmissionForm, HintUnlockModal
- **API Calls**: GET `/ctf/events/:eventId/challenges`, POST `/ctf/challenges/:id/submit`, POST `/ctf/hints/:id/unlock`

### 3.12 CTF Scoreboard & Solves Trajectory
- **Route**: `/ctf/events/:eventId/scoreboard`
- **Description**: Live competition scoreboard and dynamic solve graphs
- **Key Features**:
  - Gold, silver, and bronze champion podium cards
  - Interactive multi-line SVG solve trajectory graph tracking score progression over time
  - Category solve badge grid matrix per participant/team
  - Scoreboard Freeze alert banner when active
- **Components**: CtfScoreboardTable, TopPodiumCards, SolveTrajectoryChart, FreezeAlertBanner
- **API Calls**: GET `/ctf/events/:eventId/scoreboard`

---

## 4. SHARED PAGES (All Users)

### 4.1 Root / Landing Page
- **Route**: `/` 
- **Description**: Redirect to login or dashboard based on auth status
- **Key Features**:
  - Auto-redirect to `/login` if not authenticated
  - Auto-redirect to `/admin/dashboard` or `/dashboard` if authenticated
- **Components**: RedirectLogic
- **API Calls**: GET `/auth/me` (check user role)

### 4.2 Page Not Found (404)
- **Route**: `*` (catch-all)
- **Description**: Error page for invalid routes
- **Key Features**:
  - Friendly error message
  - Suggestions for valid pages based on user role
  - Home/Dashboard link
  - Contact support link
- **Components**: 404ErrorPage
- **API Calls**: None

### 4.3 Error Page (500)
- **Route**: `/error`
- **Description**: Generic server error page
- **Key Features**:
  - Error code & message
  - Retry button
  - Dashboard link
  - Report bug link
- **Components**: ErrorPage, RetryButton
- **API Calls**: None

### 4.4 Maintenance Page
- **Route**: `/maintenance`
- **Description**: Shown when platform is in maintenance mode
- **Key Features**:
  - Maintenance banner
  - Estimated downtime
  - Status page link
  - Email to check status option
- **Components**: MaintenancePage
- **API Calls**: GET `/status/maintenance-info` (optional)

### 4.5 Unauthorized Page (403)
- **Route**: `/unauthorized`
- **Description**: Access denied page
- **Key Features**:
  - Clear message about missing permissions
  - Instructions to contact admin
  - Dashboard/Home link
- **Components**: UnauthorizedPage
- **API Calls**: None

---

## 5. LAYOUT & NAVIGATION STRUCTURE

### Header (All Pages, Post-Login)
- **Components**: 
  - Logo (clickable, goes to dashboard)
  - User/Admin name
  - Notification bell with badge (unread count)
  - User dropdown menu (Profile, Settings, Logout)
  - Search bar (optional, for labs/users)
- **Responsive**: Hamburger menu on mobile, full header on desktop

### Sidebar Navigation (All Pages, Post-Login)

#### Admin Sidebar
- Dashboard
- Labs (Marketplace)
- Allocations
- Users
- Groups
- Lab Control
- Monitoring
- Settings

#### User Sidebar
- Dashboard
- My Labs
- Progress
- Leaderboards
  - Personal
  - Group
  - Global
- Profile (optional)

### Footer (Optional)
- Copyright info
- Help/Support link
- Documentation link
- Version info
- Status page link

---

## 6. ROUTE HIERARCHY OVERVIEW

```
/
├── /login
├── /register
├── /forgot-password
├── /reset-password/:token
├── /admin (Protected - Admin Role)
│   ├── /dashboard
│   ├── /labs
│   │   └── /:labId/purchase
│   ├── /users
│   ├── /groups
│   ├── /allocations
│   ├── /labs/control
│   ├── /monitoring
│   └── /settings
├── /dashboard (Protected - User Role)
├── /labs (Protected - User Role)
│   └── /:labId/session/:sessionId
├── /progress (Protected - User Role)
├── /leaderboards (Protected - User Role)
│   ├── /personal
│   ├── /group
│   └── /global
├── /profile (Protected - User Role, Optional)
├── /error
├── /unauthorized
├── /maintenance
└── /* (404)
```

---

## 7. REAL-TIME CONNECTIONS (WebSocket)

### Admin Monitoring WebSocket
- **Endpoint**: `ws://api.platform.com/ws/admin/monitoring`
- **Emits**: User progress updates, score changes, lab status changes
- **Frequency**: Every 2-5 seconds

### User Session WebSocket
- **Endpoint**: `ws://api.platform.com/ws/user/session/:sessionId`
- **Emits**: Challenge feedback, score updates, leaderboard changes
- **Frequency**: Real-time on submission

---

## 8. IMPLEMENTATION PRIORITY (2-3 Week Timeline)

### Week 1
- Authentication pages (Login, Register, Reset Password)
- Root navigation structure (Header, Sidebar)
- User Dashboard & Lab Listing
- Admin Dashboard

### Week 2
- Lab Challenge Interface (core)
- User Leaderboards (all 3 types)
- Admin User Management
- Admin Lab Marketplace

### Week 3
- Admin Lab Allocation
- Admin Lab Control
- Progress Tracking Page
- Admin Monitoring
- Real-time updates & WebSocket integration
- Polish, testing, bug fixes

---

## 9. COMPONENT REUSE CHECKLIST

These components should be built once and reused across multiple pages:

- [ ] **Button Variants**: Primary, Secondary, Danger, Disabled
- [ ] **Card Component**: For labs, leaderboard entries, metrics
- [ ] **Modal/Dialog**: For confirmations, details, forms
- [ ] **Table Component**: Sortable, filterable, paginated
- [ ] **Input Fields**: Text, email, password, with validation
- [ ] **Notification/Toast**: For success/error/warning messages
- [ ] **Loading Skeleton**: For data fetching states
- [ ] **Badge/Chip**: For status, difficulty, role indicators
- [ ] **Navigation Sidebar**: Reused for both admin and user
- [ ] **Header**: Consistent across all pages
- [ ] **Chart Component**: For graphs and visualizations
- [ ] **Search & Filter Panel**: Reused in multiple list pages

---

## 10. API ENDPOINT SUMMARY

| Method | Endpoint | Purpose | Page(s) |
|--------|----------|---------|---------|
| POST | `/auth/login` | User authentication | Login |
| POST | `/auth/register` | User registration | Register |
| POST | `/auth/forgot-password` | Password reset request | Forgot Password |
| POST | `/auth/reset-password` | Complete password reset | Reset Password |
| GET | `/auth/me` | Get current user info | All protected |
| POST | `/auth/logout` | Logout user | All |
| GET | `/admin/dashboard/metrics` | Dashboard stats | Admin Dashboard |
| GET | `/admin/labs` | Lab marketplace | Lab Marketplace |
| POST | `/admin/labs/purchase` | Purchase lab | Lab Purchase |
| GET | `/admin/users` | List users | User Management |
| POST | `/admin/users` | Add user | User Management |
| PUT | `/admin/users/:id` | Edit user | User Management |
| DELETE | `/admin/users/:id` | Delete user | User Management |
| GET | `/admin/groups` | List groups | Group Management |
| POST | `/admin/groups` | Create group | Group Management |
| GET | `/admin/allocations` | Lab allocations | Lab Allocation |
| POST | `/admin/allocations` | Assign labs to groups | Lab Allocation |
| POST | `/admin/labs/:id/start` | Start lab | Lab Control |
| POST | `/admin/labs/:id/stop` | Stop lab | Lab Control |
| GET | `/admin/monitoring/metrics` | Monitoring data | Monitoring |
| GET | `/user/dashboard` | User dashboard data | User Dashboard |
| GET | `/user/labs` | Available labs | Lab Listing |
| POST | `/user/labs/:id/start` | Start lab session | Lab Listing |
| POST | `/user/challenges/:id/submit` | Submit challenge answer | Lab Session |
| GET | `/user/progress` | User progress stats | Progress Page |
| GET | `/leaderboards/personal` | Personal leaderboard | Personal LB |
| GET | `/leaderboards/group` | Group leaderboard | Group LB |
| GET | `/leaderboards/global` | Global leaderboard | Global LB |

---

**Total Estimated Components**: ~40-50 reusable components  
**Total Estimated Pages/Routes**: 24  
**Estimated Development Hours**: 120-160 hours (2-3 weeks, 1 developer)

---

**Last Updated**: 2026-07-16  
**Status**: Ready for Frontend Development
