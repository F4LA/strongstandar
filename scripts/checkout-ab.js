/**
 * 21DC Checkout A/B test - Strong Standard
 * Loaded first in <head> of the checkout pages (no defer, so the redirect happens before render).
 *   data-variant="a" data-b-path="/.../checkout-97-b/"  -> version A: assigns 50/50 and sends B visitors to b-path
 *   data-variant="b"                                       -> version B
 *   data-variant="result"                                  -> thank-you page: reports which version the buyer saw
 * Assignment is saved in the browser so a returning visitor always sees the same version.
 * Force a version for testing with ?ab=a or ?ab=b
 * Reports to GA4/GTM via dataLayer and to GHL via the checkout_variant URL param on the form iframe.
 */
(function () {
  var KEY = 'ss_ab_21dc_checkout';
  var EXPERIMENT = '21dc_checkout';
  var s = document.currentScript;
  var page = s ? s.getAttribute('data-variant') : null;
  var bPath = s ? s.getAttribute('data-b-path') : null;
  var q = new URLSearchParams(location.search);

  function getSaved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function push(obj) { window.dataLayer = window.dataLayer || []; window.dataLayer.push(obj); }

  if (page === 'result') {
    var r = getSaved();
    if (r === 'a' || r === 'b') push({ event: 'ab_checkout_conversion', ab_experiment: EXPERIMENT, ab_variant: r });
    return;
  }

  var variant;
  if (page === 'a') {
    var forced = q.get('ab');
    variant = (forced === 'a' || forced === 'b') ? forced : getSaved();
    if (variant !== 'a' && variant !== 'b') variant = Math.random() < 0.5 ? 'a' : 'b';
    save(variant);
    if (variant === 'b' && bPath) {
      q.delete('ab');
      var qs = q.toString();
      location.replace(bPath + (qs ? '?' + qs : '') + location.hash);
      return;
    }
  } else {
    variant = 'b';
    if (getSaved() !== 'b') save('b');
  }

  push({ event: 'ab_checkout_view', ab_experiment: EXPERIMENT, ab_variant: variant });

  function tagForms() {
    document.querySelectorAll('iframe[src*="leadconnectorhq.com/widget/form"]').forEach(function (f) {
      try {
        var url = new URL(f.getAttribute('src'), location.origin);
        if (url.searchParams.get('checkout_variant') === variant) return;
        url.searchParams.set('checkout_variant', variant);
        f.setAttribute('src', url.toString());
      } catch (e) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tagForms);
  else tagForms();
})();
