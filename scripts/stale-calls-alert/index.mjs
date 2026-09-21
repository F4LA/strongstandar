// Stale Confirmed Calls -> Slack alert
//
// Reproduces the exact same logic as the "Stale Confirmed Calls" tab in
// tools/invoices-payments-dashboard/index.html, and posts the same team
// message to Slack (#Sales Updates) instead of requiring someone to open
// the dashboard and click "Copy Team Message" manually.
//
// Env vars required (set as GitHub repo secrets):
//   SHEETS_API_KEY      - Google Sheets API key (read-only, same one used by the dashboard)
//   SLACK_WEBHOOK_URL   - Incoming Webhook URL for the #Sales Updates channel
//
// No time-of-day check here on purpose — see .github/workflows/stale-calls-alert.yml
// for why (GitHub Actions cron delay).

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATUS_PATH = join(__dirname, 'status.json');

function writeStatus(extra) {
  try {
    writeFileSync(STATUS_PATH, JSON.stringify({
      lastRunAtUTC: new Date().toISOString(),
      ...extra,
    }, null, 2) + '\n');
  } catch (e) {
    console.warn('Could not write status.json:', e.message);
  }
}

const SHEET_ID = '1ctM6K8hQfh73bi7f-MtXkqW3BaPxU73NZf8xPJQUEOc';
const RANGE = 'Leads applied!A:P';

const SHEETS_API_KEY = process.env.SHEETS_API_KEY;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Leads Applied column indices (0-based) — same as the dashboard's `L` object
const L = {
  FIRST_NAME: 0,
  LAST_NAME: 1,
  EMAIL: 2,
  CALL_DATE: 10,
  CALL_STATUS: 11,
  SALES_CALL_WITH: 12,
};

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

if (!SHEETS_API_KEY) fail('SHEETS_API_KEY env var is missing.');
if (!SLACK_WEBHOOK_URL) fail('SLACK_WEBHOOK_URL env var is missing.');

// No hour-matching rule here on purpose: GitHub Actions cron runs late
// unpredictably, so the workflow schedules ~1h early (see .yml) and this
// script just checks for stale calls and sends whenever it's triggered —
// twice a day, roughly morning and afternoon Eastern time.

// ── Same parseDate() as the dashboard ──
function parseDate(str) {
  if (!str || !str.trim()) return null;
  str = str.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [m, d, y] = str.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(str);
  if (isNaN(parsed)) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function fmt(d) {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function norm(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

// "Today" as a midnight-local date in America/New_York, matching what the
// dashboard does with the browser's local midnight.
function todayEastern() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return new Date(Number(map.year), Number(map.month) - 1, Number(map.day));
}

// ── Slack mention mapping (scripts/stale-calls-alert/slack-ids.json) ──
let slackIds = {};
try {
  const raw = readFileSync(join(__dirname, 'slack-ids.json'), 'utf8');
  slackIds = JSON.parse(raw);
} catch (e) {
  console.warn('Could not read slack-ids.json, will fall back to plain names.', e.message);
}

function slackMention(name) {
  const key = (name || '').trim().toLowerCase();
  const id = slackIds[key];
  if (!id || id.startsWith('REPLACE_WITH_')) return norm(name) || 'Unknown';
  return `<@${id}>`;
}

// ── Fetch "Leads applied" from the same Sheet the dashboard reads ──
async function fetchLeadsRows() {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/` +
    `${encodeURIComponent(RANGE)}?key=${SHEETS_API_KEY}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return (await res.json()).values || [];
}

async function postToSlack(text) {
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Slack webhook failed: HTTP ${res.status} ${body}`);
  }
}

async function main() {
  const allRows = await fetchLeadsRows();
  const rows = allRows.slice(1); // drop header row
  const now = todayEastern();

  const stale = rows.filter(r => {
    const status = (r[L.CALL_STATUS] || '').trim().toLowerCase();
    const callDate = parseDate(r[L.CALL_DATE]);
    return status === 'confirmed' && callDate && callDate < now;
  });

  if (stale.length === 0) {
    console.log('No stale confirmed calls today — nothing to send.');
    writeStatus({ staleCount: 0, sent: false, totalRowsRead: rows.length });
    return;
  }

  stale.sort((a, b) => parseDate(a[L.CALL_DATE]) - parseDate(b[L.CALL_DATE]));

  const callLines = stale.map(r => {
    const first = norm(r[L.FIRST_NAME]);
    const last = norm(r[L.LAST_NAME]);
    const name = `${first} ${last}`.trim();
    const callDate = parseDate(r[L.CALL_DATE]);
    const salesWith = (r[L.SALES_CALL_WITH] || 'Unknown').trim();
    const mention = slackMention(salesWith);
    return `- ${name} | Call date: ${fmt(callDate)} | With: ${mention}`;
  }).join('\n');

  // Same template text as the dashboard's "Copy Team Message" button.
  const message =
    `Hey team! Quick heads up -- we have a few sales calls that already took place but are still showing as "Confirmed" in the system. Here are the calls we need an update on:\n\n${callLines}\n\nCould everyone take a moment to update the status for any calls you had? Just mark them as Showed, No Show, or Cancelled. Also, if any of these were rescheduled please let us know so we can update the date in the sheet. We want to make sure our data stays accurate and nothing falls through the cracks. Really appreciate it! Peace. :muscle:`;

  await postToSlack(message);
  console.log(`Sent Slack alert for ${stale.length} stale confirmed call(s).`);
  writeStatus({ staleCount: stale.length, sent: true, totalRowsRead: rows.length });
}

main().catch(err => {
  console.error('Failed:', err);
  writeStatus({ error: err.message, sent: false });
  process.exit(1);
});
