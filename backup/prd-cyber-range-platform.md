# PRD: Cyber Range Platform - Full-Featured Frontend

## Introduction / Overview

The **Cyber Range Platform** is a cybersecurity learning and training application that enables organizations to deliver hands-on, real-time security challenges to users. The platform supports two distinct user roles:

1. **Admin Users**: Manage lab inventory, allocate resources to groups, monitor user progress, and control lab availability
2. **Regular Users**: Access assigned labs, solve security challenges in real-time, track their progress, and compete on leaderboards

This PRD focuses on building a **full-featured, clean, light-themed frontend** that supports both flows simultaneously with real-time updates, scoring, and notifications. The design prioritizes usability and performance with a 2-3 week development timeline.

---

## Goals

1. **Rapid Deployment**: Deliver a complete, polished frontend in 2-3 weeks with all core features
2. **Real-Time Experience**: Support live challenge scoring, instant leaderboard updates, and email notifications
3. **Role-Based Clarity**: Create distinct, intuitive experiences for admins and users with no confusion between workflows
4. **Accessibility & Polish**: Build a clean, light-themed interface that is responsive, keyboard-accessible, and visually distinctive
5. **Scalability**: Architect the frontend to support future feature additions (analytics, advanced admin controls, etc.)

---

## User Stories

### Admin User Stories

**Story 1: Lab Procurement**
- As an admin, I want to browse available labs and purchase them based on my organization's needs
- I can see lab descriptions, pricing, estimated duration, and difficulty level
- I can purchase multiple labs at once and manage my lab inventory

**Story 2: User & Group Management**
- As an admin, I want to add users to the platform and organize them into groups
- I can create groups, add/remove users, and bulk import users via CSV
- I can assign different labs to different groups based on training requirements

**Story 3: Lab Allocation & Control**
- As an admin, I want to allocate purchased labs to specific groups
- I can make labs visible or hidden for selected groups
- I can start and stop lab instances at any time, and users see labs only when they're active

**Story 4: Progress Monitoring**
- As an admin, I want to monitor user progress and performance across all labs
- I can view scores, completion rates, time spent, and individual/group leaderboards
- I can see which users are currently active in labs and export reports

### User Stories

**Story 1: Lab Discovery & Access**
- As a user, I want to see the labs my admin has assigned to me
- I receive an email notification when a new lab becomes available
- I can see lab descriptions and difficulty levels before starting

**Story 2: Challenge Solving**
- As a user, I want to access a lab and solve cybersecurity challenges in real-time
- The system provides immediate feedback (pass/fail) for each challenge
- I can see my progress within the lab and estimated time to completion

**Story 3: Scoring & Leaderboards**
- As a user, I want my score calculated in real-time as I complete challenges
- I can see my personal rank on individual lab leaderboards
- I can see group leaderboards and global rankings

**Story 4: Progress Tracking**
- As a user, I want to see my overall progress across all labs
- I can track my scores, completion percentage, and skill improvements
- I receive email notifications for lab starts and important updates

---

## Functional Requirements

### Authentication & Access Control

1. **Multi-Method Authentication**: The system must support email/password, Google OAuth, GitHub OAuth, and enterprise SSO (SAML/OAuth)
2. **Login Page**: Display a clean login form with social login buttons and an option to switch to SSO
3. **Password Recovery**: Provide "Forgot Password" functionality that sends a reset link via email
4. **Session Management**: Maintain secure sessions with auto-logout after 30 minutes of inactivity
5. **Role-Based Access**: Redirect users to appropriate dashboards based on their role (admin vs. user)

### Admin Dashboard

6. **Dashboard Overview**: Show key metrics at a glance (total users, active labs, group performance)
7. **Lab Marketplace**: Provide a browsable list of available labs with search, filter, and sorting capabilities
8. **Lab Purchase Flow**: Allow admins to select labs, review pricing, and complete purchases
9. **User Management Page**: Display a table of all users with ability to add, edit, remove, and bulk import users
10. **Group Management Page**: Allow creation, editing, and deletion of user groups
11. **Lab Allocation Page**: Show a grid/table interface to assign purchased labs to groups
12. **Lab Visibility Controls**: Toggle lab visibility on/off for each group independently
13. **Lab Control Panel**: Provide start/stop buttons for each lab with confirmation dialogs
14. **Admin Monitoring Page**: Display real-time charts/tables of user progress, scores, and completion rates

### User Dashboard

15. **User Dashboard Overview**: Show personalized greeting, assigned labs, and quick stats (total score, rank, labs completed)
16. **Available Labs List**: Display all labs assigned to the user's group with status indicators (active, coming soon, completed)
17. **Lab Details Modal**: Show lab description, difficulty, estimated time, and "Start Lab" button
18. **Challenge Interface**: Provide an interactive area for solving challenges with:
    - Challenge description and objectives
    - Input/response fields for submissions
    - Real-time feedback (pass/fail/points awarded)
    - Progress indicator (X of Y challenges completed)
    - Timer (if time-limited challenges exist)
19. **Progress Tracking Page**: Display a visual breakdown of labs completed, scores earned, and skill improvements
20. **Leaderboard Pages**: 
    - Personal lab leaderboard (showing top scores for each lab)
    - Group leaderboard (showing user rankings within the group)
    - Global leaderboard (showing top performers across all groups)

### Real-Time Features

21. **Live Score Updates**: Use WebSockets or Server-Sent Events (SSE) to instantly update scores and leaderboards
22. **Email Notifications**: Send emails to users when:
    - A lab becomes available to their group
    - A lab is about to start
    - They complete a lab
    - They rank up on a leaderboard
23. **Active User Indicators**: Show which users are currently active in labs (admin monitoring)

### UI/UX Standards

24. **Responsive Design**: All pages must work seamlessly on desktop (1920px), tablet (768px), and mobile (375px)
25. **Light Theme**: Use a soft, accessible light color palette that doesn't cause eye strain
26. **Keyboard Navigation**: All interactive elements must be keyboard-accessible with visible focus states
27. **Loading States**: Display skeleton loaders or spinners during data fetching
28. **Error Handling**: Show clear, actionable error messages when operations fail
29. **Confirmation Dialogs**: Use modal confirmations for destructive actions (deleting users, stopping labs)

---

## Non-Goals (Out of Scope)

- **Advanced Analytics**: Detailed historical data analysis, trend predictions, or custom report builders (future feature)
- **Gamification Advanced Features**: Achievements, badges, or custom reward systems (future feature)
- **Mobile App**: Native iOS/Android apps (web-responsive design only)
- **Lab Content Creation**: Admins cannot create custom labs (only purchase and allocate existing ones)
- **Payment Processing**: Billing and payment systems are handled externally; frontend assumes labs are pre-purchased
- **User Profile Customization**: Custom avatars, bios, or extensive profile editing
- **Multi-Language Support**: Initial launch is English-only

---

## Design Considerations

### Light-Theme Color Palette
- **Primary Blue**: #0052CC (authority, trust, cybersecurity)
- **Success Green**: #28A745 (challenges passed, secure status)
- **Warning Orange**: #FFA500 (challenges failed, alerts)
- **Neutral Light**: #F8F9FA (backgrounds, subtle containers)
- **Neutral Dark**: #2D3436 (text, primary content)
- **Accent Purple**: #6F42C1 (leaderboards, rankings, secondary actions)

### Typography
- **Display (Headings)**: Inter Bold, 24px–32px (strong, modern, professional)
- **Body**: Inter Regular, 14px–16px (clean, readable)
- **Monospace (Code/Data)**: Courier New or Fira Code, 12px–14px (for challenge outputs, scores)

### Layout & Structure
- **Grid System**: 12-column responsive grid with 16px gutters
- **Spacing**: Consistent 8px, 16px, 24px, 32px spacing scale
- **Signature Element**: Animated "shield + lockpad" icon that subtly appears on key actions (lab start, challenge submission) to reinforce the cybersecurity theme

### Key Pages Template
- **Header**: Logo, user/admin name, quick navigation, notification bell, logout
- **Sidebar (Admin)**: Navigation links to Dashboard, Labs, Users, Groups, Allocations, Monitoring
- **Sidebar (User)**: Navigation links to Dashboard, My Labs, Progress, Leaderboards
- **Footer**: Copyright, links to help/docs, version info (optional for web app)

---

## Technical Considerations

### Frontend Framework & Tools
- **Framework**: React 18+ (supports rapid development and component reusability)
- **State Management**: Redux Toolkit or Zustand (for managing admin/user state, real-time updates)
- **Real-Time Communication**: Socket.io or native WebSockets for live leaderboard updates and active user indicators
- **UI Component Library**: Tailwind CSS + Headless UI (for rapid prototyping with accessibility built-in)
- **HTTP Client**: Axios or Fetch API with interceptors for auth and error handling
- **Notifications**: React Toastify or custom toast system for user feedback

### Performance & Security
- **Lazy Loading**: Code-split pages by role (admin pages separate from user pages)
- **Memoization**: Use React.memo and useMemo for large lists (leaderboards, user tables)
- **CORS & CSRF**: Ensure backend supports CORS headers; use CSRF tokens for state-changing requests
- **Token Storage**: Store JWT tokens in httpOnly cookies (not localStorage) for XSS protection
- **Rate Limiting**: Implement client-side debouncing for form submissions and API calls

### API Assumptions
- **Authentication Endpoints**: POST /auth/login, POST /auth/register, POST /auth/refresh-token, POST /auth/logout
- **Admin Endpoints**: 
  - GET /admin/labs, POST /admin/labs/purchase
  - GET /admin/users, POST /admin/users, PUT /admin/users/:id, DELETE /admin/users/:id
  - GET /admin/groups, POST /admin/groups, PUT /admin/groups/:id
  - GET /admin/allocations, POST /admin/allocations
  - GET /admin/monitoring (real-time user progress)
- **User Endpoints**:
  - GET /user/labs (assigned labs)
  - POST /user/labs/:labId/start (begin a lab)
  - POST /user/challenges/:challengeId/submit (submit challenge response)
  - GET /user/progress (personal stats)
  - GET /leaderboards/:labId, GET /leaderboards/group, GET /leaderboards/global

---

## Success Metrics

1. **Development Speed**: Deliver all required pages and features within 2-3 weeks
2. **User Engagement**: 90%+ of users who start a lab complete at least one challenge
3. **Real-Time Performance**: Leaderboard updates within 2 seconds of challenge submission
4. **Accessibility**: WCAG 2.1 AA compliance (keyboard navigation, color contrast, screen reader support)
5. **Mobile Responsiveness**: All pages render correctly on devices ≥375px width
6. **Error Recovery**: Users can recover from network errors without losing progress
7. **Admin Efficiency**: Admins can allocate labs to 100 users in under 5 minutes

---

## Page Inventory & Site Map

### Authentication Pages
- **Login Page** (`/login`)
- **SSO/OAuth Callback Handling** (redirect from social providers)
- **Forgot Password Page** (`/forgot-password`)
- **Reset Password Page** (`/reset-password/:token`)
- **Register Page** (`/register`) - if self-signup is enabled

### Admin Routes (Protected by Role)
- **Admin Dashboard** (`/admin/dashboard`)
- **Lab Marketplace** (`/admin/labs`)
- **Lab Purchase Confirmation** (`/admin/labs/:labId/purchase`)
- **User Management** (`/admin/users`)
- **Group Management** (`/admin/groups`)
- **Lab Allocation** (`/admin/allocations`)
- **Lab Control Panel** (`/admin/labs/control`)
- **Monitoring & Analytics** (`/admin/monitoring`)
- **Admin Settings** (`/admin/settings`)

### User Routes (Protected by Role)
- **User Dashboard** (`/dashboard`)
- **Available Labs** (`/labs`)
- **Lab Details Modal** (modal overlay on `/labs` or dedicated `/labs/:labId`)
- **Lab Instance / Challenge Interface** (`/labs/:labId/session/:sessionId`)
- **Progress Tracking** (`/progress`)
- **Leaderboard - Personal** (`/leaderboards/personal`)
- **Leaderboard - Group** (`/leaderboards/group`)
- **Leaderboard - Global** (`/leaderboards/global`)

### Shared Pages
- **404 Not Found** (`*`)
- **500 Error** (`/error`)
- **Maintenance Page** (`/maintenance`) - optional for planned downtime

### Total Page Count: **20-25 pages/routes** (depending on whether modals or dedicated pages are used)

---

## Open Questions

1. Should the challenge interface (lab submission) support file uploads, or only text/form inputs?
2. Do challenges have a time limit, or are they untimed?
3. Should admins be able to manually adjust user scores, or is this handled by the backend only?
4. Are there different types of notifications (in-app vs. email), and should users be able to configure notification preferences?
5. Should the leaderboard reset periodically (weekly/monthly), or is it cumulative?
6. Is there a need for user profile pages where other users can see each other's stats?
7. Should admins have a "batch operations" feature (e.g., send bulk messages to a group)?

---

## Appendix: Design Principles for Implementation

### Light-Theme Anti-Patterns to Avoid
- **Avoid pure white (#FFFFFF)** backgrounds; use soft off-white (#F8F9FA) to reduce eye strain
- **Avoid low contrast**: Ensure text is at least 4.5:1 ratio for accessibility
- **Avoid flat, corporate feel**: Use subtle shadows (0 2px 8px rgba(0,0,0,0.1)) and micro-interactions to add depth

### Micro-Interactions
- **Hover States**: Buttons and interactive elements should show a subtle color shift or shadow lift
- **Loading Animations**: Use gentle spinners or skeleton screens, not aggressive spinners
- **Success Feedback**: Quick, satisfying animations when a challenge is submitted or score updates (short duration: 300-500ms)
- **Transitions**: Use 200-300ms transitions for page/modal changes (not jarring)

### Component Reusability
- **Buttons**: Create variants (primary, secondary, danger) to reduce code duplication
- **Cards**: Use a card component for labs, leaderboard entries, and group displays
- **Tables**: Build a flexible table component for user/group management and monitoring pages
- **Modals**: Centralized modal component for confirmations, lab details, and alerts
- **Notifications**: Reusable toast/snackbar for API responses and user feedback

---

**Document Version**: 1.0  
**Last Updated**: 2026-07-16  
**Status**: Ready for Development
