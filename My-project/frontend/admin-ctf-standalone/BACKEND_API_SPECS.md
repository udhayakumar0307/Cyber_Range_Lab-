# Admin CTF Backend API Specifications

This document outlines the API endpoints, request payloads, response schemas, and authentication headers required by the **Admin CTF Control Deck** frontend. This is designed for the backend development team to build or adapt the API server for this module.

## Global Configuration

- **Headers**:
  Every administrative API request must include the JWT authentication header:
  ```http
  Authorization: Bearer <cystar_token>
  Content-Type: application/json
  ```
- **Base URL**: Sourced from the frontend environment variable `NEXT_PUBLIC_API_URL` (typically `http://localhost:8000` or production URL).

---

## 1. Authentication & Users

### Dev Login Participant Simulation
- **Endpoint**: `POST /auth/dev-login-participant`
- **Purpose**: Creates or logs in a mock participant for local testing environments.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "name": "Alex Operator",
    "role": "participant"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "access_token": "eyJhbG..."
    }
  }
  ```

### List Registered Users
- **Endpoint**: `GET /auth/admin/users`
- **Purpose**: Feeds user drop-downs (such as Manual Billing Access Grants and Group Onboarding rosters).
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "users": [
        {
          "user_id": "uuid-123",
          "email": "user@example.com",
          "role": "participant",
          "is_active": true,
          "created_at": "2026-06-30T10:00:00Z"
        }
      ]
    }
  }
  ```

---

## 2. Deployments & Lab Management

### Get Active Statuses
- **Endpoint**: `GET /labs/status`
- **Purpose**: Fetches statuses of current live instances.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "deployments": [
        {
          "deployment_id": "dep-456",
          "content_id": "scenario-uuid",
          "user_id": "uuid-123",
          "user_email": "user@example.com",
          "lab_title": "AD Enterprise Range",
          "lab_type": "windows",
          "status": "running",
          "public_ip": "203.0.113.1",
          "created_at": "2026-06-30T09:00:00Z"
        }
      ]
    }
  }
  ```

### Spin up a New Deployment
- **Endpoint**: `POST /labs/deploy`
- **Request Body**:
  ```json
  {
    "content_id": "scenario-uuid",
    "lab_type": "windows",
    "participant_emails": ["user1@example.com", "user2@example.com"]
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Deployment initiated successfully",
    "data": {
      "deployment_id": "dep-456",
      "status": "provisioning"
    }
  }
  ```

### Terminate a Deployment
- **Endpoint**: `POST /labs/admin/deployments/{deploymentId}/terminate`
- **Purpose**: Forcefully tears down an active cloud instance.
- **Response**:
  ```json
  {
    "success": true,
    "message": "Termination queued"
  }
  ```

---

## 3. Roster Management (Deployment Members)

Used to assign and unassign student operators to/from running live lab deployment networks.

### List Roster Members
- **Endpoint**: `GET /labs/admin/deployments/{deploymentId}/members`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "participants": [
        {
          "user_id": "user-uuid",
          "email": "student@ctf.io",
          "added_by": "admin-uuid",
          "added_at": "2026-06-30T10:15:00Z"
        }
      ]
    }
  }
  ```

### Add Member to Roster
- **Endpoint**: `POST /labs/admin/deployments/{deploymentId}/members/{userId}`
- **Response**:
  ```json
  {
    "success": true,
    "message": "User added to roster successfully"
  }
  ```

### Remove Member from Roster
- **Endpoint**: `DELETE /labs/admin/deployments/{deploymentId}/members/{userId}`
- **Response**:
  ```json
  {
    "success": true,
    "message": "User removed from roster successfully"
  }
  ```

---

## 4. CTF Challenges Sync

### Sync & Publish Challenges to Backend
- **Endpoint**: `POST /quiz/admin/push`
- **Purpose**: Saves new configured flags, difficulty writeups, hints, and categories into the backend database.
- **Request Body**:
  ```json
  {
    "content_id": "lab-scenario-id",
    "challenges": [
      {
        "id": "challenge-uuid-optional",
        "title": "Privilege Escalation via SeBackupPrivilege",
        "category": "Active Directory",
        "difficulty": "Medium",
        "points": 250,
        "flag": "flag{backup_operators_rule_the_domain}",
        "scenario": "Story backdrop text...",
        "instructions": "Step-by-step guideline directions...",
        "hints": ["Hint #1 text", "Hint #2 text"],
        "solutionText": "Step-by-step root writeup..."
      }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Challenges synchronized and published successfully"
  }
  ```

---

## 5. Leaderboard

### Get Leaderboard Standings
- **Endpoint**: `GET /quiz/{stableUuid}/leaderboard?limit=10`
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "name": "Operator Alex",
        "email": "alex@ctf.io",
        "completedChallenges": 5,
        "totalPoints": 1250,
        "totalTimeSpent": 120
      }
    ]
  }
  ```

---

## 6. Pricing, Access, & Billing Management

### Fetch Lab Scenario Pricing
- **Endpoint**: `GET /admin/courses/{contentId}/price`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "content_id": "course-id",
      "price": {
        "amount_minor": 99900,
        "currency": "INR",
        "is_active": true
      }
    }
  }
  ```

### Update/Upsert Lab Scenario Price
- **Endpoint**: `PUT /admin/courses/{contentId}/price`
- **Request Body**:
  ```json
  {
    "amount_minor": 149900,
    "currency": "INR",
    "is_active": true
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "content_id": "course-id",
      "amount_minor": 149900,
      "currency": "INR",
      "is_active": true
    }
  }
  ```

### List Payments Logs
- **Endpoint**: `GET /billing/admin/payments?status={status}&user_id={userId}&limit=100`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "rows": [
        {
          "payment_id": "pay_XYZ789",
          "email": "payer@ctf.io",
          "content_title": "AD Advanced Range",
          "amount": 999.0,
          "currency": "INR",
          "status": "captured",
          "created_at": "2026-06-30T10:55:00Z"
        }
      ]
    }
  }
  ```

### Grant Manual Lab Entitlement
- **Endpoint**: `POST /billing/admin/grant-entitlement`
- **Request Body**:
  ```json
  {
    "user_id": "user-uuid",
    "content_id": "course-uuid-or-id"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Manual entitlement granted successfully"
  }
  ```

---

## 7. Student Checkout & Payments (Razorpay)

Used by both standard users (for direct catalog purchases) and administrators (to initiate/test the payment flow on behalf of a student).

### Create Checkout Order
- **Endpoint**: `POST /billing/orders`
- **Request Body**:
  ```json
  {
    "content_id": "lab-scenario-uuid",
    "user_id": "optional-student-user-uuid" 
  }
  ```
  *(Note: If `user_id` is supplied and the authenticated user is an administrator, the backend should associate the resulting order/entitlement with the specified student instead of the administrator).*

- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "razorpay_order_id": "order_ABC123",
      "amount_minor": 9900,
      "currency": "INR",
      "razorpay_key_id": "rzp_test_key"
    }
  }
  ```

### Verify and Capture Payment
- **Endpoint**: `POST /billing/verify-capture`
- **Request Body**:
  ```json
  {
    "razorpay_order_id": "order_ABC123",
    "razorpay_payment_id": "pay_XYZ456",
    "razorpay_signature": "signature_hash_optional",
    "user_id": "optional-student-user-uuid"
  }
  ```
  *(Note: If `user_id` is supplied and the authenticated user is an administrator, the backend should verify the signature and award the final lab entitlement to the targeted student).*

- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "status": "fulfilled",
      "message": "Payment verified and entitlement granted successfully"
    }
  }
  ```
