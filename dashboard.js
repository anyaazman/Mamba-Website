// ==== COMING SOON TOAST ====
function showComingSoon(event) {
  if (event) event.preventDefault();

  var existingToast = document.querySelector('.coming-soon-toast');
  if (existingToast) existingToast.remove();

  var toast = document.createElement('div');
  toast.className = 'coming-soon-toast';
  toast.textContent = 'Coming Soon';
  document.body.appendChild(toast);

  setTimeout(function() { toast.classList.add('show'); }, 10);

  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 700);
}

(function() {
  'use strict';

  var API_BASE = '/api';
  var token = localStorage.getItem('mamba_token');

  function hideLoadingScreen() {
    var ls = document.querySelector('.loading-screen');
    if (ls) { ls.classList.add('loaded'); document.body.classList.add('page-loaded'); }
    setTimeout(function() { if (ls && ls.parentNode) ls.remove(); }, 1000);
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
    }, 3000);
  }

  function apiCall(method, path, body) {
    var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
    return fetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function(res) {
      return res.json().then(function(data) { return { ok: res.ok, status: res.status, data: data }; });
    });
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('mamba_user')); } catch(e) { return null; }
  }

  function setUser(user) {
    localStorage.setItem('mamba_user', JSON.stringify(user));
  }

  // --- Onboarding ---
  function renderOnboarding(user) {
    var container = document.getElementById('onboardingSteps');
    var ibDone = user.ib_status === 'approved';
    var mt5Accounts = user.mt5_accounts || [];
    var whitelistDone = mt5Accounts.some(function(a) { return a.status === 'approved'; });
    var hasAccount = mt5Accounts.length > 0;

    var html = '';

    // Step 1: Download App
    html += '<div class="onboarding-step">';
    html += '<div class="onboarding-step-badge">1</div>';
    html += '<div class="onboarding-step-body">';
    html += '<h4>Download Mamba App</h4>';
    html += '<p>Get the full trading experience on your mobile device. Available on Google Play.</p>';
    html += '<div class="download-buttons">';
    html += '<a href="https://play.google.com/store/apps/details?id=com.mambamanagement.app&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" class="store-btn google-play">';
    html += '<div class="store-icon" style="color: #FFFFFF;">';
    html += '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>';
    html += '</div>';
    html += '<div class="store-text"><span class="store-label">GET IT ON</span><span class="store-name">Google Play</span></div>';
    html += '</a>';
    html += '<button class="store-btn app-store" onclick="showComingSoon(event)">';
    html += '<div class="store-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z"/></svg></div>';
    html += '<div class="store-text"><span class="store-label">Download on the</span><span class="store-name">App Store</span></div>';
    html += '</button>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Step 2: Request IB Access
    var step2Class = ibDone ? 'onboarding-step completed' : 'onboarding-step';
    html += '<div class="' + step2Class + '" id="onboardingStep2">';
    html += '<div class="onboarding-step-badge">' + (ibDone ? '&#10003;' : '2') + '</div>';
    html += '<div class="onboarding-step-body">';
    html += '<h4>Request IB Access</h4>';
    html += '<p>Get verified under our Introducing Broker network to unlock full platform features and support.</p>';
    html += '<div class="demo-note">Try for free &mdash; open a Valetax MT5 demo account to test the platform before trading live.</div>';
    if (!ibDone) {
      html += '<button class="onboarding-step-btn" id="onboardingIBBtn">Request IB Verification</button>';
    } else {
      html += '<button class="onboarding-step-btn" disabled>Verified</button>';
    }
    html += '</div>';
    html += '</div>';

    // Step 3: Apply for Whitelist
    var step3Done = whitelistDone;
    var step3Class = step3Done ? 'onboarding-step completed' : 'onboarding-step';
    html += '<div class="' + step3Class + '" id="onboardingStep3">';
    html += '<div class="onboarding-step-badge">' + (step3Done ? '&#10003;' : '3') + '</div>';
    html += '<div class="onboarding-step-body">';
    html += '<h4>Apply for Whitelist</h4>';
    html += '<p>Add your MT5 account and request whitelist approval to enable automated trading with Mamba.</p>';
    if (!step3Done) {
      html += '<button class="onboarding-step-btn" id="onboardingWhitelistBtn">' + (hasAccount ? 'Request Whitelist' : 'Add MT5 Account') + '</button>';
    } else {
      html += '<button class="onboarding-step-btn" disabled>Approved</button>';
    }
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    // Bind Step 2 button
    var ibBtn = document.getElementById('onboardingIBBtn');
    if (ibBtn) {
      ibBtn.addEventListener('click', function() { openIBModal(); });
    }

    // Bind Step 3 button
    var wlBtn = document.getElementById('onboardingWhitelistBtn');
    if (wlBtn) {
      wlBtn.addEventListener('click', function() {
        var mt5Card = document.querySelector('#mt5AccountsList').closest('.portal-card');
        if (mt5Card) {
          mt5Card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          mt5Card.style.boxShadow = '0 0 30px rgba(10, 132, 255, 0.5)';
          setTimeout(function() { mt5Card.style.boxShadow = ''; }, 2000);
        }
      });
    }
  }
  function renderIBBanner(user) {
    var status = user.ib_status;
    var config = {
      approved: { icon: '&#10003;', text: 'IB VERIFIED', cls: 'approved' },
      pending:  { icon: '&#9203;', text: 'IB VERIFICATION PENDING', cls: 'pending' },
      rejected: { icon: '&#10007;', text: 'IB VERIFICATION REJECTED', cls: 'rejected' }
    };
    var cfg = config[status] || config.pending;

    var html = '<div class="status-badge-lg ' + cfg.cls + '">';
    html += '<span class="badge-icon">' + cfg.icon + '</span>';
    html += '<span>' + cfg.text + '</span>';
    html += '</div>';

    if (status !== 'approved') {
      html += '<div style="margin-top: 1rem;">';
      if (status === 'rejected') {
        html += '<p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.75rem;">Your IB verification was not approved. You can re-request.</p>';
      } else {
        html += '<p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.75rem;">Request verification that you are under our IB network.</p>';
      }
      html += '<button class="request-btn" id="requestIBBtn">Request IB Verification</button>';
      html += '</div>';
    }

    document.getElementById('ibBanner').innerHTML = html;

    var reqBtn = document.getElementById('requestIBBtn');
    if (reqBtn) {
      reqBtn.addEventListener('click', openIBModal);
    }
  }

  // --- IB Request Modal ---
  function openIBModal() {
    var modal = document.getElementById('ibModal');
    document.getElementById('ibStepSelect').style.display = 'block';
    document.getElementById('ibStepNew').style.display = 'none';
    document.getElementById('ibStepExisting').style.display = 'none';
    modal.classList.add('active');
  }

  function closeIBModal() {
    document.getElementById('ibModal').classList.remove('active');
  }

  function submitIBRequest(email, type) {
    if (!email || !email.trim()) {
      showToast('Please enter your Valetax email.', 'error');
      return;
    }
    var submitBtns = document.querySelectorAll('#submitIBNew, #submitIBExisting');
    submitBtns.forEach(function(b) { b.disabled = true; b.textContent = 'Submitting...'; });

    apiCall('POST', '/user/request-ib', { ib_email: email.trim(), ib_type: type }).then(function(result) {
      if (result.ok) {
        showToast('IB verification requested.', 'success');
        closeIBModal();
        refreshDashboard();
      } else {
        showToast(result.data.error || 'Request failed.', 'error');
        submitBtns.forEach(function(b) { b.disabled = false; b.textContent = 'Submit IB Request'; });
      }
    });
  }

  function setupIBModal() {
    var modal = document.getElementById('ibModal');

    // Selection step
    document.getElementById('ibOptNew').addEventListener('click', function() {
      document.getElementById('ibStepSelect').style.display = 'none';
      document.getElementById('ibStepNew').style.display = 'block';
      document.getElementById('ibModalTitle').textContent = 'New Valetax Account';
    });

    document.getElementById('ibOptExisting').addEventListener('click', function() {
      document.getElementById('ibStepSelect').style.display = 'none';
      document.getElementById('ibStepExisting').style.display = 'block';
      document.getElementById('ibModalTitle').textContent = 'Existing Valetax Account';
    });

    // Cancel buttons
    document.getElementById('cancelIB').addEventListener('click', closeIBModal);
    document.getElementById('cancelIBNew').addEventListener('click', openIBModal);
    document.getElementById('cancelIBExisting').addEventListener('click', openIBModal);

    // Submit buttons
    document.getElementById('submitIBNew').addEventListener('click', function() {
      submitIBRequest(document.getElementById('ibEmailNew').value, 'new');
    });
    document.getElementById('submitIBExisting').addEventListener('click', function() {
      submitIBRequest(document.getElementById('ibEmailExisting').value, 'existing');
    });

    // Close on backdrop click
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeIBModal();
    });
  }

  // --- MT5 Accounts List ---
  function renderMT5Accounts(accounts) {
    var list = document.getElementById('mt5AccountsList');

    if (!accounts || accounts.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No MT5 accounts added yet.</p>';
      return;
    }

    var html = '';
    accounts.forEach(function(acc) {
      html += '<div class="mt5-account-row">';
      html += '<div class="mt5-account-info">';
      html += '<span class="mt5-account-number">' + escapeHtml(acc.account_number) + '</span>';
      html += '<span class="status-badge status-' + acc.status + '">' + acc.status.toUpperCase() + '</span>';
      html += '</div>';
      if (acc.status !== 'approved') {
        html += '<button class="request-btn request-whitelist-btn" data-account-id="' + acc.id + '" style="font-size: 0.7rem; padding: 0.35rem 0.9rem;">' + (acc.status === 'rejected' ? 'Re-request' : 'Request Whitelist') + '</button>';
      }
      html += '</div>';
    });

    list.innerHTML = html;

    list.querySelectorAll('.request-whitelist-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var accountId = parseInt(btn.getAttribute('data-account-id'));
        btn.disabled = true;
        btn.textContent = 'Submitting...';
        apiCall('POST', '/user/request-whitelist', { account_id: accountId }).then(function(result) {
          if (result.ok) {
            showToast('Whitelist requested.', 'success');
            refreshDashboard();
          } else {
            showToast(result.data.error || 'Request failed.', 'error');
            btn.disabled = false;
            btn.textContent = 'Request Whitelist';
          }
        });
      });
    });
  }

  // --- Add MT5 Account ---
  function setupAddMT5() {
    var addBtn = document.getElementById('addMT5Btn');
    var form = document.getElementById('addMT5Form');
    var input = document.getElementById('newMT5Input');
    var saveBtn = document.getElementById('saveMT5Btn');
    var errorEl = document.getElementById('addMT5Error');

    addBtn.addEventListener('click', function() {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      if (form.style.display === 'block') input.focus();
    });

    saveBtn.addEventListener('click', function() {
      var num = input.value.trim();
      if (!num) {
        errorEl.textContent = 'Account number is required.';
        errorEl.style.display = 'block';
        return;
      }
      errorEl.style.display = 'none';
      saveBtn.disabled = true;
      saveBtn.textContent = 'Adding...';
      apiCall('POST', '/user/add-mt5', { account_number: num }).then(function(result) {
        if (result.ok) {
          input.value = '';
          form.style.display = 'none';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Add';
          showToast('MT5 account added.', 'success');
          refreshDashboard();
        } else {
          errorEl.textContent = result.data.error || 'Failed to add.';
          errorEl.style.display = 'block';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Add';
        }
      });
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
    });
  }

  // --- Profile ---
  function renderProfile(user) {
    var html = '';
    html += '<div class="profile-field"><span class="profile-label">Name</span><span class="profile-value">' + escapeHtml(user.name) + '</span></div>';
    html += '<div class="profile-field"><span class="profile-label">Email</span><span class="profile-value">' + escapeHtml(user.email) + '</span></div>';
    document.getElementById('profileContent').innerHTML = html;
    document.getElementById('dashboardGreeting').textContent = 'Welcome, ' + user.name.split(' ')[0];
  }

  // --- Refresh ---
  function refreshDashboard() {
    apiCall('GET', '/auth/me').then(function(result) {
      if (!result.ok || result.status === 401) {
        localStorage.removeItem('mamba_token');
        localStorage.removeItem('mamba_user');
        window.location.href = '/login.html' + (window.MAMBA_DEMO ? '?demo' : '');
        return;
      }
      setUser(result.data.user);
      renderOnboarding(result.data.user);
      renderIBBanner(result.data.user);
      renderMT5Accounts(result.data.user.mt5_accounts);
      renderProfile(result.data.user);
      hideLoadingScreen();
    }).catch(function() {
      var cached = getUser();
      if (cached) {
        renderOnboarding(cached);
        renderIBBanner(cached);
        renderMT5Accounts(cached.mt5_accounts || []);
        renderProfile(cached);
      }
      hideLoadingScreen();
    });
  }

  // --- Edit Profile ---
  function setupEditModal() {
    var modal = document.getElementById('editModal');
    var form = document.getElementById('editForm');
    var openBtn = document.getElementById('editProfileBtn');
    var cancelBtn = document.getElementById('cancelEdit');

    openBtn.addEventListener('click', function() {
      var user = getUser();
      form.querySelector('[name="name"]').value = user.name || '';
      modal.classList.add('active');
    });

    cancelBtn.addEventListener('click', function() { modal.classList.remove('active'); });
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.classList.remove('active'); });

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var name = form.querySelector('[name="name"]').value.trim();
      if (!name) {
        var errEl = form.querySelector('.form-error');
        errEl.textContent = 'Name is required.';
        errEl.style.display = 'block';
        return;
      }
      apiCall('PUT', '/user/update', { name: name }).then(function(result) {
        if (result.ok) {
          showToast('Profile updated.', 'success');
          modal.classList.remove('active');
          refreshDashboard();
        } else {
          var errEl = form.querySelector('.form-error');
          errEl.textContent = result.data.error || 'Update failed.';
          errEl.style.display = 'block';
        }
      });
    });
  }

  function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', function() {
      apiCall('POST', '/auth/logout').then(function() {
        localStorage.removeItem('mamba_token');
        localStorage.removeItem('mamba_user');
        window.location.href = '/login.html' + (window.MAMBA_DEMO ? '?demo' : '');
      });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
    if (!token) {
      window.location.href = '/login.html' + (window.MAMBA_DEMO ? '?demo' : '');
      return;
    }
    setupLogout();
    setupEditModal();
    setupIBModal();
    setupAddMT5();
    refreshDashboard();
  });
})();
