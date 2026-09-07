(function () {
  // Only the 21-day-challenge funnel is part of the affiliate program.
  if (!location.pathname.startsWith('/21-day-challenge')) return;

  var isCheckout = location.pathname.includes('/checkout-');
  var eventType = isCheckout ? 'checkout_view' : 'home_view';

  fetch('https://affiliates.strongstandard.com/api/track', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: eventType, path: location.pathname }),
  }).catch(function () {});
})();
