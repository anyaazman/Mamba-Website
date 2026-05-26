(function() {
  'use strict';

  var API_BASE = '/api';
  var adminKey = sessionStorage.getItem('mamba_admin_key');
  var allUsers = [];
  var currentFilter = '';

  function hideLoadingScreen() {
    var ls = document.querySelector('.loading-screen');
    if (ls) { ls.classList.add('loaded'); document.body.classList.add('page-loaded'); }
    setTimeout(function() { if (ls && ls.parentNode) ls.remove(); }, 800);
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

  function showKeyScreen() {
    document.getElementById('keyScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
  }

  function showAdminPanel() {
    document.getElementById('keyScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
  }

  function verifyKey(key) {
    return fetch(API_BASE + '/admin/status', { headers: { 'X-Admin-Key': key } })
      .then(function(res) { return res.json(); })
      .then(function(data) { return data.valid; })
      .catch(function() { return false; });
  }

  function setupKeyForm() {
    var form = document.getElementById('keyForm');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var key = form.querySelector('[name="admin_key"]').value.trim();
      if (!key) return;
      verifyKey(key).then(function(valid) {
        if (valid) {
          adminKey = key;
          sessionStorage.setItem('mamba_admin_key', key);
          showAdminPanel();
          loadUsers('');
        } else {
          var err = form.querySelector('.key-error');
          err.textContent = 'Invalid admin key.';
          err.style.display = 'block';
        }
      });
    });
  }

  function setupFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        loadUsers(tab.getAttribute('data-status') || '');
      });
    });
  }

  function loadUsers(statusFilter) {
    currentFilter = statusFilter || '';
    var container = document.getElementById('usersContainer');
    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading...</p>';

    var url = API_BASE + '/admin/users';
    if (statusFilter) url += '?status=' + statusFilter;

    fetch(url, { headers: { 'X-Admin-Key': adminKey } })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        allUsers = data.users;
        applyFilters();
      })
      .catch(function() {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load users.</p>';
      });
  }

  function applyFilters() {
    var query = document.getElementById('adminSearch').value.toLowerCase().trim();
    var filtered = allUsers;

    // Search filter
    if (query) {
      filtered = filtered.filter(function(user) {
        if (user.name.toLowerCase().indexOf(query) !== -1) return true;
        if (user.email.toLowerCase().indexOf(query) !== -1) return true;
        if ((user.ib_email || '').toLowerCase().indexOf(query) !== -1) return true;
        var accounts = user.mt5_accounts || [];
        for (var i = 0; i < accounts.length; i++) {
          if (accounts[i].account_number.indexOf(query) !== -1) return true;
        }
        return false;
      });
    }

    renderUsers(filtered);
  }

  function renderUsers(users) {
    var container = document.getElementById('usersContainer');

    if (!users || users.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">No users found.</p>';
      return;
    }

    var html = '';
    users.forEach(function(user) {
      html += '<div class="user-card">';
      html += '<div class="user-card-header">';
      html += '<div class="user-card-info">';
      html += '<span class="user-name">' + esc(user.name) + '</span>';
      html += '<span class="user-email">' + esc(user.email) + '</span>';
      html += user.ib_email ? '<span class="user-ib-email">Valetax: ' + esc(user.ib_email) + '</span>' : '';
      html += '</div>';
      html += '<div style="display: flex; align-items: center; gap: 0.5rem;">';
      html += '<span class="status-badge status-' + user.ib_status + '">IB: ' + user.ib_status.toUpperCase() + '</span>';
      html += user.ib_status !== 'approved' ? '<button class="btn-approve" data-user-id="' + user.id + '" data-type="ib">Approve IB</button>' : '';
      html += user.ib_status !== 'rejected' ? '<button class="btn-reject" data-user-id="' + user.id + '" data-type="ib">Reject IB</button>' : '';
      html += '<button class="btn-reset-pw" data-user-id="' + user.id + '" data-name="' + escAttr(user.name) + '">Reset PW</button>';
      html += '</div>';
      html += '</div>';

      // MT5 accounts
      var accounts = user.mt5_accounts || [];
      html += '<div class="user-mt5-section">';
      html += '<span class="user-mt5-label">MT5 Accounts:</span>';
      if (accounts.length === 0) {
        html += '<span style="color: var(--text-muted); font-size: 0.8rem;">None</span>';
      } else {
        html += '<table class="mt5-inline-table"><thead><tr><th>Account</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        accounts.forEach(function(acc) {
          html += '<tr>';
          html += '<td><code>' + esc(acc.account_number) + '</code></td>';
          html += '<td><span class="status-badge status-' + acc.status + '">' + acc.status.toUpperCase() + '</span></td>';
          html += '<td class="action-cell">';
          html += acc.status !== 'approved' ? '<button class="btn-approve" data-account-id="' + acc.id + '" data-type="whitelist">Approve</button>' : '';
          html += acc.status !== 'rejected' ? '<button class="btn-reject" data-account-id="' + acc.id + '" data-type="whitelist">Reject</button>' : '';
          html += '</td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';
      html += '</div>';
    });

    container.innerHTML = html;
    bindActions();
  }

  function bindActions() {
    // IB approve/reject (user-level)
    document.querySelectorAll('.btn-approve[data-type="ib"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        updateIBStatus(btn.getAttribute('data-user-id'), 'approved');
      });
    });
    document.querySelectorAll('.btn-reject[data-type="ib"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        updateIBStatus(btn.getAttribute('data-user-id'), 'rejected');
      });
    });

    // Whitelist approve/reject (account-level)
    document.querySelectorAll('.btn-approve[data-type="whitelist"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        updateWhitelistStatus(btn.getAttribute('data-account-id'), 'approved');
      });
    });
    document.querySelectorAll('.btn-reject[data-type="whitelist"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        updateWhitelistStatus(btn.getAttribute('data-account-id'), 'rejected');
      });
    });

    // Reset password
    document.querySelectorAll('.btn-reset-pw').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var userId = btn.getAttribute('data-user-id');
        var userName = btn.getAttribute('data-name');
        var newPw = prompt('Enter new password for ' + userName + ' (min 6 chars):');
        if (!newPw) return;
        if (newPw.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
        fetch(API_BASE + '/admin/reset-user-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ user_id: parseInt(userId), new_password: newPw })
        }).then(function(res) { return res.json(); })
        .then(function(data) {
          showToast(data.success ? 'Password reset for ' + userName + '.' : (data.error || 'Reset failed.'), data.success ? 'success' : 'error');
        });
      });
    });
  }

  function updateWhitelistStatus(accountId, status) {
    fetch(API_BASE + '/admin/whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify({ account_id: parseInt(accountId), status: status })
    }).then(function(res) { return res.json(); })
    .then(function(data) {
      showToast(data.success ? 'MT5 account ' + status + '.' : (data.error || 'Action failed.'), data.success ? 'success' : 'error');
      if (data.success) {
        var activeTab = document.querySelector('.filter-tab.active');
        loadUsers(activeTab ? activeTab.getAttribute('data-status') || '' : '');
      }
    });
  }

  function updateIBStatus(userId, status) {
    fetch(API_BASE + '/admin/ib', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify({ user_id: parseInt(userId), status: status })
    }).then(function(res) { return res.json(); })
    .then(function(data) {
      showToast(data.success ? 'IB ' + status + '.' : (data.error || 'Action failed.'), data.success ? 'success' : 'error');
      if (data.success) {
        var activeTab = document.querySelector('.filter-tab.active');
        loadUsers(activeTab ? activeTab.getAttribute('data-status') || '' : '');
      }
    });
  }

  function setupLogout() {
    document.getElementById('adminLogoutBtn').addEventListener('click', function() {
      sessionStorage.removeItem('mamba_admin_key');
      window.location.href = '/index.html';
    });
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setupSearch() {
    var searchInput = document.getElementById('adminSearch');
    var debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 150);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    setupKeyForm();
    setupFilterTabs();
    setupSearch();
    setupLogout();

    if (adminKey) {
      verifyKey(adminKey).then(function(valid) {
        if (valid) { showAdminPanel(); loadUsers(''); }
        else { sessionStorage.removeItem('mamba_admin_key'); showKeyScreen(); }
        hideLoadingScreen();
      });
    } else {
      showKeyScreen();
      hideLoadingScreen();
    }
  });
})();
