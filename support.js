(function() {
  'use strict';

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
        showStatus(form, 'Please enter your email and a message.', true);
        return;
      }
      if (message.length < 5) {
        showStatus(form, 'Please enter a message (at least 5 characters).', true);
        return;
      }

      showStatus(form, '', false);
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = 'Sending...';

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
          showStatus(form, 'Thanks! Your message has been sent. We\'ll get back to you soon.', false);
        } else {
          showStatus(form, (result.data && result.data.error) || 'Failed to send. Please try again.', true);
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = originalText;
        showStatus(form, 'Network error. Please check your connection and try again.', true);
      });
    });
  });
})();
