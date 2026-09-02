# Personal Budget & Expense Tracker — App Specification

## 1. Overview

A cross-platform (web + mobile-friendly) personal finance app that helps the user
understand where their money goes each month, stay under a spending target, and
build a consistent savings habit. Core loop: **enter income → account for fixed
bills → track discretionary spending → compare against a savings goal → visualize it all.**

**Primary goals**
- Reduce impulse/excess spending
- Avoid credit card interest/fees by staying within budget
- Build a habit of tracking purchases as they happen (not just at month-end)
- Make progress toward a savings goal visible and motivating

---

## 2. Core User Flow

1. **Onboarding**
   - Enter total monthly income (support multiple income sources, e.g. paycheck + side income)
   - Set a monthly savings goal (fixed $ amount or % of income)
   - Add recurring **necessary expenses** (see §3)
2. **Ongoing use**
   - Add expenses manually as purchases happen (quick-add flow)
   - Upload a monthly bank/credit card statement (CSV/PDF) to bulk-import and reconcile
   - Categorize/re-categorize transactions
   - Check the dashboard to see budget status at a glance
3. **Monthly close-out**
   - **Quick close-out screen**: a single, one-tap flow at month's end that shows
     the month's results (total spent vs. budgeted, total saved vs. goal, biggest
     categories) and asks "Carry forward unspent budget?" / "Start fresh next
     month?" per category — a short, deliberate ritual rather than the app
     silently rolling numbers over in the background
   - Review actual vs. budgeted spending per category
   - See how much was actually saved vs. the goal
   - Roll over/reset budgets for the next month (per the close-out choices above)

---

## 3. Expense Categories

### A. Necessary / Fixed Expenses
Recurring, largely non-negotiable monthly obligations. User-editable list, examples:
- Mortgage / Rent
- Electricity (light bill)
- Water / Gas
- Car payment
- Car / Health / Home insurance
- Phone / Internet
- Minimum debt payments (credit cards, student loans)
- Subscriptions (streaming, gym, etc.)

### B. Discretionary / Variable Expenses
Flexible spending the user actively wants to control. Default categories (user can add/edit/remove):
- Groceries
- Restaurants / Dining out
- Entertainment / "Pleasure" (movies, hobbies, shopping)
- Transportation (gas, rideshare, parking)
- Personal care
- Travel
- Gifts / Miscellaneous

### C. Savings
- Treated like a "category" with its own budget line so it competes for dollars
  the same way restaurants or entertainment do (pay-yourself-first model)

---

## 4. Feature Requirements

### 4.1 Income & Budget Setup
- Input total monthly income (editable anytime; support recurring vs. one-time income)
- Set monthly savings target: fixed amount or % of income
- Auto-calculate "available to spend" = Income − Fixed Expenses − Savings Goal
- Let the user allocate the remainder across discretionary categories (a simple
  budget-per-category input, adjustable with sliders or number fields)

### 4.2 Expense Entry
- **Home screen quick-add widget**: an installable-PWA home screen shortcut/widget
  that opens straight to the quick-add form (skipping the dashboard/login flow),
  so logging a purchase right after buying it takes just one tap from the phone's
  home screen
- **Manual entry**: quick-add form — amount, category, date, merchant/note, payment
  method (cash/debit/credit card). Should be fast enough to use in the moment
  (e.g., right after a purchase).
  - **Store/merchant dropdown**: a preset list of common stores for fast tap-to-select
    (e.g., Costco, Amazon, Walmart, Target, Kroger, plus any others the user adds),
    instead of typing the name every time. Include an "Other / type manually" option
    for anything not in the list.
    - User can add/remove/reorder their own frequent stores over time
    - Selecting a store can optionally auto-suggest a category (e.g., Costco →
      Groceries, Amazon → Pleasure/Miscellaneous by default, user-editable)
- **Statement upload**: import CSV or PDF bank/credit card statements
  - Parse transactions (date, merchant, amount)
  - Auto-suggest a category per transaction (based on merchant name/keywords, with
    manual override)
  - Flag duplicates against manually-entered transactions to avoid double-counting
- Ability to edit, delete, or re-categorize any transaction after the fact
- Recurring transaction detection (e.g., same merchant/amount monthly → suggest
  marking as a fixed expense)

### 4.3 Budget Tracking Logic
- Real-time comparison: **budgeted vs. spent**, per category and overall
- Warn/alert when a category is close to or over budget
- Track "days left in month" vs. "budget remaining" to show pace (e.g., "$120 left
  with 10 days to go")
- Running total of credit card spend to help avoid interest/fees (optionally track
  due dates and balances vs. statement limit)

### 4.4 Dashboard (Visualizations)
- **Monthly summary**: income vs. total spent vs. saved, in one glance
- **Category breakdown**: pie/donut chart of spending by category
- **Budget vs. actual**: bar chart per category (budgeted amount vs. spent amount)
- **Trend over time**: line chart of monthly spending/savings over the last 6–12 months
- **Savings progress**: progress bar/ring toward the monthly (and optionally
  cumulative/long-term) savings goal
- **Top spending categories** and **biggest single transactions** this month
- **Year-over-year comparison**: since data is stored by year (§4.7), show
  side-by-side or % change stats per category and overall (e.g., "Restaurants:
  +18% vs. this month last year," "Total saved: +$1,200 vs. 2025 year-to-date")
- **Credit utilization tracker**: current credit card balance(s) vs. credit
  limit(s), shown as a percentage/gauge, since high utilization affects both
  card fees/interest risk and credit score. Optionally show days-until-due and
  "pay this much to avoid interest" if due date/APR are entered.

### 4.5 Savings Goal
- User picks a "reasonable" monthly savings amount, either:
  - Manual entry, or
  - Suggested default (e.g., 20% of income, adjustable), with the app showing the
    impact on discretionary budget if they increase/decrease it
- **"What if" savings slider**: drag a slider to raise/lower the monthly savings
  goal and see, live, how it reshapes the discretionary budget (e.g., dragging
  savings up from $400 to $600 immediately shows which category budgets shrink
  to make room) — makes picking a "reasonable" number concrete instead of abstract
- Track actual savings achieved vs. goal, month over month
- Optional: streaks or milestones (e.g., "3 months in a row hitting your goal")

### 4.6 Notifications / Reminders
- **Monthly reminder**: nudge to upload that month's bank/credit card statements
- **Daily reminder**: 9:00 PM Central Time check-in to log the day's expenses if
  none have been entered yet (skip/soften if already caught up)
- Alert when a category is near/over its limit
- Requires push notifications (Web Push for a PWA) — see §6

### 4.7 Yearly Data Storage & Export
- All data (income, transactions, budgets, categories) is stored **organized by
  year**, so each year's history is kept separately and can be browsed on its own
  (e.g., "2026," "2027," …) in addition to any month-to-month view
- Dashboard should support switching between years, and optionally an
  all-time/multi-year trend view
- **Downloadable Excel file**: at any time, the user can export a given year's
  data (or a custom date range) as a `.xlsx` file — one sheet per month (or a
  single sheet with month columns), including income, all transactions by
  category, budgeted vs. actual, and total saved. This should always be
  available, not just at year-end.

---

## 5. Data Model (high-level)

**User**
- id, name, monthly_income (list of income sources), savings_goal (amount or %)

**Category**
- id, name, type (necessary | discretionary | savings), budgeted_amount, color/icon

**CreditCard** (for utilization tracking)
- id, name, current_balance, credit_limit, due_date, apr (optional)

**Transaction**
- id, date, amount, category_id, store (from preset dropdown or custom), note,
  source (manual | statement_import), payment_method

**Store** (for the dropdown)
- id, name, default_category_id (optional, for auto-suggest), is_preset (built-in
  like Costco/Amazon/Walmart vs. user-added)

**Statement Import**
- id, upload_date, file_reference, matched_transaction_ids, status

**MonthlySummary** (computed/cached)
- month, total_income, total_fixed, total_discretionary, total_saved, savings_goal_met (bool)

**Note on structure**: Transactions, Categories, and MonthlySummary should all be
keyed/queryable by **year** (and month within year), since data is stored and
browsed per-year. This also makes the Excel export straightforward — export is
just a formatted dump of one year's records.

---

## 6. Suggested Tech Approach

This can be built as a single web app that works well on both desktop and mobile
(responsive design or PWA so it can be "added to home screen" on a phone) rather
than building two separate native apps.

- **Frontend**: React (or React Native/Expo later if a true native app is wanted)
- **Backend**: Lightweight API (Node/Express, or serverless functions) + database
  (Postgres or SQLite to start)
- **Statement parsing**: CSV parsing built-in; PDF parsing via a text-extraction
  library, with a manual-review step since bank PDF formats vary
- **Charts**: A charting library (e.g., Recharts, Chart.js) for the dashboard
- **Auth**: Simple email/password or passwordless login; data should be private per user
- **Hosting**: Any standard web host; PWA config for phone install
- **Push notifications**: Web Push API (works on modern iOS 16.4+/Android) for
  the monthly and 9 PM daily reminders — requires the user to grant notification
  permission and a small backend scheduler/cron to trigger them
- **Excel export**: a library like SheetJS (xlsx) to generate the downloadable
  `.xlsx` file from a year's stored data
- **Home screen widget**: PWA manifest `shortcuts` entry (and/or Web App Manifest
  "share target"/shortcut icons) so "Add Expense" can launch directly from the
  phone home screen without opening the full app first

---

## 7. Suggested Build Order (MVP → Full)

Built and used solo first; multi-user sharing with friends/family comes last,
once the app is proven out for personal use.

1. **MVP**: Income input, fixed expenses, discretionary categories with budgets,
   manual transaction entry, simple dashboard (spent vs. budget per category),
   data organized by year
2. **v2**: Statement upload/import with auto-categorization, duplicate detection
3. **v3**: Full dashboard with trends over time, savings goal tracking/streaks,
   Excel export
4. **v4**: Notifications — monthly statement-upload reminder and 9 PM daily
   expense-logging check-in, recurring transaction detection, credit card
   fee/interest tracking
5. **v5 (last step): Multi-user accounts** — sign-up/login, each user's data
   (income, transactions, budgets, statements) fully scoped/private to their own
   account, so the app can be shared with friends and family with everyone
   tracking their own numbers. Include basic security hardening at this stage:
   proper password hashing, per-user data isolation on every query, and
   encryption at rest for anything sensitive (statements, account details).

---

## 8. Open Questions to Decide Before Building
- Manual statement upload only, or eventually connect directly to bank accounts
  (e.g., via Plaid) for automatic transaction sync?
- Local-only storage vs. cloud sync across devices? (Cloud sync is effectively
  required once multi-user/friends-and-family sharing is added in v5.)
- Any household/shared-budget mode planned later (e.g., a couple viewing one
  combined budget), or is every account strictly individual?
