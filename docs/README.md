# Strong Standard Ops Documentation

Single source of truth for how our internal tools and automations work: what they do, where the data comes from, what connects to what, and what to watch out for.

**Rule:** any change to a tool or automation in this repo updates its doc in the same commit.

## Tools

| Tool | URL | Doc |
|---|---|---|
| Invoices & Payments Dashboard | strongstandard.com/tools/invoices-payments-dashboard/ | [tools/invoices-payments-dashboard.md](tools/invoices-payments-dashboard.md) |

## Automations

| Automation | Runs on | Schedule | Doc |
|---|---|---|---|
| Stale Confirmed Calls Slack Alert | GitHub Actions | 2x daily (~7am / ~4pm ET) | [automations/stale-calls-alert.md](automations/stale-calls-alert.md) |

## Shared data sources

| Source | ID / location | Used by |
|---|---|---|
| Main Google Sheet (Client Mastersheet, Payment Plan, Leads applied, Payment Records, Refund Records, Invoices Bakcup) | Sheet ID `1ctM6K8hQfh73bi7f-MtXkqW3BaPxU73NZf8xPJQUEOc` | Invoices & Payments Dashboard, Stale Calls Alert |
| Supabase project `akrxgohrlpiprqwnhkzc`, table `checklist` | supabase.co | Dashboard Alerts tab ("Solved" state) |

## Doc template (for new entries)

- **What it does** (one sentence)
- **Where it lives** (file path, platform, link)
- **When it runs / how it's triggered**
- **Data in** (sheet, tab, columns)
- **Logic** (rules, filters, calculations)
- **Data out** (what it shows, sends or writes)
- **Credentials** (secret names only, never values)
- **Gotchas** (things that break it or confuse people)
- **Last verified** (date)
