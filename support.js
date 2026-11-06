(function() {
  'use strict';

  // English text is the key; Malay pages swap it via i18n.js + i18n-ms.js.
  function t(s, v) {
    if (window.MAMBA_T) return window.MAMBA_T(s, v);
    return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return k in v ? String(v[k]) : m; }) : s;
  }

  function showStatus(form, message, isError) {
    var el = form.querySelector('.form-status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', !!isError);
    el.style.display = message ? 'block' : 'none';
  }

  document.addEventListener('DOMContentLoaded', function() {
    var form = document.getElementById('supportForm');
    if (!form) return;
    var btn = document.getElementById('supportSubmit');

    form.addEventListener('submit', function(e) {
      e.preventDefault();

      var email = form.querySelector('#supportEmail').value.trim();
      var message = form.querySelector('#supportMessage').value.trim();

      if (!email || !message) {
        showStatus(form, t('Please enter your email and a message.'), true);
        return;
      }
      if (message.length < 5) {
        showStatus(form, t('Please enter a message (at least 5 characters).'), true);
        return;
      }

      showStatus(form, '', false);
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = t('Sending...');

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, message: message })
      })
      .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
      .then(function(result) {
        btn.disabled = false;
        btn.textContent = originalText;
        if (result.ok) {
          form.reset();
          showStatus(form, t("Thanks! Your message has been sent. We'll get back to you soon."), false);
        } else {
          showStatus(form, (result.data && result.data.error) || t('Failed to send. Please try again.'), true);
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = originalText;
        showStatus(form, t('Network error. Please check your connection and try again.'), true);
      });
    });
  });
})();
