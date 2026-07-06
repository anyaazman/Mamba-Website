(function() {
  'use strict';

  function hideLoadingScreen() {
    var ls = document.querySelector('.loading-screen');
    if (ls) { ls.classList.add('loaded'); document.body.classList.add('page-loaded'); }
    setTimeout(function() { if (ls && ls.parentNode) ls.remove(); }, 1000);
  }

  function showError(form, message) {
    var el = form.querySelector('.form-error');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 6000);
  }

  function showToast(message, type) {
    var existing = document.querySelector('.toast-message');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast-message ' + (type === 'success' ? 'toast-success' : 'toast-error');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
  }

  document.addEventListener('DOMContentLoaded', function() {
    var form = document.querySelector('.reset-form');

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = form.querySelector('[name="email"]').value.trim();
      var recovery = form.querySelector('[name="recovery_phrase"]').value.trim();
      var password = form.querySelector('[name="new_password"]').value;
      var confirm = form.querySelector('[name="confirm_password"]').value;

      if (!email || !recovery || !password) {
        showError(form, 'All fields are required.');
        return;
      }
      if (password !== confirm) {
        showError(form, 'Passwords do not match.');
        return;
      }
      if (password.length < 8) {
        showError(form, 'New password must be at least 8 characters.');
        return;
      }

      fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, recovery_phrase: recovery, new_password: password })
      })
      .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
      .then(function(result) {
        if (!result.ok) {
          showError(form, result.data.error || 'Password reset failed.');
          return;
        }
        showToast('Password reset. Redirecting to login...', 'success');
        setTimeout(function() {
          window.location.href = '/login.html' + (window.MAMBA_DEMO ? '?demo' : '');
        }, 2000);
      })
      .catch(function() {
        showError(form, 'Network error. Please try again.');
      });
    });

    setTimeout(hideLoadingScreen, 150);
  });
})();
