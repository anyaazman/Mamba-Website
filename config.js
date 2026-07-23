// config.js — Single source of truth for external broker links & codes.
// To change the Valetax domain or referral code in future, edit ONLY the two
// constants below. Every link, displayed code, and copy-button payload across
// the site is derived from them.
//
// The HTML also carries the correct values statically, so links still work if
// JS is disabled. This script keeps them in sync with the constants below.
(function() {
  'use strict';

  // ---- EDIT THESE TWO VALUES ----
  var VALETAX_DOMAIN = 'https://ma.valetaxglobal.com';
  var REFERRAL_CODE = '3505549';
  // -------------------------------

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
                    '\n\nAs they give me Proper Education To Trade'
  };

  window.MAMBA_CONFIG = CONFIG;

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyConfig);
  } else {
    applyConfig();
  }
})();
