(function() {
  'use strict';

  var API_BASE = '/api/auth';

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

  function setLoading(form, loading) {
    var btn = form.querySelector('button[type="submit"]');
    var inputs = form.querySelectorAll('input');
    if (loading) {
      btn.disabled = true;
      btn.setAttribute('data-original-text', btn.textContent);
      btn.textContent = btn.textContent === 'Sign In' ? 'Signing In...' : 'Creating Account...';
      btn.classList.add('btn-loading');
      inputs.forEach(function(i) { i.disabled = true; });
    } else {
      btn.disabled = false;
      btn.textContent = btn.getAttribute('data-original-text') || btn.textContent;
      btn.classList.remove('btn-loading');
      inputs.forEach(function(i) { i.disabled = false; });
    }
  }

  function setupTabs() {
    var tabs = document.querySelectorAll('.auth-tab');
    var loginForm = document.querySelector('.login-form');
    var registerForm = document.querySelector('.register-form');

    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var target = tab.getAttribute('data-target');
        loginForm.style.display = target === 'login' ? 'flex' : 'none';
        registerForm.style.display = target === 'register' ? 'flex' : 'none';
      });
    });
  }

  function setupLogin() {
    var form = document.querySelector('.login-form');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = form.querySelector('[name="email"]').value.trim();
      var password = form.querySelector('[name="password"]').value;

      if (!email || !password) {
        showError(form, 'Email and password are required.');
        return;
      }

      setLoading(form, true);

      fetch(API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
      .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
      .then(function(result) {
        if (!result.ok) {
          showError(form, result.data.error || 'Login failed.');
          setLoading(form, false);
          return;
        }
        localStorage.setItem('mamba_token', result.data.token);
        localStorage.setItem('mamba_user', JSON.stringify(result.data.user));
        window.location.href = '/dashboard.html' + (window.MAMBA_DEMO ? '?demo' : '');
      })
      .catch(function() {
        showError(form, 'Network error. Please try again.');
        setLoading(form, false);
      });
    });
  }

  function setupRegister() {
    var form = document.querySelector('.register-form');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var name = form.querySelector('[name="name"]').value.trim();
      var email = form.querySelector('[name="email"]').value.trim();
      var password = form.querySelector('[name="password"]').value;
      var confirm = form.querySelector('[name="confirm_password"]').value;
      var recovery = form.querySelector('[name="recovery_phrase"]').value.trim();

      if (!name || !email || !password || !recovery) {
        showError(form, 'Name, email, password, and recovery phrase are required.');
        return;
      }
      if (password !== confirm) {
        showError(form, 'Passwords do not match.');
        return;
      }
      if (password.length < 8) {
        showError(form, 'Password must be at least 8 characters.');
        return;
      }
      if (recovery.length < 8) {
        showError(form, 'Recovery phrase must be at least 8 characters.');
        return;
      }

      setLoading(form, true);

      fetch(API_BASE + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, password: password, recovery_phrase: recovery })
      })
      .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
      .then(function(result) {
        if (!result.ok) {
          showError(form, result.data.error || 'Registration failed.');
          setLoading(form, false);
          return;
        }
        localStorage.setItem('mamba_token', result.data.token);
        localStorage.setItem('mamba_user', JSON.stringify(result.data.user));
        window.location.href = '/dashboard.html' + (window.MAMBA_DEMO ? '?demo' : '');
      })
      .catch(function() {
        showError(form, 'Network error. Please try again.');
        setLoading(form, false);
      });
    });
  }

  // --- Floating Telegram ---
  (function() {
    var fab = document.getElementById('telegramFab');
    var menu = document.getElementById('telegramMenu');
    if (!fab || !menu) return;

    window.addEventListener('load', function() {
      setTimeout(function() {
        fab.classList.add('pop-in');
        setTimeout(function() {
          fab.classList.add('active');
          menu.classList.add('open');
          setTimeout(function() {
            fab.classList.remove('active');
            menu.classList.remove('open');
          }, 3000);
        }, 600);
      }, 800);
    });

    fab.addEventListener('click', function() {
      fab.classList.toggle('active');
      menu.classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.floating-telegram')) {
        fab.classList.remove('active');
        menu.classList.remove('open');
      }
    });
  })();

  document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('mamba_token')) {
      window.location.href = '/dashboard.html' + (window.MAMBA_DEMO ? '?demo' : '');
      return;
    }
    setupTabs();
    setupLogin();
    setupRegister();
    setTimeout(hideLoadingScreen, 150);
  });
})();
