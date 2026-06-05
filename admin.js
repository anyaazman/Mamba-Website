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
    document.querySelectorAll('#userFilterTabs .filter-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('#userFilterTabs .filter-tab').forEach(function(t) { t.classList.remove('active'); });
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
    var scrollY = window.scrollY;

    if (!users || users.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">No users found.</p>';
      window.scrollTo(0, scrollY);
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
      html += user.ib_type ? '<span class="user-ib-email">Selection: ' + esc(user.ib_type === 'new' ? 'New Account (No Valetax yet)' : 'Already Has Valetax') + '</span>' : '';
      html += '</div>';
      html += '<div style="display: flex; align-items: center; gap: 0.5rem;">';
      html += '<span class="status-badge status-' + user.ib_status + '">IB: ' + user.ib_status.toUpperCase() + '</span>';
      html += user.ib_status !== 'approved' ? '<button class="btn-approve" data-user-id="' + user.id + '" data-type="ib">Approve IB</button>' : '';
      html += user.ib_status !== 'rejected' ? '<button class="btn-reject" data-user-id="' + user.id + '" data-type="ib">Reject IB</button>' : '';
      html += '<button class="btn-reset-pw" data-user-id="' + user.id + '" data-name="' + escAttr(user.name) + '">Reset PW</button>';
      html += '<button class="btn-delete" data-user-id="' + user.id + '" data-name="' + escAttr(user.name) + '">Delete</button>';
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
    window.scrollTo(0, scrollY);
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

    // Delete user
    document.querySelectorAll('.btn-delete').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var userId = btn.getAttribute('data-user-id');
        var userName = btn.getAttribute('data-name');
        if (!confirm('Are you sure you want to delete ' + userName + '? This cannot be undone.')) return;
        fetch(API_BASE + '/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ user_id: parseInt(userId) })
        }).then(function(res) { return res.json(); })
        .then(function(data) {
          showToast(data.success ? 'User deleted.' : (data.error || 'Delete failed.'), data.success ? 'success' : 'error');
          if (data.success) {
            var activeTab = document.querySelector('#userFilterTabs .filter-tab.active');
            loadUsers(activeTab ? activeTab.getAttribute('data-status') || '' : '');
          }
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
        var activeTab = document.querySelector('#userFilterTabs .filter-tab.active');
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
        var activeTab = document.querySelector('#userFilterTabs .filter-tab.active');
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

  // --- Events View ---
  var currentEventType = '';
  var currentDateRange = '';

  function setupViewTabs() {
    document.querySelectorAll('#viewTabs .filter-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('#viewTabs .filter-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var view = tab.getAttribute('data-view');
        if (view === 'users') {
          document.getElementById('usersView').style.display = 'block';
          document.getElementById('eventsView').style.display = 'none';
        } else {
          document.getElementById('usersView').style.display = 'none';
          document.getElementById('eventsView').style.display = 'block';
          loadEvents();
        }
      });
    });
  }

  function setupDateFilterTabs() {
    document.querySelectorAll('#dateFilterTabs .filter-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('#dateFilterTabs .filter-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        currentDateRange = tab.getAttribute('data-range') || '';

        var customDiv = document.getElementById('customDateRange');
        if (currentDateRange === 'custom') {
          customDiv.style.display = 'flex';
          return; // wait for user to click Apply
        } else {
          customDiv.style.display = 'none';
        }
        applyEventFilters();
      });
    });

    document.getElementById('customDateApply').addEventListener('click', function() {
      applyEventFilters();
    });
  }

  function setupEventFilterTabs() {
    document.querySelectorAll('#eventFilterTabs .filter-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('#eventFilterTabs .filter-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        currentEventType = tab.getAttribute('data-type') || '';
        applyEventFilters();
      });
    });
  }

  function getDateRangeParams() {
    if (!currentDateRange) return { from: null, to: null };

    var now = new Date();
    var from, to;

    if (currentDateRange === 'today') {
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      to = now.toISOString();
    } else if (currentDateRange === 'yesterday') {
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0)).toISOString();
      to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999)).toISOString();
    } else if (currentDateRange === '7d') {
      var d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 7);
      d.setUTCHours(0, 0, 0, 0);
      from = d.toISOString();
      to = now.toISOString();
    } else if (currentDateRange === 'month') {
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      to = now.toISOString();
    } else if (currentDateRange === 'custom') {
      var fromVal = document.getElementById('customDateFrom').value;
      var toVal = document.getElementById('customDateTo').value;
      if (fromVal) from = new Date(fromVal + 'T00:00:00.000Z').toISOString();
      if (toVal) to = new Date(toVal + 'T23:59:59.999Z').toISOString();
    }

    return { from: from || null, to: to || null };
  }

  function applyEventFilters() {
    var dateParams = getDateRangeParams();
    loadEvents(currentEventType, dateParams.from, dateParams.to);
  }

  function loadEvents(typeFilter, fromDate, toDate) {
    var container = document.getElementById('eventsContainer');
    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading events...</p>';

    var url = API_BASE + '/admin/events?limit=200';
    if (typeFilter) url += '&type=' + typeFilter;
    if (fromDate) url += '&from=' + encodeURIComponent(fromDate);
    if (toDate) url += '&to=' + encodeURIComponent(toDate);

    fetch(url, { headers: { 'X-Admin-Key': adminKey } })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        renderEvents(data.events);
      })
      .catch(function() {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load events.</p>';
      });
  }

  function renderEvents(events) {
    var container = document.getElementById('eventsContainer');
    var scrollY = window.scrollY;

    if (!events || events.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">No events found.</p>';
      window.scrollTo(0, scrollY);
      return;
    }

    var html = '<div class="user-card" style="overflow-x: auto;">';
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">';
    html += '<thead><tr style="border-bottom: 1px solid var(--border-color);">';
    html += '<th style="padding: 0.6rem; text-align: left;">Time</th>';
    html += '<th style="padding: 0.6rem; text-align: left;">Type</th>';
    html += '<th style="padding: 0.6rem; text-align: left;">Page</th>';
    html += '<th style="padding: 0.6rem; text-align: left;">User</th>';
    html += '<th style="padding: 0.6rem; text-align: left;">Referrer</th>';
    html += '</tr></thead><tbody>';

    events.forEach(function(evt) {
      var time = new Date(evt.created_at + 'Z').toLocaleString();
      var userDisplay = evt.user_name ? esc(evt.user_name) : (evt.user_id ? 'User #' + evt.user_id : '<em style="color: var(--text-muted);">anonymous</em>');

      html += '<tr style="border-bottom: 1px solid var(--border-color);">';
      html += '<td style="padding: 0.5rem 0.6rem; white-space: nowrap;">' + esc(time) + '</td>';
      html += '<td style="padding: 0.5rem 0.6rem;"><span class="status-badge" style="font-size: 0.65rem;">' + esc(evt.type.replace(/_/g, ' ').toUpperCase()) + '</span></td>';
      html += '<td style="padding: 0.5rem 0.6rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + escAttr(evt.page) + '">' + esc(evt.page || '-') + '</td>';
      html += '<td style="padding: 0.5rem 0.6rem; white-space: nowrap;">' + userDisplay + '</td>';
      html += '<td style="padding: 0.5rem 0.6rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + escAttr(evt.referrer || '') + '">' + esc((evt.referrer || '-')) + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
    window.scrollTo(0, scrollY);
  }

  document.addEventListener('DOMContentLoaded', function() {
    setupKeyForm();
    setupFilterTabs();
    setupSearch();
    setupLogout();
    setupViewTabs();
    setupDateFilterTabs();
    setupEventFilterTabs();

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
