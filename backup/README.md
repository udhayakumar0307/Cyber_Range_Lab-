# 🛡️ Cyber Range Platform

> Enterprise-Grade Cybersecurity Training, Assessment & Virtual Lab Platform

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue)
![Docker](https://img.shields.io/badge/Docker-Lab_Containers-2496ED)
![License](https://img.shields.io/badge/License-MIT-green)

---

# 🚀 Overview

Cyber Range is an enterprise-grade cybersecurity training platform that enables universities, enterprises, and training organizations to conduct practical cybersecurity education through isolated virtual lab environments.

The platform provides role-based access for administrators and students, challenge management, learning paths, containerized command-line labs, real-time monitoring, progress analytics, and secure authentication.

---

# ✨ Features

## 👨‍🎓 Student Portal

### Dashboard
- Personalized dashboard
- XP & Level progression
- Learning statistics
- Active labs
- Recent activities
- Achievement summary

### Learning Modules
- Available Labs
- Learning Paths
- CTF Challenges
- Command Line Lab
- Progress Tracking
- Leaderboards

### Interactive Command Line Lab

Features include

- Docker-based isolated Linux terminal
- Real Linux commands
- Interactive objectives
- Hint system
- Flag validation
- Module progression
- Automatic scoring
- Session timer
- Progress persistence

### Profile

- User profile
- Avatar
- Personal statistics
- Account information

### Settings

- Theme preference
- Notification settings
- Security settings
- Password management

---

# 👨‍💼 Administrator Portal

## Dashboard

- Platform analytics
- Active users
- Running labs
- User statistics
- Recent activities
- Performance metrics

## User Management

- Create users
- Edit users
- Delete users
- Role management
- Search & filtering
- Bulk import

## Group Management

- Create groups
- Assign students
- Manage instructors
- View members
- Edit groups

## Lab Management

- Available lab catalog
- Purchase marketplace
- Lab allocation
- Scheduler
- Challenge assignment
- Lab control panel

## Monitoring

- Live running containers
- CPU & Memory monitoring
- User activity
- Session monitoring
- Emergency stop controls

---

# 🔐 Authentication

Implemented authentication system includes

- Login
- Register
- Email OTP Verification
- Forgot Password
- Reset Password
- JWT Authentication
- Protected Routes
- Role Based Access Control (RBAC)

---

# 📊 Progress & Analytics

Students can monitor

- XP
- Level
- Completed labs
- Learning progress
- Weekly statistics
- Leaderboards
- Achievements
- Completion percentage

---

# 🏆 CTF Platform

Implemented

- CTF Portal
- Active Competitions
- Scoreboard
- Challenge Sessions
- Team Rankings
- Dynamic Scoring

Admin Features

- Create CTF
- Schedule competitions
- Manage challenges
- View submissions
- Monitor participants

---

# 🐳 Command Line Lab

Interactive Linux environment supporting

- pwd
- ls
- cd
- cat
- touch
- mkdir
- rm
- cp
- mv
- chmod
- grep
- find
- echo
- nano
- vim
- sudo (simulated)
- nmap (simulated)

Features

- Docker Containers
- WebSocket Terminal
- Session Validation
- Automatic Flag Detection
- Progress Saving
- Hint System
- Module Based Learning

---

# 🎨 UI Features

- Responsive Design
- Light Theme
- Dark Theme
- Modern Dashboard
- Sidebar Navigation
- Animated Components
- Mobile Friendly
- Accessible UI

---

# 🛠 Technology Stack

## Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide React

## Backend

- FastAPI
- SQLAlchemy
- Alembic
- JWT Authentication
- REST APIs

## Database

- PostgreSQL

## Infrastructure

- Docker
- Docker Compose

## Email

- AWS SES

---

# 📂 Project Structure

```
CyberRange
│
├── backend/
│   ├── app/
│   ├── alembic/
│   ├── models/
│   ├── routers/
│   ├── services/
│   └── main.py
│
├── public/
│
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── admin/
│   │   ├── user/
│   │   └── shared/
│   │
│   ├── context/
│   ├── hooks/
│   ├── pages/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── user/
│   │   └── shared/
│   │
│   ├── services/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
│
├── tasks/
├── package.json
└── README.md
```

---

# 🚀 Getting Started

## Clone

```bash
git clone https://github.com/umadhatri/cyberrange.git
cd cyberrange
```

## Install

```bash
npm install
```

## Run Frontend

```bash
npm run dev
```

## Backend

```bash
cd backend

python -m venv venv

source venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

---

# 📌 Current Status

## ✅ Completed

- Authentication System
- JWT Security
- Student Dashboard
- Admin Dashboard
- User Management
- Group Management
- Profile
- Settings
- Progress Tracking
- Leaderboards
- CTF Module
- Command Line Lab
- Docker Integration
- Backend APIs
- PostgreSQL Integration
- AWS SES Email
- Responsive UI
- Theme Support

---

# 🔒 Security Features

- JWT Authentication
- Password Hashing
- Role Based Access Control
- Protected Routes
- Secure REST APIs
- Input Validation
- Session Management
- Docker Isolation

---

# 📄 License

This project is licensed under the MIT License.

---

## 💳 Razorpay Configuration

To enable production payments for enterprise lab licenses, configure your Razorpay credentials:

### Backend (.env)
```env
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Frontend (.env)
```env
VITE_RAZORPAY_KEY_ID=your_key_id
```

### Obtaining Credentials from Razorpay Dashboard
1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Settings** → **API Keys**.
3. Click **Generate Key** to receive your `RAZORPAY_KEY_ID` (Key ID) and `RAZORPAY_KEY_SECRET` (Key Secret).
4. Navigate to **Settings** → **Webhooks** and configure a webhook pointing to `https://your-domain.com/api/v1/payments/webhook` with event subscriptions `payment.captured`, `payment.failed`, `refund.processed`, and `subscription.charged`. Set your secret key as `RAZORPAY_WEBHOOK_SECRET`.

---

## Developed for

Cyber Range Platform for Cybersecurity Training, Practical Learning, CTF Competitions, and Virtual Lab Management.
