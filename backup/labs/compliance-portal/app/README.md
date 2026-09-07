# Consent Management Dashboard

Full-stack dashboard for visualizing consent records from an Express API.

## Features

- KPI cards for granted percentage, revoked percentage, revocation rate, and total consents.
- Pie chart for granted vs revoked consents.
- Bar chart for consent distribution by purpose.
- Recent revocations table sorted by newest timestamp.
- Purpose filtering, user search, loading/error states, and CSV export.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the React frontend and Express API:

```bash
npm run dev
```

Open the app at:

```text
http://127.0.0.1:5173
```

API endpoint:

```text
http://localhost:4000/api/consents
```

## PII discovery and classification

PII mapping uses the dashboard's existing backend API; no separate frontend PII
or classification URL needs to be configured. The client derives both routes from
`VITE_API_BASE_URL`:

- `GET /api/pii-results` returns discovered PII fields.
- `GET /api/pull-and-classify` triggers a discovery/classification scan.

When no fields are returned, the application displays a guided discovery state rather
than an empty table. Service failures are presented as user-facing availability messages.

## Connect Real Consent Sources

By default a consent API key maps to a built-in demo dataset. To serve **live**
consent data, register companies via the `CONSENT_SOURCES` env variable — a JSON map
of API key → source. Each company exposes one authenticated route that returns the
standard shape, and the dashboard just calls it (no DB credentials or schema coupling):

```text
CONSENT_SOURCES={"your_live_key":{"url":"https://company/consent-api/consents"}}
```

Syncing with `your_live_key` fetches that company's route (forwarding the key) and
returns the records; other known demo keys still return demo data; an unknown key returns
HTTP 401. **Adding a company is one more entry** (its URL + key) — that is the whole
onboarding. Options per source:

- `{"url":"…","token":"…"}` — call the company's route; `token` overrides the forwarded key.
- `{"dbUrl":"postgres://…","dbSsl":true}` — back-compat: query a company DB directly
  (expects the EverShop `customer` + `customer_address` schema).

The registry lives in
[server/services/consentSources.js](server/services/consentSources.js); no front-end changes
are needed. See [`.env.example`](.env.example).

## Deploy To Vercel

This project includes a Vercel serverless API at `/api/consents`, so the dashboard works after deployment without a separate Express server.

1. Push the repository to GitHub.
2. Go to Vercel and choose **Add New Project**.
3. Import the GitHub repository.
4. Keep the default Vite settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Deploy**.

After deployment, the API will be available at:

```text
https://your-vercel-domain.vercel.app/api/consents
```

## Project Structure

```text
server/              Express mock API
src/components/      Reusable dashboard components
src/pages/           Page-level dashboard composition
src/services/        API client calls
src/utils/           KPI, chart, filtering, and CSV helpers
```
## Hardcoded items to address

- [src/services/dsrApi.js](src/services/dsrApi.js#L1) uses one fixed local server address.
- [vite.config.js](vite.config.js#L6-L20) points to fixed local and online server addresses.
- [src/components/PiiMapping.jsx](src/components/PiiMapping.jsx#L74) uses one fixed classification link.
- [src/components/DpiaEntry.jsx](src/components/DpiaEntry.jsx#L40-L49) includes sample PII data.
- [src/components/DpiaEntry.jsx](src/components/DpiaEntry.jsx#L95-L99) uses a fixed AI service link and model name.
- [server/index.js](server/index.js#L22-L23) and [api/pii-results.js](api/pii-results.js#L1-L6) use a fixed backup data link.
- [data/consents.js](data/consents.js#L1-L40) contains hand-written sample consent data.
- [data/consentScenarios.js](data/consentScenarios.js#L1-L20) contains hardcoded test keys and sample sets.
- [package.json](package.json#L6-L11) starts the app on a fixed local address.
- [README.md](README.md#L55-L66) had a leftover merge note, which should be removed.

## Parts that use real logic

- [src/services/consentApi.js](src/services/consentApi.js#L1-L40) picks the right data source and loads consent records.
- [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx#L38-L179) handles the key entry, data loading, and dashboard updates.
- [src/utils/dpdpCompliance.js](src/utils/dpdpCompliance.js#L103-L159) calculates the compliance score.
- [src/components/PiiMapping.jsx](src/components/PiiMapping.jsx#L1-L170) loads PII data, lets the user search it, and refreshes it.
- [src/components/DpiaEntry.jsx](src/components/DpiaEntry.jsx#L1-L220) saves the key, talks to the AI service, and keeps the chat going.
- [server/index.js](server/index.js#L24-L66) receives requests and returns the right data.
