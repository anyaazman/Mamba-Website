(function() {
  'use strict';

  var API_BASE = '/api';
  // sessionStorage throws where site data is blocked; without this the whole
  // admin panel script dies before rendering anything.
  function safeSession(action, key, value) {
    try {
      if (action === 'get') return sessionStorage.getItem(key);
      if (action === 'set') { sessionStorage.setItem(key, value); return true; }
      if (action === 'remove') { sessionStorage.removeItem(key); return true; }
    } catch (e) {
      return action === 'get' ? null : false;
    }
  }

  var adminKey = safeSession('get', 'mamba_admin_key');
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
          safeSession('set', 'mamba_admin_key', key);
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
      .then(function(res) {
        return res.text().then(function(text) {
          var body;
          try { body = JSON.parse(text); } catch (e) { body = null; }
          return { ok: res.ok, status: res.status, body: body, raw: text };
        });
      })
      .then(function(r) {
        if (!r.ok || !r.body || !r.body.users) {
          var msg = (r.body && r.body.error) ? r.body.error
                    : (r.raw ? r.raw.slice(0, 300) : ('HTTP ' + r.status));
          container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load users (HTTP ' + r.status + '): ' + esc(msg) + '</p>';
          return;
        }
        allUsers = r.body.users;
        applyFilters();
      })
      .catch(function(err) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load users: ' + esc(err && err.message ? err.message : 'network error') + '</p>';
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
        var newPw = prompt('Enter new password for ' + userName + ' (min 8 chars):');
        if (!newPw) return;
        if (newPw.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
        fetch(API_BASE + '/admin/reset-user-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ user_id: parseInt(userId), new_password: newPw })
        }).then(function(res) { return res.json(); })
        .then(function(data) {
          showToast(data.success ? 'Password reset for ' + userName + '.' : (data.error || 'Reset failed.'), data.success ? 'success' : 'error');
        }).catch(function() {
          showToast('Network error. Please try again.', 'error');
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
        }).catch(function() {
          showToast('Network error. Please try again.', 'error');
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
    }).catch(function() {
      showToast('Network error. Please try again.', 'error');
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
    }).catch(function() {
      showToast('Network error. Please try again.', 'error');
    });
  }

  function setupLogout() {
    document.getElementById('adminLogoutBtn').addEventListener('click', function() {
      safeSession('remove', 'mamba_admin_key');
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
        document.getElementById('usersView').style.display = view === 'users' ? 'block' : 'none';
        document.getElementById('eventsView').style.display = view === 'events' ? 'block' : 'none';
        document.getElementById('valetaxView').style.display = view === 'valetax' ? 'block' : 'none';
        if (view === 'events') loadEvents();
        if (view === 'valetax') loadValetaxStatus();
      });
    });
  }

  // --- Valetax View (snapshot import + reconciliation) ---
  //
  // The Worker never contacts Valetax. The operator pulls the downline with
  // tools/valetax-sync (real browser, human-solved CAPTCHA) and uploads the
  // resulting JSON here; everything below is import + report.
  var valetaxReport = null;
  var valetaxBucket = 'claimedNotInValetax';

  var VALETAX_BUCKETS = [
    { key: 'claimedNotInValetax', label: 'Not under our code',
      blurb: 'Requested IB verification, but Valetax shows no client with that email under our partner code.',
      cols: ['Name', 'Mamba email', 'Valetax email given', 'IB status'],
      row: function(r) { return [r.name, r.email, r.ib_email, r.ib_status]; } },
    { key: 'accountsNotInValetax', label: 'MT5 not in downline',
      blurb: 'MT5 accounts on Mamba that do not appear under our code at Valetax.',
      cols: ['Account', 'Status', 'Name', 'Email'],
      row: function(r) { return [r.account_number, r.status, r.name, r.email]; } },
    { key: 'inValetaxNotOnMamba', label: 'No Mamba account',
      blurb: 'Under our partner code at Valetax, but never registered on Mamba.',
      cols: ['Valetax email', 'Name', 'Registered', 'Sub-IB'],
      row: function(r) { return [r.email, r.name, r.registered_at, r.has_children ? 'yes' : '']; } },
    { key: 'matched', label: 'Matched',
      blurb: 'Mamba users confirmed present under our partner code.',
      cols: ['Name', 'Mamba email', 'Valetax email', 'IB status'],
      row: function(r) { return [r.name, r.email, r.ib_email, r.ib_status]; } }
  ];

  function loadValetaxStatus() {
    var line = document.getElementById('valetaxStatusLine');
    line.textContent = 'Checking for an imported snapshot…';
    fetch(API_BASE + '/admin/valetax/status', { headers: { 'X-Admin-Key': adminKey } })
      .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
      .then(function(r) {
        if (!r.ok) { line.textContent = r.data.error || 'Could not check status.'; return; }
        var d = r.data;
        if (!d.hasSnapshot) {
          line.innerHTML = '<span class="valetax-dot muted">○</span> No snapshot imported yet.';
          return;
        }
        // Anything older than a week is stale enough that acting on it could
        // mean chasing a client who has since moved.
        var stale = d.ageHours !== null && d.ageHours > 168;
        line.innerHTML = '<span class="valetax-dot ' + (stale ? 'warn' : 'ok') + '">●</span> ' +
          esc(String(d.clientCount)) + ' clients, pulled ' +
          (d.ageHours === null ? 'at an unknown time' : describeAge(d.ageHours)) +
          (stale ? ' — consider re-pulling' : '');
        loadValetaxReport();
      })
      .catch(function() { line.textContent = 'Could not check status.'; });
  }

  function describeAge(hours) {
    if (hours < 1) return 'less than an hour ago';
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  function loadValetaxReport() {
    fetch(API_BASE + '/admin/valetax/reconcile', { headers: { 'X-Admin-Key': adminKey } })
      .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
      .then(function(r) {
        if (!r.ok || !r.data.hasSnapshot) return;
        valetaxReport = r.data;
        renderValetaxReport();
      })
      .catch(function() { /* status line already carries the failure */ });
  }

  function renderValetaxReport() {
    var wrap = document.getElementById('valetaxReport');
    if (!valetaxReport) { wrap.hidden = true; return; }
    wrap.hidden = false;

    var c = valetaxReport.counts;
    var summary = VALETAX_BUCKETS.map(function(b) {
      return '<div class="valetax-stat' + (c[b.key] ? '' : ' is-zero') + '">' +
             '<span class="valetax-stat-n">' + esc(String(c[b.key])) + '</span>' +
             '<span class="valetax-stat-l">' + esc(b.label) + '</span></div>';
    }).join('');
    document.getElementById('valetaxSummary').innerHTML = summary;

    document.getElementById('valetaxBucketTabs').innerHTML = VALETAX_BUCKETS.map(function(b) {
      return '<button class="filter-tab' + (b.key === valetaxBucket ? ' active' : '') +
             '" data-bucket="' + b.key + '">' + esc(b.label) + ' (' + esc(String(c[b.key])) + ')</button>';
    }).join('');

    document.querySelectorAll('#valetaxBucketTabs .filter-tab').forEach(function(t) {
      t.addEventListener('click', function() {
        valetaxBucket = t.getAttribute('data-bucket');
        renderValetaxReport();
      });
    });

    var bucket = VALETAX_BUCKETS.filter(function(b) { return b.key === valetaxBucket; })[0];
    var rows = valetaxReport[bucket.key] || [];
    var html = '<p class="valetax-blurb">' + esc(bucket.blurb) + '</p>';

    if (!rows.length) {
      html += '<p class="valetax-empty">Nothing in this bucket.</p>';
    } else {
      html += '<div class="valetax-table-wrap"><table class="valetax-table"><thead><tr>' +
              bucket.cols.map(function(h) { return '<th>' + esc(h) + '</th>'; }).join('') +
              '</tr></thead><tbody>' +
              rows.map(function(r) {
                return '<tr>' + bucket.row(r).map(function(cell) {
                  return '<td>' + esc(cell === null || cell === undefined ? '' : String(cell)) + '</td>';
                }).join('') + '</tr>';
              }).join('') + '</tbody></table></div>';
    }

    // The POC pulls level 1 only, so any sub-IB hides its own downline and
    // every count above understates the real book.
    if (c.subIbsNotRecursed) {
      html += '<p class="valetax-caveat">' + esc(String(c.subIbsNotRecursed)) +
              ' client(s) are sub-IBs with their own downline, which this snapshot does not include. ' +
              'Counts above understate the full book.</p>';
    }

    document.getElementById('valetaxBucketBody').innerHTML = html;
  }

  function importValetaxSnapshot() {
    var input = document.getElementById('valetaxFile');
    var note = document.getElementById('valetaxImportNote');
    var btn = document.getElementById('valetaxImportBtn');
    var file = input.files && input.files[0];
    if (!file) { showToast('Choose a snapshot file first.', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Importing…';
    note.hidden = true;

    var reader = new FileReader();
    reader.onerror = function() {
      btn.disabled = false; btn.textContent = 'Import snapshot';
      showToast('Could not read that file.', 'error');
    };
    reader.onload = function() {
      var payload;
      try { payload = JSON.parse(reader.result); }
      catch (e) {
        btn.disabled = false; btn.textContent = 'Import snapshot';
        note.hidden = false; note.className = 'valetax-note is-error';
        note.textContent = 'That file is not valid JSON.';
        return;
      }

      fetch(API_BASE + '/admin/valetax/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify(payload)
      })
        .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
        .then(function(r) {
          btn.disabled = false; btn.textContent = 'Import snapshot';
          note.hidden = false;
          if (!r.ok) {
            note.className = 'valetax-note is-error';
            note.textContent = r.data.error || 'Import failed.';
            return;
          }
          note.className = 'valetax-note is-ok';
          note.textContent = 'Imported ' + r.data.clientsImported + ' clients and ' +
                             r.data.mt5AccountsImported + ' MT5 accounts.';
          showToast('Snapshot imported.', 'success');
          input.value = '';
          btn.disabled = true;
          loadValetaxStatus();
        })
        .catch(function(e) {
          btn.disabled = false; btn.textContent = 'Import snapshot';
          note.hidden = false; note.className = 'valetax-note is-error';
          note.textContent = 'Network error: ' + e.message;
        });
    };
    reader.readAsText(file);
  }

  function setupValetaxView() {
    var file = document.getElementById('valetaxFile');
    var btn = document.getElementById('valetaxImportBtn');
    if (!file || !btn) return;
    // Only enable the button once a file is actually chosen, so the common
    // mistake of clicking Import with nothing selected cannot happen.
    file.addEventListener('change', function() {
      btn.disabled = !(file.files && file.files.length);
    });
    btn.addEventListener('click', importValetaxSnapshot);
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
      .then(function(res) {
        return res.text().then(function(text) {
          var body;
          try { body = JSON.parse(text); } catch (e) { body = null; }
          return { ok: res.ok, status: res.status, body: body, raw: text };
        });
      })
      .then(function(r) {
        if (!r.ok || !r.body || !r.body.events) {
          var msg = (r.body && r.body.error) ? r.body.error
                    : (r.raw ? r.raw.slice(0, 300) : ('HTTP ' + r.status));
          container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load events (HTTP ' + r.status + '): ' + esc(msg) + '</p>';
          return;
        }
        renderEvents(r.body.events);
      })
      .catch(function(err) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load events: ' + esc(err && err.message ? err.message : 'network error') + '</p>';
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
      // SQLite returns "YYYY-MM-DD HH:MM:SS" (UTC); Safari can't parse the
      // space-separated form, so normalize to ISO 8601 first
      var iso = evt.created_at.indexOf('T') === -1
        ? evt.created_at.replace(' ', 'T') + 'Z'
        : evt.created_at;
      var time = new Date(iso).toLocaleString();
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
    setupValetaxView();

    if (adminKey) {
      verifyKey(adminKey).then(function(valid) {
        if (valid) { showAdminPanel(); loadUsers(''); }
        else { safeSession('remove', 'mamba_admin_key'); showKeyScreen(); }
        hideLoadingScreen();
      });
    } else {
      showKeyScreen();
      hideLoadingScreen();
    }
  });
})();
