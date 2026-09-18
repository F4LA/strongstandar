// Stale Confirmed Calls -> Slack alert
//
// Reproduces the exact same logic as the "Stale Confirmed Calls" tab in
// tools/invoices-payments-dashboard/index.html, and posts the same team
// message to Slack (#Sales Updates) instead of requiring someone to open
// the dashboard and click "Copy Team Message" manually.
//
// Env vars required (set as GitHub repo secrets):
//   SHEETS_API_KEY     - Google Sheets API key (read-only, same one used by the dashboard)
//   SLACK_WEBHOOK_URL   - Incoming Webhook URL for the #Sales Updates channel
//
// Optional:
//   FORCE_SEND=1        - bypass the 5pm-Eastern time guard (used for manual testing)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SHEET_ID = '1ctM6K8hQfh73bi7f-MtXkqW3BaPxU73NZf8xPJQUEOc';
const RANGE = 'Leads applied!A:P';

const SHEETS_API_KEY = process.env.SHEETS_API_KEY;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const FORCE_SEND = process.env.FORCE_SEND === '1';

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

// ── Time guard: only actually send at 5pm Eastern (America/New_York) ──
// The workflow's cron fires twice a day (once for EDT, once for EST) to
// stay correct across the DST switch. This guard makes sure only the
// correct firing actually posts to Slack.
function isFivePmEastern() {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  const hour = parseInt(hourStr, 10) % 24;
  return hour === 17;
}

if (!FORCE_SEND && !isFivePmEastern()) {
  console.log('Not 5pm Eastern right now — skipping (this is expected for one of the two daily cron firings).');
  process.exit(0);
}

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
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
