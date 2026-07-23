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
    var form = document.getElementById('deletionForm');
    if (!form) return;
    var btn = document.getElementById('deletionSubmit');

    form.addEventListener('submit', function(e) {
      e.preventDefault();

      var email = form.querySelector('#deletionEmail').value.trim();
      var mt5Account = form.querySelector('#deletionAccount').value.trim();
      var reason = form.querySelector('#deletionReason').value.trim();
      var confirmed = form.querySelector('#deletionConfirm').checked;
      var website = form.querySelector('#website').value.trim(); // honeypot

      if (!email) {
        showStatus(form, 'Please enter the email address on your account.', true);
        return;
      }
      if (!confirmed) {
        showStatus(form, 'Please tick the box to confirm you understand this is permanent.', true);
        return;
      }

      showStatus(form, '', false);
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = 'Submitting...';

      fetch('/api/request-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          mt5_account: mt5Account,
          reason: reason,
          confirm: confirmed,
          website: website
        })
      })
      .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
      .then(function(result) {
        btn.disabled = false;
        btn.textContent = originalText;
        if (result.ok) {
          form.reset();
          showStatus(form, 'Your deletion request has been received. We will verify it and email you a confirmation once your account is deleted.', false);
        } else {
          showStatus(form, (result.data && result.data.error) || 'Failed to submit. Please try again.', true);
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
