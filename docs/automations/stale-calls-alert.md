# Stale Confirmed Calls Slack Alert

**What it does:** twice a day, finds sales calls in Leads applied whose date already passed but are still marked "Confirmed", and posts a message to Slack tagging whoever had the call so they update the status.

**Where it lives:**
- Workflow: `.github/workflows/stale-calls-alert.yml`
- Script: `scripts/stale-calls-alert/index.mjs`
- Name → Slack ID map: `scripts/stale-calls-alert/slack-ids.json`
- Last run log: `scripts/stale-calls-alert/status.json`
- Runs on: GitHub Actions (repo F4LA/strongstandar → Actions → "Stale Confirmed Calls Slack Alert")
- Posts to: Slack #Sales Updates (via Incoming Webhook)

**Last verified:** Oct 15, 2026 (last run sent, 2 stale calls)

---

## Schedule

| Cron (UTC) | Target (Eastern / Tampa) |
|---|---|
| `0 11 * * *` | ~7am ET |
| `0 20 * * *` | ~4pm ET |

- GitHub runs scheduled jobs late, sometimes by hours, never early. So it's scheduled about an hour before the real target (8am / 5pm) and the script sends whenever it actually runs.
- Can be run manually: Actions → workflow → **Run workflow** (sends a real message).
- **DST:** crons are fixed UTC. When EST starts (early November), change both to `0 12` and `0 21`. When EDT returns (March), change back to `0 11` and `0 20`.

## Logic

Same rule as the dashboard's Stale Confirmed Calls tab:

1. Reads `Leads applied!A:P` from Sheet `1ctM6K8hQfh73bi7f-MtXkqW3BaPxU73NZf8xPJQUEOc`.
2. Keeps rows where Call status (col L) = "confirmed" and Call date (col K) is before today (today = America/New_York date).
3. If none: sends nothing, writes `sent: false` to status.json.
4. If any: sorts oldest first and posts one message:
   `- <Name> | Call date: <date> | With: <mention>` per call, inside the fixed "Hey team! Quick heads up..." text.

## Slack tagging

- Slack only tags through the webhook with a **Member ID** (`<@U...>`), not with a display name or @handle.
- The script takes "Sales call with" (col M), lowercases and trims it, and looks it up in `slack-ids.json`. If found, it becomes a real tag. If not, the plain name is printed (no notification).
- Current map:

| Name in sheet (col M) | Person | Member ID |
|---|---|---|
| bernardo | Bernardo | U070ZNZQ5FG |
| deniz | Deniz | U0A2ZPR56DB |
| joey, dr. joey, dr joey, dr.joey | Dr. Joey (@Joseph Muñoz) | U071P8EBS9F |
| alan | Alan | U0BU45H3MHB |
| boaz | Boaz | U0C2M4K4H6W |

- **When someone new starts taking calls, or a name is written differently in col M, add a line here or they won't be tagged.** Get the ID in Slack: profile → ⋯ → Copy member ID.

## Credentials (GitHub repo secrets)

- `SHEETS_API_KEY`: Google Sheets read-only key (same key the dashboard uses).
- `SLACK_WEBHOOK_URL`: Incoming Webhook for #Sales Updates.

If either is missing the run fails.

## After each run

- The workflow commits `status.json` (`lastRunAtUTC`, `staleCount`, `sent`, `totalRowsRead`, or `error`) with `[skip ci]`. This is why the repo has many "chore: update stale-calls-alert status.json" commits.
- If the script fails, status.json still gets saved and then the run is marked failed (red in Actions).

## Gotchas

- Not related to the dashboard's ⚙️ Slack IDs button. That list lives in the browser and only affects "Copy Team Message".
- Depends on Leads applied column positions K, L, M. Moving columns breaks it.
- Status matching is exact ("confirmed"). Typos like "Confimed" are not caught.
