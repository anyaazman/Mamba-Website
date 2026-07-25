// app-banner.js — behaviour for the app install banner.
//
// Visibility is NOT decided here. A small inline gate in each page's <head>
// runs before first paint, sets window.__MAMBA_BANNER, and adds the
// .has-app-banner class to <html> so the layout offset is reserved with no
// layout shift. This file only wires interaction: dismissal, store
// click-through, and keeping the banner glued to the hide-on-scroll header.
//
// Store URLs and the "App Store" / "Google Play" wording come from config.js
// via the shared data-app-link / data-app-label attributes — this file
// deliberately hardcodes neither.
(function () {
  'use strict';

  var KEY = 'mamba_app_banner_hidden_until';
  var DAY = 86400000;
  var DISMISS_DAYS = 30;   // tapped the X — back off for a month
  var CLICKED_DAYS = 180;  // went to the store — probably installed it

  var state = window.__MAMBA_BANNER || { show: false };
  var banner = document.getElementById('appBanner');
  if (!banner) return;

  // The pre-paint gate already made the call. If it said no, drop the markup
  // so it can never be revealed by a stray class or a later style change.
  if (!state.show) {
    if (banner.parentNode) banner.parentNode.removeChild(banner);
    return;
  }

  var header = document.querySelector('.header');
  var closeBtn = document.getElementById('appBannerClose');
  var cta = document.getElementById('appBannerCta');

  // Every localStorage touch is guarded: it throws outright in private-mode
  // Safari and in some in-app webviews, and an uncaught throw here would take
  // down the whole IIFE rather than just the banner.
  function hideFor(days) {
    try {
      localStorage.setItem(KEY, String(Date.now() + days * DAY));
    } catch (e) {
      /* Storage unavailable — the banner simply returns on the next visit. */
    }
  }

  function dismiss() {
    banner.classList.add('app-banner-dismissed');
    document.documentElement.classList.remove('has-app-banner');

    // Without this the focus ring lands on <body> and is lost for keyboard
    // users, since the element it was on is about to be removed.
    var logo = document.querySelector('.header .logo-left a');
    if (logo) {
      logo.setAttribute('tabindex', '-1');
      logo.focus();
    }

    window.setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 300);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      hideFor(DISMISS_DAYS);
      dismiss();
    });
  }

  if (cta) {
    // config.js gives this target="_blank", so the page stays put. Don't tear
    // the banner down mid-tap — just stop nagging someone already at the store.
    cta.addEventListener('click', function () {
      hideFor(CLICKED_DAYS);
    });
  }

  // The CSS carries a measured fallback for --header-h, but the header's real
  // height depends on font loading and on whatever padding it happens to have
  // at a given breakpoint. Re-measuring keeps the banner flush beneath it: too
  // small a value and the header covers the banner's top edge, too large and a
  // gap opens up. Only affects fixed-position offsets, so it costs no CLS.
  function measureHeader() {
    if (!header) return;
    var h = Math.round(header.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--header-h', h + 'px');
  }

  measureHeader();
  window.addEventListener('resize', measureHeader);
  window.addEventListener('orientationchange', measureHeader);
  // Webfonts can change the header's height after first paint.
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(measureHeader);
  }

  // Mirror the header's hide-on-scroll state. Watching the class rather than
  // the scroll event avoids coupling to script.js's handler internals and
  // keeps the two bars from ever separating.
  if (header && window.MutationObserver) {
    var sync = function () {
      var hidden = header.classList.contains('hidden');
      if (hidden) banner.classList.add('hidden');
      else banner.classList.remove('hidden');
    };
    new MutationObserver(sync).observe(header, {
      attributes: true,
      attributeFilter: ['class']
    });
    sync();
  }
})();
