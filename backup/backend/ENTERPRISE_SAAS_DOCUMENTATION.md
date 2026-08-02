# CyberRange Enterprise SaaS Architecture & Payment Developer Documentation

---

## 1. System Overview
CyberRange is a multi-tenant enterprise cybersecurity simulation platform designed for Universities, Colleges, Enterprises, and Government Organizations.

### User Roles & Isolation Strategy:
- **System Admin (`SYSTEM_ADMIN`)**: Platform owner. Enforces security, monitors container runtime health, inspects platform-wide audit logs, and views global SaaS revenue/financial metrics.
- **Organization Admin (`ADMIN`)**: Institutional administrator. Manages user accounts, assigns training groups, purchases lab seats, manages subscriptions, and accesses organization-scoped billing/invoices.
- **Student (`USER`)**: Lab consumer. Accesses assigned lab environments and tracks individual learning progress.

---

## 2. Phased Architecture Workflows

### Phase 1: Real Razorpay Production Payment & Provisioning
```
Organization Admin
  ↓
Cart Checkout (Select Labs & Seats)
  ↓
POST /api/v1/payments/create-order (Calculates 18% GST tax, discounts, & initializes Razorpay Order)
  ↓
Razorpay SDK Checkout Window (Customer pays via UPI / Netbanking / Card)
  ↓
POST /api/v1/payments/verify (Verifies HMAC SHA-256 signature using RAZORPAY_KEY_SECRET)
  ↓
PostgreSQL DB Transaction:
  1. Record Payment & Order Status = "COMPLETED"
  2. Create Invoice Record (INV-YYYYMMDD-XXXX)
  3. Provision PurchasedLab seat pool and individual License keys
  4. Clear User Cart & emit Audit Log
  ↓
Seats immediately available for Student Allocation
```

### Phase 2: Webhooks & Refund Architecture
- **Razorpay Webhooks (`POST /api/v1/payments/webhook`)**:
  - Validates `X-Razorpay-Signature` HMAC header using `RAZORPAY_WEBHOOK_SECRET`.
  - Listens for `payment.captured`, `payment.failed`, `refund.processed`, and `subscription.charged`.
- **Refund Processing (`POST /api/v1/payments/refund`)**:
  - Revokes allocated seat licenses (`PurchasedLab.status = 'SUSPENDED'`) and updates transaction status to `REFUNDED`.

---

## 3. Database Schema Overview

| Table Name | Description | Key Columns |
|---|---|---|
| `organizations` | Institutional client entity | `id`, `name`, `institution_type`, `gst_number`, `created_at` |
| `orders` | Purchase checkout order | `id`, `order_number`, `user_id`, `subtotal`, `tax`, `grand_total`, `status` |
| `order_items` | Purchased lab items | `id`, `order_id`, `lab_id`, `seats`, `duration_months`, `price` |
| `payments` | Gateway transaction audit | `id`, `order_id`, `transaction_id`, `gateway`, `payment_status`, `amount` |
| `invoices` | Billing invoices | `id`, `invoice_number`, `order_id`, `user_id`, `amount`, `billing_address_json` |
| `purchased_labs` | Organization seat pool | `id`, `user_id`, `organization_id`, `lab_id`, `total_seats`, `assigned_seats`, `expiry_date` |
| `licenses` | Individual seat keys | `id`, `purchased_lab_id`, `license_key`, `allocated_user_email`, `status` |
| `audit_logs` | System security logs | `id`, `action`, `performed_by`, `organization_id`, `status`, `timestamp` |

---

## 4. API Endpoints Reference

### Payment & Billing APIs
- `POST /api/v1/payments/create-order`: Initialize Razorpay Order payload.
- `POST /api/v1/payments/verify`: HMAC SHA-256 signature verification & license provisioning.
- `GET /api/v1/payments/history`: Scoped organization purchase & invoice history.
- `GET /api/v1/payments/invoices/{id}/download`: Download official itemized invoice text document.
- `POST /api/v1/payments/webhook`: Production Razorpay webhook listener.
- `POST /api/v1/payments/refund`: Process payment refund & suspend associated seat pool.

### System Admin Analytics APIs
- `GET /api/v1/system/overview`: Platform metrics, total revenue, monthly/yearly revenue, and seat utilization.
- `GET /api/v1/system/database-viewer`: Read-only ORM table inspector for platform compliance.
- `GET /api/v1/system/audit-logs`: Platform-wide security audit trail.
