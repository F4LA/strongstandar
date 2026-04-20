/**
 * UTM Persist — Strong Standard
 * Captures UTM params on arrival and reattaches them to all internal links.
 * Include this script in every page of the site.
 */
(function () {
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'ss_utms';
  const INTERNAL_HOSTS = ['strongstandard.com', 'www.strongstandard.com', 'f4la.github.io'];

  // 1. Read UTMs from current URL and save to sessionStorage
  const params = new URLSearchParams(window.location.search);
  const captured = {};
  UTM_KEYS.forEach(k => {
    if (params.get(k)) captured[k] = params.get(k);
  });
  if (Object.keys(captured).length > 0) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
  }

  // 2. Load saved UTMs
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) {}
  if (Object.keys(saved).length === 0) return;

  // 3. Check if a URL is internal
  function isInternal(href) {
    try {
      const url = new URL(href, window.location.origin);
      return url.hostname === window.location.hostname || INTERNAL_HOSTS.includes(url.hostname);
    } catch (e) { return false; }
  }

  // 4. Append UTMs to a URL without overwriting existing ones
  function appendUTMs(href) {
    try {
      const url = new URL(href, window.location.origin);
      if (!isInternal(href)) return href;
      UTM_KEYS.forEach(k => {
        if (!url.searchParams.get(k) && saved[k]) {
          url.searchParams.set(k, saved[k]);
        }
      });
      // Return relative path if same host
      if (url.hostname === window.location.hostname) {
        return url.pathname + (url.search || '') + (url.hash || '');
      }
      return url.toString();
    } catch (e) { return href; }
  }

  // 5. Patch all internal links on the page
  function patchLinks() {
    document.querySelectorAll('a[href]').forEach(a => {
      const original = a.getAttribute('href');
      if (!original || original.startsWith('#') || original.startsWith('mailto:') || original.startsWith('tel:')) return;
      const patched = appendUTMs(original);
      if (patched !== original) a.setAttribute('href', patched);
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchLinks);
  } else {
    patchLinks();
  }

  // 6. Watch for dynamically added links
  const observer = new MutationObserver(patchLinks);
  observer.observe(document.body, { childList: true, subtree: true });

})();
