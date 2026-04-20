/**
 * UTM Persist — Strong Standard
 * Captures UTM params on arrival and reattaches them to all internal links.
 * Include this script in every page of the site.
 */
(function () {
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'ss_utms';

  // 1. Read UTMs from current URL and save to sessionStorage
  const params = new URLSearchParams(window.location.search);
  const captured = {};
  UTM_KEYS.forEach(k => {
    if (params.get(k)) captured[k] = params.get(k);
  });

  if (Object.keys(captured).length > 0) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
  }

  // 2. Load whatever UTMs we have saved
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch (e) {}

  if (Object.keys(saved).length === 0) return;

  // 3. Build query string from saved UTMs
  function buildUTMString() {
    return Object.entries(saved)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  }

  // 4. Append UTMs to a URL (handles existing params)
  function appendUTMs(href) {
    try {
      const url = new URL(href, window.location.origin);
      // Only internal links
      if (url.hostname !== window.location.hostname) return href;
      // Don't overwrite UTMs already in the link
      UTM_KEYS.forEach(k => {
        if (!url.searchParams.get(k) && saved[k]) {
          url.searchParams.set(k, saved[k]);
        }
      });
      return url.toString();
    } catch (e) {
      return href;
    }
  }

  // 5. Patch all existing internal links on the page
  function patchLinks() {
    document.querySelectorAll('a[href]').forEach(a => {
      const patched = appendUTMs(a.getAttribute('href'));
      if (patched !== a.getAttribute('href')) {
        a.setAttribute('href', patched);
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchLinks);
  } else {
    patchLinks();
  }

  // 6. Also patch dynamically added links (for GHL embeds, etc.)
  const observer = new MutationObserver(patchLinks);
  observer.observe(document.body, { childList: true, subtree: true });

})();
