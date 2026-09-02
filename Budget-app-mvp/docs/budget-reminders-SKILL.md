---
name: budget-reminders
description: Use to set up or run the budget app's recurring reminders — a monthly nudge to upload the latest bank/credit card statements, and a daily 9 PM Central Time check-in to log any expenses from the day that haven't been entered yet. Trigger this when the user mentions monthly statement reminders, daily expense-logging reminders, or setting up recurring notifications for the budget app.
---

# Budget Reminders

Two lightweight recurring reminders that support the budget app, in place of any
automatic bank login/download. The user stays in control of uploading statements
and logging expenses — this skill just prompts them at the right times.

## Reminder 1: Monthly statement upload
- **Cadence:** once a month (e.g., 1st of the month, or a day the user prefers —
  confirm with them)
- **Action:** send a reminder to upload that month's bank and credit card
  statements into the budget app's statement-import flow
- **Content:** short nudge, e.g. "It's statement time — upload this month's bank
  and credit card statements to reconcile your budget."

## Reminder 2: Daily expense check-in
- **Cadence:** every day at **9:00 PM Central Time**
- **Condition:** only fire if the user hasn't logged any expenses for that
  calendar day yet (skip or soften the message if they're already caught up)
- **Action:** prompt the user to add today's expenses before the day closes out
- **Content:** short nudge, e.g. "Quick check — did you log today's spending yet?
  Takes 30 seconds to add it now."

## Setup notes
- Recurring, time-based notifications need to run on a schedule outside a single
  chat session — set these up as **scheduled/recurring tasks** in whatever
  environment ends up hosting the budget app (Cowork's scheduling feature, a
  phone notification/reminder app, or a backend cron job + push notification if
  the app is built with its own notification system).
- Time zone: anchor the daily reminder to **America/Chicago (Central Time)**
  regardless of where the request originates, so it stays consistent through
  DST changes.
- Keep both reminders low-friction: one line, one clear action, no guilt-tripping
  tone — the goal is a helpful nudge, not a scold.
- If the user wants to snooze or turn off a reminder temporarily (e.g., during
  travel), that should be a quick toggle, not a multi-step settings change.

## Relationship to other pieces
- Works alongside `budget-app-spec.md` (the app itself) — this skill only
  triggers the reminders; the actual statement upload and expense entry happen
  inside the app.
- Replaces the earlier `monthly-statement-check` approach, which assumed
  automated statement downloads. Reminders are simpler and don't require
  touching bank credentials at all.
