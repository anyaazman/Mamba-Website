// config.js — Single source of truth for external broker links, app store
// links & codes.
// To change the Valetax domain, referral code, or app store identifiers in
// future, edit ONLY the constants below. Every link, displayed code, and
// copy-button payload across the site is derived from them.
//
// The HTML also carries the correct values statically, so links still work if
// JS is disabled. This script keeps them in sync with the constants below.
(function() {
  'use strict';

  // ---- EDIT THESE TWO VALUES ----
  var VALETAX_DOMAIN = 'https://ma.valetaxglobal.com';
  var REFERRAL_CODE = '3505549';
  // -------------------------------

  // ---- MOBILE APP STORE IDENTIFIERS ----
  var APPLE_APP_ID = '6776478463';                 // App Store numeric ID
  var ANDROID_PACKAGE = 'com.mambamanagement.app'; // Play Store package name
  // --------------------------------------

  var CONFIG = {
    VALETAX_DOMAIN: VALETAX_DOMAIN,
    REFERRAL_CODE: REFERRAL_CODE,

    // Derived URLs
    REFERRAL_URL: VALETAX_DOMAIN + '/p/' + REFERRAL_CODE,
    SIGNIN_URL: VALETAX_DOMAIN + '/guest/sign-in',
    TICKET_URL: VALETAX_DOMAIN + '/user/tickets/new-ticket' +
                '?utm_medium=chat&utm_campaign=link-shared-in-chat' +
                '&utm_source=livechat.com&utm_content=' +
                VALETAX_DOMAIN.replace('https://', ''),

    // Derived support-ticket copy text
    TICKET_TITLE: 'Changing Partner Code To ' + REFERRAL_CODE,
    TICKET_MESSAGE: 'I want to change my partner code to ' + REFERRAL_CODE +
                    '\n\nAs they give me Proper Education To Trade',

    APPLE_APP_ID: APPLE_APP_ID,
    ANDROID_PACKAGE: ANDROID_PACKAGE,

    // Store URLs. The Apple URL deliberately omits a country segment
    // (e.g. /my/) so Apple auto-resolves to the visitor's own storefront —
    // a hardcoded storefront shows an "item not available in your country"
    // interstitial to everyone outside it.
    IOS_URL: 'https://apps.apple.com/app/id' + APPLE_APP_ID,
    ANDROID_URL: 'https://play.google.com/store/apps/details?id=' + ANDROID_PACKAGE,

    // On-site section listing both stores — used as the desktop fallback for
    // a single "Get the App" button, where we cannot know the visitor's phone.
    DOWNLOAD_ANCHOR: 'index.html#get-app'
  };

  window.MAMBA_CONFIG = CONFIG;

  // ---- PLATFORM DETECTION ----------------------------------------------
  // Returns 'ios' | 'android' | 'desktop'. Used to send each visitor to the
  // store that can actually install the app on the device in their hand.
  function detectPlatform() {
    var ua = navigator.userAgent || '';

    // iPadOS 13+ reports itself as "MacIntel" desktop Safari; the touch-point
    // count is the only reliable way to tell an iPad from a real Mac.
    var isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    if (/iPad|iPhone|iPod/.test(ua) || isIPadOS) return 'ios';

    // Exclude Windows Phone, which historically carried "Android" in its UA.
    if (/Android/i.test(ua) && !/Windows Phone/i.test(ua)) return 'android';

    return 'desktop';
  }

  var PLATFORM = detectPlatform();
  CONFIG.PLATFORM = PLATFORM;

  // The store URL for the current device. Desktop has no single right answer,
  // so it falls back to the on-site section that shows both stores.
  CONFIG.APP_URL = PLATFORM === 'ios' ? CONFIG.IOS_URL
                 : PLATFORM === 'android' ? CONFIG.ANDROID_URL
                 : CONFIG.DOWNLOAD_ANCHOR;

  var APP_LINKS = {
    ios: CONFIG.IOS_URL,
    android: CONFIG.ANDROID_URL,
    auto: CONFIG.APP_URL
  };

  var LINKS = {
    referral: CONFIG.REFERRAL_URL,
    signin: CONFIG.SIGNIN_URL,
    ticket: CONFIG.TICKET_URL
  };

  var COPY = {
    'ticket-title': CONFIG.TICKET_TITLE,
    'ticket-message': CONFIG.TICKET_MESSAGE
  };

  function applyConfig() {
    // <a data-valetax-link="referral|signin|ticket"> → href
    document.querySelectorAll('[data-valetax-link]').forEach(function(el) {
      var url = LINKS[el.getAttribute('data-valetax-link')];
      if (url) el.setAttribute('href', url);
    });

    // <span data-valetax-code> → referral code text
    document.querySelectorAll('[data-valetax-code]').forEach(function(el) {
      el.textContent = CONFIG.REFERRAL_CODE;
    });

    // <span data-valetax-text="ticket-title|ticket-message"> → displayed copy text
    document.querySelectorAll('[data-valetax-text]').forEach(function(el) {
      var text = COPY[el.getAttribute('data-valetax-text')];
      if (text) el.innerHTML = text.replace(/\n/g, '<br>');
    });

    // <button data-valetax-copy="ticket-title|ticket-message"> → data-copy payload
    document.querySelectorAll('[data-valetax-copy]').forEach(function(el) {
      var text = COPY[el.getAttribute('data-valetax-copy')];
      if (text) el.setAttribute('data-copy', text);
    });

    applyAppLinks();
  }

  function applyAppLinks() {
    // Tag <html> so CSS can target the visitor's platform.
    document.documentElement.setAttribute('data-platform', PLATFORM);

    // <a data-app-link="auto|ios|android"> → href for that store.
    // "auto" resolves to whichever store matches the current device.
    document.querySelectorAll('[data-app-link]').forEach(function(el) {
      var kind = el.getAttribute('data-app-link');
      var url = APP_LINKS[kind];
      if (!url) return;

      // A per-element desktop override, e.g. an in-page download section.
      if (kind === 'auto' && PLATFORM === 'desktop' && el.hasAttribute('data-app-fallback')) {
        url = el.getAttribute('data-app-fallback');
      }
      el.setAttribute('href', url);

      // Only leave the new-tab hint on links that really go off-site;
      // an in-page anchor should stay in the current tab.
      if (/^https?:/i.test(url)) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      } else {
        el.removeAttribute('target');
        el.removeAttribute('rel');
      }
    });

    // <span data-app-label> → "App Store" / "Google Play" / "your app store"
    var storeName = PLATFORM === 'ios' ? 'App Store'
                  : PLATFORM === 'android' ? 'Google Play'
                  : 'the App Store or Google Play';
    document.querySelectorAll('[data-app-label]').forEach(function(el) {
      el.textContent = storeName;
    });

    // On a phone, promote the matching store button inside each download
    // block and demote the other one — an iPhone user cannot install an APK,
    // so a full-width Google Play button is a dead end for them.
    if (PLATFORM === 'ios' || PLATFORM === 'android') {
      document.querySelectorAll('[data-app-store-section]').forEach(function(section) {
        section.classList.add('platform-' + PLATFORM);
      });
    }
  }

  // Exposed so dynamically rendered markup (e.g. the dashboard onboarding
  // steps, which are built after this script runs) can re-apply the wiring.
  window.MAMBA_CONFIG.applyAppLinks = applyAppLinks;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyConfig);
  } else {
    applyConfig();
  }
})();
