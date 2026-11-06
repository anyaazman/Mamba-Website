// i18n.js — text lookup shared by the English site and the Malay site
// (my.mambaapp.online, pages under ms/).
//
// The English text itself is the key, so scripts read naturally:
//   t('Network error. Please try again.')
//   t('Welcome, {name}', { name: first })
//
// English pages load only this file and every lookup returns its input. Malay
// pages load i18n-ms.js first, which defines window.MAMBA_MS; a key missing
// there falls back to the English text rather than showing nothing.
// tests/ms-i18n-coverage.spec.js fails when a t('…') key has no Malay entry.
(function () {
  'use strict';

  var lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
  var dict = lang.indexOf('ms') === 0 && window.MAMBA_MS ? window.MAMBA_MS : null;
  var has = Object.prototype.hasOwnProperty;

  function t(text, vars) {
    var out = dict && has.call(dict, text) ? dict[text] : text;
    if (vars) {
      out = out.replace(/\{(\w+)\}/g, function (match, key) {
        return has.call(vars, key) ? String(vars[key]) : match;
      });
    }
    return out;
  }

  window.MAMBA_LANG = dict ? 'ms' : 'en';
  window.MAMBA_T = t;
})();
