# Consent Management Dashboard Workflow

## Overview

The Consent Management Dashboard is a React-based dashboard that displays consent records fetched from an API. It helps users monitor how many consents are granted or revoked, view purpose-wise consent distribution, inspect recent revocations, filter records, search users, export data, switch between day/night modes, and sync the dashboard using a consent database API key.

## Main User Workflow

1. The user opens the dashboard in the browser.
2. The dashboard fetches consent data from the API endpoint.
3. While data is loading, a loading message is displayed.
4. If the API request fails, an error message is shown.
5. Once data is loaded, the dashboard calculates and displays KPI metrics.
6. The user can review charts for consent status and purpose distribution.
7. The user can view recent revoked consents in a sorted table.
8. The user can filter records by purpose.
9. The user can search records by user name or user ID.
10. The user can export the currently filtered dashboard data as a CSV file.
11. The user can switch between day mode and night mode.
12. The user can paste an API key and click Sync to refetch consent data using that key.

## Data Fetching Workflow

The dashboard fetches consent records through the frontend service file:

```text
src/services/consentApi.js
```

By default, the frontend calls:

```text
/api/consents
```

For local development, Vite proxies `/api` requests to the Express backend running on:

```text
http://localhost:4000
```

For Vercel deployment, the same `/api/consents` path is handled by the Vercel serverless API file:

```text
api/consents.js
```

## API Key Workflow

The dashboard includes an API key input box where a user can paste their consent database API key.

Workflow:

1. The user pastes an API key into the API key input box.
2. The user clicks the Sync button.
3. The dashboard stores the key temporarily in React state.
4. The dashboard refetches consent data.
5. The API key is sent with the request headers:

```text
Authorization: Bearer <api-key>
x-api-key: <api-key>
```

6. If the request succeeds, the dashboard updates the KPIs, charts, and revocation table.
7. If the request fails, the dashboard displays an error message.

Important: The API key is not stored permanently. It is kept only in component state and is cleared when the page is refreshed.

## Consent Data Format

The dashboard expects the API to return an array of consent records in this format:

```json
[
  {
    "user_id": "U001",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "address": "Mumbai, India",
    "purpose": "Marketing",
    "consent_status": "granted",
    "timestamp": "2026-05-20T10:30:00Z"
  }
]
```

Supported consent statuses:

```text
granted
revoked
```

Supported purposes:

```text
Marketing
Research
Analytics
```

## KPI Calculation Workflow

The KPI calculations are handled in:

```text
src/utils/consentMetrics.js
```

The dashboard calculates:

```text
Total Consents = total number of records
Granted % = granted consents / total consents * 100
Revoked % = revoked consents / total consents * 100
Revocation Rate = revoked consents / total consents
```

The KPIs are recalculated every time the consent data, search term, or purpose filter changes.

## Visualization Workflow

The dashboard uses Recharts for data visualization.

Chart component:

```text
src/components/ConsentCharts.jsx
```

Visualizations:

1. Pie Chart
   Displays granted vs revoked consent counts.

2. Bar Chart
   Displays granted and revoked consent counts grouped by purpose:

```text
Marketing
Research
Analytics
```

Charts update automatically based on the currently filtered dataset.

## Recent Revocations Workflow

The recent revocations table displays only records where:

```text
consent_status = revoked
```

The records are sorted by timestamp in descending order, so the most recent revoked consent appears first.

Table component:

```text
src/components/RecentRevocationsTable.jsx
```

Displayed columns:

```text
User Name
User ID
Purpose
Timestamp
```

## Filtering And Search Workflow

The filter and search controls are handled by:

```text
src/components/FilterBar.jsx
```

Purpose filter:

```text
All
Marketing
Research
Analytics
```

Search supports:

```text
User name
User ID
```

When a filter or search term changes, the dashboard creates a filtered dataset and recalculates all KPIs, charts, and table rows from that filtered dataset.

## CSV Export Workflow

The Export CSV button exports the currently filtered dashboard data.

Exported columns:

```text
User ID
Name
Email
Phone
Address
Purpose
Consent Status
Timestamp
```

The CSV file is downloaded as:

```text
consent-dashboard-data.csv
```

## Night Mode Workflow

The dashboard includes a night mode toggle in the header.

Workflow:

1. The user clicks the theme toggle button.
2. The dashboard switches between light and dark themes.
3. The selected theme is stored in browser `localStorage`.
4. When the user reopens or refreshes the dashboard, the previous theme is restored.

Theme styles are defined in:

```text
src/styles.css
```

The theme is controlled through:

```text
document.documentElement.dataset.theme
```

## Component Structure

```text
src/
  App.jsx
  main.jsx
  styles.css
  components/
    ApiKeyConnector.jsx
    ConsentCharts.jsx
    FilterBar.jsx
    KpiCard.jsx
    RecentRevocationsTable.jsx
  pages/
    Dashboard.jsx
  services/
    consentApi.js
  utils/
    consentMetrics.js
```

## Backend And API Structure

Local Express API:

```text
server/index.js
```

Vercel serverless API:

```text
api/consents.js
```

Mock consent data:

```text
data/consents.js
```

## Deployment Workflow

The application is prepared for Vercel deployment.

Deployment flow:

1. Push the latest code to GitHub.
2. Connect the GitHub repository to Vercel.
3. Vercel installs dependencies using `npm install`.
4. Vercel builds the frontend using `npm run build`.
5. Vercel serves the built React app from the `dist` folder.
6. Vercel serves the API route from `api/consents.js`.

Recommended Vercel settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

## End-To-End Dashboard Flow

```text
User opens dashboard
        |
        v
React app loads
        |
        v
Dashboard fetches /api/consents
        |
        v
Consent records are stored in state
        |
        v
Filters and search are applied
        |
        v
KPIs, charts, and revocation table are calculated
        |
        v
User reviews consent insights
        |
        v
User can sync with API key, switch theme, filter, search, or export CSV
```

## Notes For Real API Integration

For a real consent database API, configure the frontend to call the real endpoint by setting:

```text
VITE_API_URL=https://your-api-domain.com/consents
```

The pasted API key will be sent with each fetch request. If the real API has a different authentication format, update:

```text
src/services/consentApi.js
```

If the real API blocks browser requests due to CORS, use a backend proxy or Vercel serverless function to securely forward requests.
