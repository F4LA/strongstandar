/*
 * Strong Standard internal tools: login gate + private Google Sheets access.
 *
 * Load AFTER the Supabase UMD script:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js"></script>
 *   <script src="/scripts/ss-auth.js"></script>
 *
 * Then read sheets with:  await ssAuth.sheet(SPREADSHEET_ID, "Tab!A:Z")  -> string[][]
 *
 * Login uses the same Supabase project + Google sign-in as the Coach Portal.
 * Only @strongstandard.com accounts get in. Sheets stay private: the Coach
 * Portal's /api/sheets bridge reads them with the ss-tools-sheets service
 * account after checking the user's session.
 */
(function () {
  var BRIDGE = 'https://coachportal.strongstandard.com';
  var DOMAIN = '@strongstandard.com';

  var client = null;
  var resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });
  var gate = null;

  var GOOGLE_ICON =
    '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showGate(inner) {
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'ss-auth-gate';
      gate.setAttribute('style',
        'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;' +
        'padding:24px;background:#0f1117;color:#e8eaf6;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;');
      (document.body || document.documentElement).appendChild(gate);
    }
    gate.innerHTML =
      '<div style="width:100%;max-width:380px;background:#1a1d27;border:1px solid #2d3148;border-radius:14px;padding:32px 28px;text-align:center;">' +
      '<div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8892b0;margin-bottom:10px;">Strong Standard</div>' +
      '<div style="font-size:20px;font-weight:700;margin-bottom:8px;">' + esc(document.title || 'Internal tool') + '</div>' +
      inner + '</div>';
    gate.style.display = 'flex';
  }

  function hideGate() { if (gate) gate.style.display = 'none'; }

  function loginButton() {
    return '<button id="ss-auth-google" type="button" style="display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;' +
      'padding:12px 16px;border-radius:10px;border:1px solid #2d3148;background:#fff;color:#1e2235;font-size:15px;font-weight:600;cursor:pointer;">' +
      GOOGLE_ICON + 'Sign in with Google</button>';
  }

  function bindLogin() {
    var b = document.getElementById('ss-auth-google');
    if (b) b.onclick = signIn;
  }

  function showLogin(message) {
    showGate(
      '<p style="font-size:14px;color:#8892b0;margin:0 0 22px;">Sign in with your @strongstandard.com Google account.</p>' +
      (message ? '<p style="font-size:13px;color:#ff4757;margin:0 0 16px;">' + esc(message) + '</p>' : '') +
      loginButton()
    );
    bindLogin();
  }

  function showError(message) {
    showGate('<p style="font-size:14px;color:#ff4757;margin:0 0 18px;">' + esc(message) + '</p>' +
      '<button type="button" onclick="location.reload()" style="padding:10px 16px;border-radius:10px;border:1px solid #2d3148;background:transparent;color:#e8eaf6;cursor:pointer;">Try again</button>');
  }

  function signIn() {
    client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: location.origin + location.pathname,
        queryParams: { hd: DOMAIN.slice(1), prompt: 'select_account' }
      }
    });
  }

  function signOut() {
    if (!client) return;
    client.auth.signOut().then(function () { location.reload(); });
  }

  function addSignOutPill(email) {
    if (document.getElementById('ss-auth-pill')) return;
    var pill = document.createElement('button');
    pill.id = 'ss-auth-pill';
    pill.type = 'button';
    pill.title = 'Signed in as ' + email + '. Click to sign out.';
    pill.textContent = 'Sign out';
    pill.setAttribute('style',
      'position:fixed;left:12px;bottom:12px;z-index:2147483645;padding:6px 12px;border-radius:999px;font-size:12px;' +
      'border:1px solid rgba(136,146,176,.4);background:rgba(26,29,39,.85);color:#e8eaf6;cursor:pointer;');
    pill.onclick = signOut;
    document.body.appendChild(pill);
  }

  var lastToken = null;

  function handleSession(session) {
    if (!session) { showLogin(); return; }
    var email = ((session.user && session.user.email) || '').toLowerCase();
    if (!email.endsWith(DOMAIN)) {
      client.auth.signOut();
      showLogin(email + ' is not a company account. Use your @strongstandard.com email.');
      return;
    }
    lastToken = session.access_token;
    hideGate();
    addSignOutPill(email);
    resolveReady(session);
  }

  async function init() {
    showGate('<p style="font-size:14px;color:#8892b0;margin:0;">Loading…</p>');
    if (!window.supabase || !window.supabase.createClient) {
      showError('Login library failed to load. Check your connection and try again.');
      return;
    }
    var cfg;
    try {
      var res = await fetch(BRIDGE + '/api/auth-config', { cache: 'no-store' });
      cfg = await res.json();
      if (!cfg.url || !cfg.anonKey) throw new Error('missing config');
    } catch (e) {
      showError('Could not reach the login service. Try again in a moment.');
      return;
    }
    client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'ss-tools-auth' }
    });
    client.auth.onAuthStateChange(function (event, session) {
      if (session) lastToken = session.access_token;
      if (event === 'SIGNED_IN') handleSession(session);
      if (event === 'SIGNED_OUT') showLogin();
    });
    var result = await client.auth.getSession();
    handleSession(result.data.session);
  }

  async function currentToken() {
    var result = await client.auth.getSession(); // refreshes an expired token
    return (result.data.session && result.data.session.access_token) || lastToken;
  }

  async function sheet(spreadsheetId, range) {
    await ready;
    var token = await currentToken();
    var url = BRIDGE + '/api/sheets?id=' + encodeURIComponent(spreadsheetId) +
      '&range=' + encodeURIComponent(range) + '&_=' + Date.now();
    var res = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
    var body = await res.json().catch(function () { return {}; });
    if (res.status === 401) {
      showLogin('Your session expired. Please sign in again.');
      throw new Error(body.error || 'Not signed in');
    }
    if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
    return body.values || [];
  }

  // Authorized call to any Coach Portal API route (e.g. '/api/payroll-slack').
  async function api(path, options) {
    await ready;
    var token = await currentToken();
    var opts = options || {};
    var headers = Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + token });
    var res = await fetch(BRIDGE + path, Object.assign({}, opts, { headers: headers, cache: 'no-store' }));
    var body = await res.json().catch(function () { return {}; });
    if (res.status === 401) {
      showLogin('Your session expired. Please sign in again.');
      throw new Error(body.error || 'Not signed in');
    }
    if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
    return body;
  }

  window.ssAuth = { ready: ready, sheet: sheet, api: api, signOut: signOut };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
