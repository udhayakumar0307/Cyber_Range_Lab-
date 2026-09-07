# DPDP Compliance Portal
## Governance, Risk & Compliance Track — Cyber Range

An operations lab built on the **DDS-CMS Privacy Shield Platform**. You take the
role of a **Data Protection Officer (DPO)** and run a company's compliance
programme under India's **Digital Personal Data Protection (DPDP) Act** — from
connecting a customer platform, through the consent lifecycle, PII discovery,
anonymization and third-party sharing, to producing the audit evidence that
proves your posture.

This is not a terminal lab. Everything happens in the browser dashboard.

---

## Getting Started

### 1. Launch the lab

```bash
docker compose up --build -d
```

The first build takes a few minutes (it compiles the frontend). Subsequent
starts are fast.

### 2. Open the portal

**http://localhost:8090**

The lab ships in **self-contained demo mode** — a demo dataset is loaded
automatically, so every page has data the moment the container is healthy. No
internet access, database, or API key is required.

### 3. Work through the modules

Open each module brief (in `modules/`, or from your Cyber Range module list) and
complete its objectives in the dashboard. Each module builds on the last.

### 4. Reset the lab

```bash
docker compose down -v && docker compose up --build -d
```

---

## The 5 Modules

| Module | Focus | Points |
|--------|-------|--------|
| 1 | Platform Integration & Consent Sync | 150 |
| 2 | Consent Lifecycle Management | 200 |
| 3 | PII Discovery & Classification | 200 |
| 4 | Anonymization & Third-Party Sharing | 200 |
| 5 | DPDP Compliance Audit & Reporting (Capstone) | 250 |
| | **Total** | **1000** |

---

## What You'll Use

| Page | What it does |
|------|--------------|
| **Dashboard** | Executive DPDP posture — compliance index, consent split, PII risk, activity trail |
| **Platform Integration** | Register a consent source, run sync, inspect API protocols and data flows |
| **Consent Management** | Consent records, requests, revocations, and consent analytics |
| **DPDP Compliance** | Rule-by-rule statutory audit against the DPDP Act provisions |
| **PII Management** | PII inventory, sensitivity tiers, data-lifecycle and minimisation counsel |
| **Anonymization** | Masking workspace, anonymization jobs, third-party sharing log, hash audit trail |
| **Reports** | Generate and download DPDP / consent / PII audit reports |
| **Settings** | Organisation profile, retention policy, notification channels |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  compliance-portal  (one container)         │
│                                             │
│  Express API  ──serves──►  built React SPA   │
│  :4000                     (same origin)     │
│     │                                        │
│     ├─ /api/v1/*   compliance engine         │
│     ├─ /api/*      consent + PII endpoints    │
│     └─ /*          SPA (client-side routing)  │
│                                             │
│  Privacy engine: consent / DPDP / PII /      │
│  anonymization analysers run in-process on   │
│  a 5-minute schedule. Stateless by default.  │
└─────────────────────────────────────────────┘
        host :8090  ──►  container :4000
```

- **One port, one process.** The browser calls the API on the same origin it
  was served from, so nothing host-specific is baked into the build.
- **Stateless by default.** Analysis runs entirely off the consent source. A
  database (`DATABASE_URL`) is optional and only adds audit-history persistence.
- **Self-contained demo mode.** With no `CONSENT_SOURCES` set, the entrypoint
  registers a loopback demo source and the server serves the bundled dataset
  (`app/data/consentScenarios.js`) with no outbound request.

---

## Configuration (all optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `CONSENT_SOURCES` | *(demo mode)* | JSON map `key → { url, sector, label }` for a real consent API |
| `CONSENT_SOURCE_*` | — | Pipe form `key|url|sector|label`, one per source |
| `CONSENT_LIMIT` | `500` | Max records fetched per source |
| `SYNC_INTERVAL_MINUTES` | `5` | Re-analysis interval |
| `DATABASE_URL` | *(unset)* | Optional Postgres for audit-history persistence |
| `VITE_TENANT_MODE` | `multi` | `single` locks the UI to one sector and hides Integration |
| `VITE_TENANT_LABEL` | `Privacy Shield Platform` | Sidebar / navbar branding |

See [`.env.example`](.env.example).

---

## Ports

| Port | Service |
|------|---------|
| `8090` (host) → `4000` (container) | Compliance portal — frontend + API |

Change the mapping in [`docker-compose.yml`](docker-compose.yml) if `8090` is
taken on your host.

---

## Questions?

Ask your instructor, or see [`INSTRUCTOR_GUIDE.md`](INSTRUCTOR_GUIDE.md).
