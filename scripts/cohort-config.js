// ═══════════════════════════════════════════════
// 21 DAY CHALLENGE — SHARED COHORT CONFIG
// Update THIS FILE ONLY when the cohort changes.
// All pages (main challenge page, checkout-97, checkout-147,
// 21dc-offer) read from window.SS_COHORT instead of hardcoding
// their own copies of these values.
// ═══════════════════════════════════════════════
window.SS_COHORT = {
  // Google Sheet that tracks participants (Client Mastersheet / 21DC tracking)
  SHEET_ID: '1QWWYn5_SgwCOPaFtq_7CV-WsVnrtmwjUoXPFm7gVM7A',
  SHEET_GID: '0',

  // Date literal matching the "Challenge Month" column (AJ) for the CURRENT cohort.
  // Format must stay 'YYYY-MM-01' to match the gviz date type.
  CHALLENGE_MONTH_DATE: '2026-09-01',

  // Spot counts / pricing tiers
  TOTAL_SPOTS: 60,
  TIER_1_LIMIT: 30,
  PRICE_TIER_1: 97,
  PRICE_TIER_2: 147,

  // Checkout destinations
  LINK_97: 'https://strongstandard.com/21-day-challenge/checkout-97/',
  LINK_147: 'https://strongstandard.com/21-day-challenge/checkout-147/',

  // Key dates for this cohort (format 'YYYY-MM-DD'). Used by the affiliate
  // portal to show start/end/kickoff-call dates — keep these in sync with
  // the dates written on the challenge page and the kickoff/closing call
  // registration pages.
  CHALLENGE_START_DATE: '2026-09-07',
  CHALLENGE_END_DATE: '2026-09-28',
  KICKOFF_CALL_DATE: '2026-09-05',
  KICKOFF_CALL_TIME: '10:00 AM EST'
};
