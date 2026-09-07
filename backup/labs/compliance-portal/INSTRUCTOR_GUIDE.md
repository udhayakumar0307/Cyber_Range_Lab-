# DPDP Compliance Portal — Instructor Guide

## Overview

This lab wraps the **DDS-CMS "Privacy Shield Platform"** — a full-stack DPDP
Act compliance dashboard — as a single-container Cyber Range lab. Students
operate the portal as a Data Protection Officer: connect a consent source,
work the consent lifecycle, discover and classify PII, run anonymization and
third-party sharing controls, and produce audit evidence.

It is a **web-application operations lab**, not a terminal / flag lab. There is
no `docker exec`, no scoring server, and no `FLAG{...}` strings — grading is by
reviewed evidence (see *Grading* below).

---

## Architecture

```
compliance-portal/
├── metadata.json          Cyber Range registry card (name, category, price, image)
├── module_config.json     5-module definition consumed by lab_scanner.py
├── docker-compose.yml     one service: builds ./app, maps host 8090 -> 4000
├── .env.example           every value optional; empty .env = demo mode
├── README.md              student-facing
├── INSTRUCTOR_GUIDE.md    this file
├── modules/MODULE_1..5.md module briefs
└── app/                   the complete DDS-CMS application (unmodified logic)
    ├── Dockerfile         multi-stage: vite build -> node:20-alpine runtime
    ├── docker-entrypoint.sh   injects demo CONSENT_SOURCES when none supplied
    ├── .env.production    VITE_API_BASE_URL=/api (same-origin build)
    ├── server/            Express API + in-process privacy engine
    ├── src/               React (Vite) SPA
    ├── data/              bundled demo dataset (consentScenarios.js)
    └── backend/           unused alternative FastAPI backend, kept for parity
```

- **One container, one port.** The Vite frontend is built to static files and
  served by the Express API on port 4000. The browser calls the API on the same
  origin, so nothing host-specific is baked into the bundle.
- **Stateless by default.** The consent/DPDP/PII/anonymization analysers run
  in-process on a `SYNC_INTERVAL_MINUTES` schedule (default 5). A database is
  optional and only persists audit history + integration state.
- **Self-contained demo mode.** `app/docker-entrypoint.sh` checks for
  `CONSENT_SOURCES` / `CONSENT_SOURCE_*`; if neither is set it registers a
  loopback demo source. `server/services/consentSources.js` detects the
  loopback and serves `app/data/consentScenarios.js` directly — no outbound
  network. The lab therefore works fully offline / air-gapped.

---

## Running the lab

### Single student / demo

```bash
docker compose up --build -d
# open http://localhost:8090
```

### Reset

```bash
docker compose down -v && docker compose up --build -d
```

### Multiple students

The container is stateless, so every student can share one instance for the
read/analysis modules. If you want isolation (or you set `DATABASE_URL`), run
one stack per student on separate ports:

```bash
# student A
docker compose -p portal-alice up --build -d   # after editing the host port to 8091, etc.
```

or give each student their own host / VM.

### Driving the lab from a REAL consent API (optional)

Set one of these in `.env` (or the Cyber Range session environment):

```bash
CONSENT_SOURCES={"<key>":{"url":"https://company/consent-api/consents","sector":"finance","label":"Acme Finance"}}
# or, no JSON to quote:
CONSENT_SOURCE_FIN=<key>|https://company/consent-api/consents|finance|Acme Finance
```

The demo-mode entrypoint block is skipped automatically when either is present.

---

## Integrating into the Cyber Range platform

> The lab folder is self-contained. You register it the same way as any other
> lab in this repo.

1. **Copy** `compliance-portal/` into the platform's `labs/` directory.
2. The registry scanner (`backend/app/services/lab_scanner.py`) picks up
   `labs/compliance-portal/metadata.json` on its next sweep and creates the
   `compliance-portal` lab row; `module_config.json` populates the 5
   `lab_modules` rows.
3. **Build / publish the image** referenced by `metadata.json`
   (`cyberrange/compliance-portal:latest`):
   ```bash
   cd labs/compliance-portal
   docker build -t cyberrange/compliance-portal:latest ./app
   ```
4. A SysAdmin **assigns** the lab (free or priced) from the SysAdmin portal so
   it appears under *Available Labs*.
5. **Expose it to students.** The portal is a normal web app on container port
   `4000`. Surface it the way the platform surfaces its other web-app labs
   (e.g. `ot-security-lab`) — an iframe/tab pointed at the lab's origin, or a
   reverse-proxy route. Because the SPA is built with a relative API base
   (`/api`), it works behind any origin or proxy prefix that forwards `/api`
   and `/assets` to the same container.

No Cyber Range platform files are modified by the lab itself.

---

## Module solutions / expected observations

Values below are for the **bundled demo dataset** (8 consent records, ecommerce
sector). Exact numbers will differ if you point the lab at a real source.

### Module 1 — Platform Integration & Consent Sync
- Platform: **Deeptrust Demo Store**, type *Custom REST / Generic REST API*,
  sector **ecommerce** → regulator *MeitY / Consumer Protection (E-Commerce)
  Rules 2020*.
- After a sync: engine **READY**, `Analysed 1 sector(s): ecommerce (8)`.
- Dashboard KPIs ≈ Compliance Index **94.7%**, Total Consents **8**,
  Discovered PII **16 fields**, Adapter State **Active**.

### Module 2 — Consent Lifecycle Management
- 8 total, **4 granted / 4 revoked**, revocation rate **0.5**.
- Purposes: Marketing / Research / Analytics mix.
- Secure PII deletion on a normal record → audit row `Success / Verified`.
- Any record id ending in `9` → simulated `Platform connection timeout` →
  audit row `Failed / Failed` (this is intentional, in
  `server/controllers/consentController.js`).
- **Known limitation:** the Revoke/Grant buttons in the *Consent Records* table
  write to the audit DB and use `row.id` (the demo dataset keys on `user_id`),
  so in demo mode they return an error and do not change status. This is
  upstream DDS-CMS behaviour, left intact. The lifecycle **metrics** and the
  **secure deletion** flow are fully functional in demo mode. Set
  `DATABASE_URL` for full write-back.

### Module 3 — PII Discovery & Classification
- After **Scan for PII**: Total PII Records **40**, Sensitive PII Fields
  **16**, distinct PII types **5** (Full Name, Email Address, Phone Number,
  Physical Address, Other Personal Attribute).
- Tiers ≈ 2 High / 2 Medium / 1 Low → privacy-risk **31/100**.
- Risk score = weighted tier counts × ecommerce sector multiplier; a finance
  sector on the same fields scores higher.

### Module 4 — Anonymization & Third-Party Sharing
- Scanner (ecommerce) auto-selects phone (`sha256:` hash), address
  (generalise to city), retains order metadata.
- Preview returns a synthetic `{ raw, anonymized }` pair — e.g.
  `address: "14 MG Road, Bengaluru…" → "Bengaluru"`, `phone → "sha256:…"`.
- Job summary ≈ **8 records anonymised, 100% success**.
- Hash Audit Trail: each shared record carries a `sha256:` signature; **trace**
  by id or signature reconstructs destination + purpose + verification.

### Module 5 — DPDP Compliance Audit & Reporting
- Start ≈ **94.7% compliant**, **6 rules reviewed**, **1 needs action**,
  **1 critical risk** (typically the downstream-processing / revoked-records
  control).
- Closing the gap (run secure deletions for revoked records, run an
  anonymization job) and re-auditing should reduce *Needs Action*.
- Reports: `POST /api/v1/reports/generate` returns
  `{ success:true, downloadUrl:"/api/v1/reports/download/…" }`; the download is
  a generated stub in stateless mode (real file generation needs the DB /
  report store — upstream behaviour).
- Dashboard ROPA trail shows the student's sync / deletion / anonymization /
  report events.

---

## Grading rubric

| Criteria | Points |
|----------|--------|
| M1 — source connected, sync run, KPIs recorded | 150 |
| M2 — lifecycle metrics recorded + 1 success & 1 failed deletion in audit | 200 |
| M3 — PII inventory classified, risk score explained w/ sector effect | 200 |
| M4 — masking configured, job run, sharing event traced via hash | 200 |
| M5 — full rule breakdown, gap closed + re-audit, reports generated | 250 |
| **Total** | **1000** |

Grade from each module's **Evidence** table plus a short written answer to that
module's **Concepts**. There are no flags to capture.

---

## Common issues

| Problem | Cause / fix |
|---------|-------------|
| Dashboard shows "No Platform Connected" | No `CONSENT_SOURCES` **and** the entrypoint didn't run — confirm the container `CMD` runs through `./docker-entrypoint.sh`; check `docker logs` for the `[entrypoint] … demo mode` line |
| Pages load but every panel is empty | Scheduler hasn't completed the first run yet — wait ~5 s or hit **Run Compliance Scan** / the Integration **Recent Synchronization** panel |
| API calls 404 / SPA returns HTML as JSON | The app must be served at an origin/proxy that forwards `/api/*` to the same container as `/` |
| Blank page, `file:///…/api/...` in console | The frontend was built without `VITE_API_BASE_URL=/api`. The Dockerfile sets it; `app/.env.production` sets it for local `npm run build`. Rebuild. |
| Revoke/Grant buttons error in demo mode | Expected — see Module 2 known limitation. Set `DATABASE_URL` for write-back. |
| Port 8090 already in use | Change the mapping in `docker-compose.yml` (`"<host>:4000"`). |

---

## What was changed from stock DDS-CMS

Only packaging / compatibility — **no UI, page, component, route, or analysis
logic was altered**:

1. `app/docker-entrypoint.sh` (new) + `ENTRYPOINT` in the Dockerfile — default
   to self-contained demo mode when no consent source is configured. The
   Dockerfile also `sed`s any CR out of the script before running it.
2. `app/.env.production` (new) — pins `VITE_API_BASE_URL=/api` so a plain
   `npm run build` produces a same-origin bundle (the Dockerfile already set
   this via `ENV`; the file makes non-Docker builds reproducible too).
3. `app/.dockerignore` — expanded to also drop Python cruft and stray env
   files from the build context.
4. `.gitattributes` (new) — forces `*.sh` / Dockerfile / source to `eol=lf` so
   a Windows checkout (`core.autocrlf=true`) can't corrupt the entrypoint.
5. Cyber Range wrapper files (`metadata.json`, `module_config.json`,
   `docker-compose.yml`, `.env.example`, `README.md`, this guide, `modules/`).

`node_modules/`, `dist/`, `.git/`, `__pycache__/`, `*.db`, and any real `.env`
were excluded from the copy.
