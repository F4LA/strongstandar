# Invoices & Payments Dashboard

**What it does:** weekly ops dashboard that reads the main Google Sheet and flags overdue payments, missing client info, sales attribution mismatches, calls stuck on "Confirmed", invoices not logged in the Mastersheet, and data anomalies. Also shows monthly financials (Contracted / Collected / Pending).

**Where it lives:** `tools/invoices-payments-dashboard/index.html` (single HTML file, no backend). Live at `strongstandard.com/tools/invoices-payments-dashboard/`. Page title in the header: "Weekly Operations Dashboard".

**Last verified:** Oct 15, 2026

---

## How data is loaded

- On page open (and on **↻ Refresh**), the browser calls the Google Sheets API directly with a read-only API key hardcoded in the file.
- Sheet ID: `1ctM6K8hQfh73bi7f-MtXkqW3BaPxU73NZf8xPJQUEOc`
- Ranges fetched on load:

| Tab | Range | Used by |
|---|---|---|
| Client Mastersheet | A:AG | Invoices & Payments, Sales Attribution, Financials, Invoice Audit |
| Payment Plan | A:F | Invoices & Payments, Financials, Alerts |
| Leads applied | A:P | Sales Attribution, Stale Confirmed Calls |
| Payment Records | A:G | Financials |
| Refund Records | A:D | Financials |
| Invoices Bakcup | A:Z | Invoice Audit (loaded only when the tab is opened) |

- Every request has a cache buster, so data is always live from the Sheet. Nothing is written back to the Sheet.
- **Rows are read by column position, not header name.** If a column is inserted, moved or deleted in the Sheet, the dashboard reads the wrong data until the column map in the code is updated.

## Column maps

**Client Mastersheet**

| Field | Col |
|---|---|
| First name | A |
| Last name | B |
| Email | C |
| Product | D |
| $ Package | E |
| Date purchased | F |
| Coach | J (a "Coach:" prefix is stripped) |
| Sales person (credited) | M |
| New or Resign | S |
| Refund (TRUE/FALSE) | Y |
| Cash collected | Z |
| Exclude from alerts (TRUE/FALSE) | AG |

**Leads applied**

| Field | Col |
|---|---|
| First name / Last name / Email | A / B / C |
| Sales call booked date | K |
| Call status (Confirmed, Showed, No Show...) | L |
| Sales call with | M |
| End in sale yes/no | N |
| End in sale date | O |

**Payment Plan**

| Field | Col |
|---|---|
| Full name | A |
| Email | B |
| Due date | C |
| Plan (e.g. 2 of 6) | D |
| Amount | E |
| Status (Paid / other) | F |

**Payment Records:** C = date, D = amount, G = payment method.
**Refund Records:** C = refund date, D = refund amount.
**Invoices Bakcup:** A = name, C = email, D = date sent.

Dates accepted: `M/D/YYYY` or text like `June 1, 2026`. Anything else is ignored (treated as no date).

## The weekly review window

Invoices & Payments (Missing Info section) and Sales Attribution only look at a **Thursday to Thursday** window: from last week's Thursday through the most recent Thursday (both inclusive), based on the viewer's local date. The window is shown at the top of each tab.

---

## Tab 1: 💳 Invoices & Payments

**1. Overdue Payments**
- Source: Payment Plan.
- Rule: due date is today or earlier AND status is not "paid" (case-insensitive). Not limited to the weekly window.
- Each card shows: name, email, due date, days overdue, amount, plan number, coach.
- Coach is looked up by matching the Payment Plan full name to Mastersheet First + Last name. If names differ (e.g. Ben vs Benjamin), coach shows blank.
- **Outreach tracker** (Not contacted / 1st reach out / 2nd reach out): stored in the browser's localStorage only. Not shared between people or devices. At "2nd reach out" it shows "Escalate → Bernardo".
- **Copy Message** copies a pre-written message to the coach with client, amount and date. Suggested action: attempt the charge in GHL, if it fails message the coach.

**2. New Clients: Missing Info**
- Source: Client Mastersheet, rows with Date purchased inside the weekly window.
- Excluded: New or Resign contains "resign", Refund = TRUE, Exclude from alerts (AG) = TRUE.
- Flags a client if any of these is true: $ Package (E) is empty, Cash Collected (Z) is empty, or their email is not found anywhere in Payment Plan.
- Use col AG = TRUE for staff/coaches set up as clients only for payroll.

Tab badge = overdue + missing info count.

## Tab 2: 🔍 Sales Attribution

Checks that the person credited for a sale is the person who had the call.

- Source: new clients in the weekly window (Mastersheet), excluding resigns and AG = TRUE. Refunded clients are NOT excluded here.
- Each client is matched to Leads applied **by email**.
- **Attribution Mismatch:** Leads applied "Sales call with" (M) ≠ Mastersheet "Sales person" (M). Comparison ignores case and a leading "Dr." (so "Dr. Joey" = "Joey").
- **No Lead Record Found:** client email doesn't exist in Leads applied (usually the lead used a different email).
- Spelling differences still count as mismatches (e.g. "Dennis" vs "Deniz").

## Tab 3: 📞 Stale Confirmed Calls

- Source: Leads applied, all rows (no weekly window).
- Rule: Call status (L) = "confirmed" AND call date (K) is before today. Sorted oldest first.
- Fix: update the status in Leads applied to Showed, No Show or Cancelled (or update the date if rescheduled).
- **Copy Team Message** builds the same text the Slack automation sends. Mentions here come from the dashboard's **⚙️ Slack IDs** button, which saves names → @handles in the viewer's browser (localStorage). Pasted @handle text does not always become a real Slack tag.
- The automated Slack version of this tab is documented in [stale-calls-alert.md](../automations/stale-calls-alert.md) and uses its own ID list, not the dashboard's.

## Tab 4: 📊 Financials

Month selector (can't go past the current month) plus a Jan to Dec table for the selected year with a Collection Rate column (Collected ÷ Contracted).

| Metric | Source | Rule |
|---|---|---|
| **Contracted** | Client Mastersheet | Sum of $ Package (E) for rows with Date purchased (F) in the month. Skips any email that has Refund (Y) = TRUE on any row. |
| **Collected** | Payment Records − Refund Records | Sum of Payment Records amount (D) with date (C) in the month, excluding rows where method (G) = "cash". Minus the sum of Refund Records amount (D) with refund date (C) in the same month. |
| **Pending** | Payment Plan | Sum of Amount (E) with due date (C) in the month and status ≠ "paid". Skips emails with Refund (Y) = TRUE. |

Note: Collected already uses the Refund Records tab (refund subtracted in the month it happened). Contracted and Pending still use the old col Y email exclusion, which removes all of a client's history if they were ever refunded.

## Tab 5: 🔎 Invoice Audit

Loads only when you open the tab.

- Compares every row in **Invoices Bakcup** (tab name is spelled with this typo in the Sheet; the code must match it exactly) against Client Mastersheet.
- Match = same email AND invoice date within ±30 days of any Mastersheet purchase date for that email (clients with several rows, e.g. resigns, are checked against all of them).
- **Not in Mastersheet:** invoice email has no Mastersheet row at all.
- **Date Mismatch (Resign?):** email exists but no purchase date is within 30 days. Usually a resign that was never logged as a new row.
- If either date is missing, it counts as a match.

## Tab 6: 🚨 Alerts

Read-only anomaly checks. Currently one check:

- **Paid before due date:** Payment Plan row with status "paid" and a due date in the future.
- **✓ Solved** hides the alert for everyone. Stored in Supabase (project `akrxgohrlpiprqwnhkzc`, table `checklist`, key `alert__future_paid__<email>__<date>__<amount>`, value `true`). It never clears on its own. If the row's email, date or amount changes, it becomes a new alert.

---

## Credentials

- Google Sheets API key: hardcoded in the HTML (read-only). The Sheet must stay readable by that key.
- Supabase publishable key: hardcoded in the HTML (Alerts tab).

## Gotchas

- The page has no password gate. Anyone with the URL can open it.
- Column positions are hardcoded. Changing the Sheet layout breaks tabs silently (wrong numbers, not an error).
- Tab names must match exactly, including "Invoices Bakcup".
- Name-based matches (coach lookup) are fragile; email-based matches (Payment Plan, Leads applied, Invoice Audit) are more reliable but break if the client used different emails.
- Outreach tracker, Slack IDs and theme are saved per browser only.
- "Today" and the Thursday window use the viewer's computer date.
