# Payroll: Send via Slack

**Where:** strongstandard.com/tools/payroll, "Send via Slack" button on every slip (Closer, Coaches, Setter, Admin).

**What it does:** builds the slip as a PDF in the browser and DMs it to the selected Slack member with an editable message, from the existing Slack app's bot.

**How it connects:**
- The payroll page requires Google login (@strongstandard.com) via `/scripts/ss-auth.js`.
- It calls the Coach Portal route `/api/payroll-slack` (repo F4LA/coach-portal):
  - `GET` lists Slack members to pick the recipient.
  - `POST` uploads the PDF and sends the DM.
- Tokens live only in Vercel (coach-portal project):
  - `SLACK_USER_TOKEN` (xoxp-): slips are sent as that person (Miguel), so replies arrive in his own DMs. Only the Slack user who owns this token (matched by email to the Google login) can send. User scopes: `chat:write`, `files:write`, `im:write`.
  - `SLACK_BOT_TOKEN` (xoxb-): lists Slack members; sends as the bot only if there's no user token. Bot scopes: `chat:write`, `files:write`, `im:write`, `users:read`, `users:read.email`.

**Remembered in the browser (localStorage):** which Slack member each person maps to, custom default messages per slip type, and when each slip was sent.

**Gotchas:**
- Slack free plan allows only a few apps, so this reuses the same app as the #Sales Updates webhook.
- If a person isn't matched automatically, pick them once from the list; it's remembered.
