# Budget Tracker — MVP

A personal budget & expense tracking web app (installable PWA). This is the
MVP milestone from the spec: income input, fixed/necessary expenses,
discretionary categories with budgets, manual expense entry with a store
dropdown, a simple budgeted-vs-spent dashboard, and data organized by year.

Statement upload, trend charts, savings streaks, credit utilization,
close-out flow, and notifications are planned for later phases (v2–v5 in the
spec) and are not built yet.

## Stack

- **Backend**: Node/Express + SQLite (`better-sqlite3`) — a single-file
  database at `backend/data/budget.db`
- **Frontend**: React + TypeScript + Vite, Tailwind CSS, Recharts,
  `vite-plugin-pwa` for installable/offline support

## Project layout

```
budget-app/
  backend/     Express API + SQLite database
  frontend/    React PWA (talks to the API)
```

## Running it locally

**Backend** (starts on port 4000):

```
cd backend
npm install
npm run dev      # or: npm start
```

The SQLite file is created automatically at `backend/data/budget.db` on
first run, along with a starter set of categories (necessary, discretionary,
savings) and preset stores (Costco, Amazon, Walmart, Target, Kroger, etc.).
You can rename, add, or remove any of these from the Setup screen — nothing
is hardcoded in the UI.

**Frontend** (starts on port 5173, proxies `/api` to the backend):

```
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. On first use, go to **Setup → Income & Goal**
to enter your income and savings goal, then **Setup → Budgets** to set
amounts for your fixed expenses and discretionary categories. After that,
use **Add Expense** to log purchases and **Dashboard** to see budgeted vs.
spent.

## Deploying / self-hosting

This wasn't deployed for you — you said you'd handle hosting. A few notes
for whenever you do:

- **Backend**: `npm start` runs the Express server; put it behind a process
  manager (pm2, systemd, Docker) and a reverse proxy (Caddy/Nginx) with
  HTTPS if you expose it beyond your home network. Set `PORT` via env var
  if you need something other than 4000.
- **Frontend**: `npm run build` in `frontend/` produces a static `dist/`
  folder — serve it with any static host (Nginx, Caddy, Netlify, Vercel,
  etc.). Point its API calls at your backend's real URL instead of the dev
  proxy by setting `VITE_API_BASE` (see note below) or serving both behind
  the same origin/reverse-proxy path so `/api` reaches the backend.
- **Installing on your phone**: once the frontend is served over HTTPS (or
  `localhost` for testing), open it in your phone's browser and use
  "Add to Home Screen" — the manifest includes an "Add Expense" shortcut
  that jumps straight to the quick-add form.
- **Data**: everything lives in `backend/data/budget.db`. Back this file up
  periodically — it's the only copy of your data (no cloud sync yet, per
  your local-storage-only MVP decision).

> Note: the dev setup proxies `/api` through Vite. For a production
> deployment where frontend and backend aren't on the same origin, add a
> small `.env` in `frontend/` with `VITE_API_BASE=https://your-api-host`
> and update `src/api.ts`'s `baseURL` to use it — this wasn't wired up yet
> since hosting details weren't decided.

## What's next (roadmap)

Per the spec's build order:

1. ~~MVP~~ ✅ (this)
2. v2 — statement upload/import (CSV/PDF), auto-categorization, duplicate
   detection
3. v3 — trend charts, savings streaks, Excel export
4. v4 — reminders (monthly statement nudge, 9pm daily check-in — see
   `budget-reminders` skill), recurring transaction detection, credit
   utilization tracking
5. v5 — multi-user accounts (last, once this is proven out solo)

## Open questions from the spec (§8) — still undecided

These don't block the MVP but will matter for later phases:

- Manual statement upload only, or eventually connect to bank accounts via
  Plaid for automatic sync?
- Local-only storage (current setup) vs. cloud sync across devices? Cloud
  sync becomes necessary once multi-user (v5) is added.
- Any household/shared-budget mode, or strictly individual accounts?
