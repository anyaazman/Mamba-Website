// demo.js — Sandbox mode. Add ?demo to any portal URL.
(function() {
  if (!window.location.search.includes('demo')) return;

  window.MAMBA_DEMO = true;
  var originalFetch = window.fetch;
  var DEMO_DB_KEY = 'mamba_demo_v2';

  function getDb() {
    try { return JSON.parse(localStorage.getItem(DEMO_DB_KEY)) || { users: [], mt5_accounts: [], tokens: [], events: [] }; }
    catch(e) { return { users: [], mt5_accounts: [], tokens: [], events: [] }; }
  }
  function saveDb(db) { localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db)); }

  function cloneUser(u) {
    var accs = getDb().mt5_accounts.filter(function(a) { return a.user_id === u.id; });
    return { id: u.id, name: u.name, email: u.email, ib_status: u.ib_status, ib_email: u.ib_email || '', created_at: u.created_at, mt5_accounts: accs.map(function(a) { return { id: a.id, account_number: a.account_number, status: a.status, created_at: a.created_at }; }) };
  }

  window.fetch = function(url, options) {
    var urlStr = typeof url === 'string' ? url : url.url;
    if (!urlStr || !urlStr.includes('/api/')) return originalFetch.apply(this, arguments);

    var method = (options && options.method) || 'GET';
    var headers = options && options.headers ? options.headers : {};
    var body = options && options.body ? JSON.parse(options.body) : null;
    var db = getDb();

    return new Promise(function(resolve) {
      var json, status = 200;

      function getAuthUser() {
        var h = headers['Authorization'] || headers['authorization'] || '';
        var tok = h.startsWith('Bearer ') ? h.slice(7) : '';
        var t = db.tokens.find(function(tk) { return tk.token === tok; });
        if (!t) return null;
        return db.users.find(function(u) { return u.id === t.user_id; }) || null;
      }

      function isAdmin() {
        var k = headers['X-Admin-Key'] || headers['x-admin-key'] || '';
        return k === 'demo-admin';
      }

      function addDemoEvent(type, userId, meta) {
        if (!db.events) db.events = [];
        db.events.push({
          id: Date.now(),
          type: type,
          page: '',
          referrer: '',
          title: '',
          user_id: userId || null,
          metadata: meta ? JSON.stringify(meta) : '{}',
          created_at: new Date().toISOString()
        });
      }

      try {
        // --- AUTH ---
        if (method === 'POST' && urlStr.includes('/api/auth/register')) {
          if (db.users.some(function(u) { return u.email === body.email; })) {
            json = { error: 'Email already registered.' }; status = 409;
          } else {
            var nu = { id: Date.now(), name: body.name, email: body.email, password: body.password, recovery_phrase: body.recovery_phrase, ib_status: 'pending', ib_email: '', created_at: new Date().toISOString() };
            db.users.push(nu);
            var tok = 'demo-token-' + Date.now();
            db.tokens.push({ user_id: nu.id, token: tok, expires_at: new Date(Date.now() + 7*86400000).toISOString() });
            addDemoEvent('register', nu.id);
            console.log('[DEMO NOTIFY] 🆕 New Registration | Name: ' + body.name + ' | Email: ' + body.email);
            saveDb(db);
            json = { token: tok, user: { id: nu.id, name: nu.name, email: nu.email, ib_status: 'pending', mt5_accounts: [] } }; status = 201;
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/auth/login')) {
          var u = db.users.find(function(u) { return u.email === body.email && u.password === body.password; });
          if (!u) { json = { error: 'Invalid email or password.' }; status = 401; }
          else {
            var tok2 = 'demo-token-' + Date.now();
            db.tokens.push({ user_id: u.id, token: tok2, expires_at: new Date(Date.now() + 7*86400000).toISOString() });
            addDemoEvent('login', u.id);
            saveDb(db);
            json = { token: tok2, user: cloneUser(u) };
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/auth/logout')) {
          var h1 = headers['Authorization'] || headers['authorization'] || '';
          if (h1.startsWith('Bearer ')) { db.tokens = db.tokens.filter(function(t) { return t.token !== h1.slice(7); }); saveDb(db); }
          json = { success: true };
        }
        else if (method === 'GET' && urlStr.includes('/api/auth/me')) {
          var au = getAuthUser();
          if (!au) { json = { error: 'Not authenticated.' }; status = 401; }
          else { json = { user: cloneUser(au) }; }
        }
        else if (method === 'POST' && urlStr.includes('/api/auth/reset-password')) {
          var ru = db.users.find(function(u) { return u.email === body.email && u.recovery_phrase === body.recovery_phrase; });
          if (!ru) { json = { error: 'Invalid email or recovery phrase.' }; status = 401; }
          else { ru.password = body.new_password; db.tokens = db.tokens.filter(function(t) { return t.user_id !== ru.id; }); addDemoEvent('password_reset', ru.id); saveDb(db); json = { success: true, message: 'Password has been reset.' }; }
        }

        // --- USER ---
        else if (method === 'PUT' && urlStr.includes('/api/user/update')) {
          var au2 = getAuthUser();
          if (!au2) { json = { error: 'Not authenticated.' }; status = 401; }
          else { if (body.name) au2.name = body.name; saveDb(db); json = { success: true, message: 'Profile updated.' }; }
        }
        else if (method === 'GET' && urlStr.includes('/api/user/mt5-accounts')) {
          var au3 = getAuthUser();
          if (!au3) { json = { error: 'Not authenticated.' }; status = 401; }
          else {
            var accs = db.mt5_accounts.filter(function(a) { return a.user_id === au3.id; }).map(function(a) { return { id: a.id, account_number: a.account_number, status: a.status, created_at: a.created_at }; });
            json = { accounts: accs };
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/user/add-mt5')) {
          var au4 = getAuthUser();
          if (!au4) { json = { error: 'Not authenticated.' }; status = 401; }
          else if (db.mt5_accounts.some(function(a) { return a.user_id === au4.id && a.account_number === body.account_number; })) {
            json = { error: 'This MT5 account is already added.' }; status = 409;
          } else {
            var na = { id: Date.now(), user_id: au4.id, account_number: body.account_number, status: 'pending', created_at: new Date().toISOString() };
            db.mt5_accounts.push(na); addDemoEvent('mt5_added', au4.id, { account_number: body.account_number }); console.log('[DEMO NOTIFY] 💳 MT5 Account Added | Name: ' + au4.name + ' | Email: ' + au4.email + ' | Account: ' + body.account_number); saveDb(db);
            json = { success: true, account: { id: na.id, account_number: na.account_number, status: 'pending' } }; status = 201;
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/user/request-whitelist')) {
          var au5 = getAuthUser();
          if (!au5) { json = { error: 'Not authenticated.' }; status = 401; }
          else {
            var acc = db.mt5_accounts.find(function(a) { return a.id === body.account_id && a.user_id === au5.id; });
            if (!acc) { json = { error: 'MT5 account not found.' }; status = 404; }
            else if (acc.status === 'approved') { json = { error: 'Already approved.' }; status = 400; }
            else { acc.status = 'pending'; addDemoEvent('whitelist_request', au5.id, { account_id: body.account_id }); console.log('[DEMO NOTIFY] 📊 MT5 Whitelist Request | Name: ' + au5.name + ' | Email: ' + au5.email + ' | Account ID: ' + body.account_id); saveDb(db); json = { success: true, message: 'Whitelist request submitted.' }; }
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/user/request-ib')) {
          var au6 = getAuthUser();
          if (!au6) { json = { error: 'Not authenticated.' }; status = 401; }
          else if (!body.ib_email || !body.ib_email.trim()) { json = { error: 'Valetax email is required.' }; status = 400; }
          else { au6.ib_status = 'pending'; au6.ib_email = body.ib_email.trim(); addDemoEvent('ib_request', au6.id); console.log('[DEMO NOTIFY] 🔐 IB Verification Request | Name: ' + au6.name + ' | Email: ' + au6.email + ' | Valetax Email: ' + body.ib_email.trim()); saveDb(db); json = { success: true, message: 'IB verification request submitted.' }; }
        }

        // --- ADMIN ---
        else if (method === 'GET' && urlStr.includes('/api/admin/status')) {
          json = { valid: isAdmin() };
        }
        else if (method === 'GET' && urlStr.includes('/api/admin/users')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else {
            var filter = new URL(urlStr, 'http://localhost').searchParams.get('status');
            var users = db.users.map(function(u) {
              var accs = db.mt5_accounts.filter(function(a) { return a.user_id === u.id; }).map(function(a) { return { id: a.id, account_number: a.account_number, status: a.status, created_at: a.created_at }; });
              return { id: u.id, name: u.name, email: u.email, ib_status: u.ib_status, ib_email: u.ib_email || '', created_at: u.created_at, mt5_accounts: accs };
            });
            if (filter) { users = users.filter(function(u) { return u.ib_status === filter; }); }
            json = { users: users };
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/admin/whitelist')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else {
            var a2 = db.mt5_accounts.find(function(a) { return a.id === body.account_id; });
            if (a2) { a2.status = body.status; saveDb(db); }
            json = { success: true, message: 'MT5 account ' + body.status + '.' };
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/admin/ib')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else {
            var u2 = db.users.find(function(u) { return u.id === body.user_id; });
            if (u2) { u2.ib_status = body.status; saveDb(db); }
            json = { success: true, message: 'IB ' + body.status + '.' };
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/admin/reset-user-password')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else {
            var u3 = db.users.find(function(u) { return u.id === body.user_id; });
            if (u3) { u3.password = body.new_password; db.tokens = db.tokens.filter(function(t) { return t.user_id !== u3.id; }); saveDb(db); }
            json = { success: true, message: 'User password has been reset.' };
          }
        }

        // --- EVENTS ---
        else if (method === 'POST' && urlStr.includes('/api/events')) {
          var userId = null;
          var authH = headers['Authorization'] || headers['authorization'] || '';
          if (authH.startsWith('Bearer ')) {
            var tok = authH.slice(7);
            var tokRow = db.tokens.find(function(t) { return t.token === tok; });
            if (tokRow) userId = tokRow.user_id;
          }
          if (!db.events) db.events = [];
          db.events.push({
            id: Date.now(),
            type: body.type,
            page: body.page || '',
            referrer: body.referrer || '',
            title: body.title || '',
            user_id: userId,
            metadata: body.metadata ? JSON.stringify(body.metadata) : '{}',
            created_at: new Date().toISOString()
          });
          saveDb(db);
          json = { success: true }; status = 201;
        }
        else if (method === 'GET' && urlStr.includes('/api/admin/events')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else {
            var urlObj = new URL(urlStr, 'http://localhost');
            var typeP = urlObj.searchParams.get('type');
            var fromP = urlObj.searchParams.get('from');
            var toP = urlObj.searchParams.get('to');
            var evts = (db.events || []).slice();
            if (typeP) { evts = evts.filter(function(e) { return e.type === typeP; }); }
            if (fromP) { evts = evts.filter(function(e) { return new Date(e.created_at) >= new Date(fromP); }); }
            if (toP) { evts = evts.filter(function(e) { return new Date(e.created_at) <= new Date(toP); }); }
            evts.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
            evts = evts.slice(0, 200);
            evts = evts.map(function(e) {
              var u = db.users.find(function(u) { return u.id === e.user_id; });
              var result = {};
              for (var k in e) result[k] = e[k];
              result.user_name = u ? u.name : null;
              result.user_email = u ? u.email : null;
              return result;
            });
            json = { events: evts };
          }
        }
        else { json = { error: 'Demo: unknown route' }; status = 404; }
      } catch(e) { json = { error: 'Demo error: ' + e.message }; status = 500; }

      resolve({
        ok: status >= 200 && status < 300, status: status,
        json: function() { return Promise.resolve(json); },
        text: function() { return Promise.resolve(JSON.stringify(json)); }
      });
    });
  };

  console.log('[DEMO MODE v2] Active. Admin key: demo-admin');
})();
