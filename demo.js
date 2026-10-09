// demo.js — Sandbox mode for the local preview only.
(function() {
  // The preview is served from localhost, so keep its demo API available even
  // when a visitor follows a plain login.html link without the query flag.
  var isLocalPreview = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  // Public hosts always use the real API, including URLs carrying ?demo.
  if (!isLocalPreview) return;

  window.MAMBA_DEMO = true;
  var originalFetch = window.fetch;
  var DEMO_DB_KEY = 'mamba_demo_v2';

  function getDb() {
    try { return JSON.parse(localStorage.getItem(DEMO_DB_KEY)) || { users: [], mt5_accounts: [], tokens: [], events: [] }; }
    catch(e) { return { users: [], mt5_accounts: [], tokens: [], events: [] }; }
  }
  function saveDb(db) { localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db)); }

  // Explicit local-only sample import. It appends once and never overwrites
  // an operator's existing account, sessions, imported snapshot, or later edits.
  function seedAdminSamples() {
    var raw = localStorage.getItem(DEMO_DB_KEY);
    var db = raw ? JSON.parse(raw) : { users: [], mt5_accounts: [], tokens: [], events: [] };
    if (!db || !['users','mt5_accounts','tokens'].every(function(key) { return Array.isArray(db[key]); }) || (db.events && !Array.isArray(db.events))) {
      throw new Error('Saved demo data could not be read safely. No sample data was added.');
    }
    if (db.admin_samples_v1) return { success: true, already_added: true, clients_added: 0 };
    if (raw && !localStorage.getItem('mamba_demo_before_admin_samples_v1')) localStorage.setItem('mamba_demo_before_admin_samples_v1', raw);
    if (!db.events) db.events = [];
    var sequence = Math.max(Date.now(), db.users.concat(db.mt5_accounts, db.events).reduce(function(max, row) { return Math.max(max, Number(row.id) || 0); }, 0));
    var now = Date.now();
    function ago(hours) { return new Date(now - hours * 3600000).toISOString(); }
    var addedUsers = [], addedAccounts = [];
    function client(name, slug, ibStatus, requested, age) {
      var email = slug + '.sample@mamba.invalid';
      // Sample-specific reserved emails cannot accidentally reuse a client.
      while (db.users.some(function(u) { return u.email === email; })) email = 'sample.' + email;
      var u = { id: ++sequence, name: name + ' (Sample)', email: email,
        password: 'MambaDemo!2026', recovery_phrase: 'local sample account recovery only',
        ib_status: ibStatus, ib_email: requested ? slug + '.broker@example.invalid' : '',
        ib_type: requested ? 'existing' : '', created_at: ago(age), updated_at: ago(1) };
      db.users.push(u); addedUsers.push(u.id);
      event('register', u, age);
      if (requested) event('ib_request', u, age - 2);
      return u;
    }
    function event(type, user, age, metadata) {
      db.events.push({ id: ++sequence, type: type, user_id: user ? user.id : null,
        page: type === 'register' ? '/login' : '/dashboard', referrer: '', title: 'Local sample activity',
        metadata: JSON.stringify(Object.assign({ simulated: true, source: 'admin-samples-v1' }, metadata || {})), created_at: ago(age) });
    }
    function account(u, number, status, requested, age) {
      while (db.mt5_accounts.some(function(a) { return String(a.account_number) === String(number); })) number++;
      var a = { id: ++sequence, user_id: u.id, account_number: String(number), status: status,
        created_at: ago(age), whitelist_requested_at: requested ? ago(age - 1) : null };
      db.mt5_accounts.push(a); addedAccounts.push(a.id);
      event('mt5_added', u, age, { account_id: a.id, account_number: a.account_number });
      if (requested) event('whitelist_request', u, age - 1, { account_id: a.id, account_number: a.account_number });
      return a;
    }
    client('Daniel Tan', 'daniel', 'pending', false, 10);
    client('Aina Rahman', 'aina', 'pending', true, 24);
    client('Mei Ling', 'mei', 'approved', true, 48);
    var sara = client('Sara Lim', 'sara', 'approved', true, 120);
    var saraPending = account(sara, 88001001, 'pending', true, 4);
    account(sara, 88001101, 'pending', false, 2);
    var saraRejected = account(sara, 88001201, 'rejected', true, 30);
    event('whitelist_sync_failed', sara, 26, { account_id: saraRejected.id, account_number: saraRejected.account_number, action: 'remove', note: 'Sample rejection with unconfirmed backend removal. No live backend contacted.' });
    var hana = client('Hana Zain', 'hana', 'approved', true, 240);
    var hanaOne = account(hana, 88002001, 'approved', true, 210);
    var hanaTwo = account(hana, 88002002, 'approved', true, 180);
    event('whitelist_synced', hana, 208, { account_number: hanaOne.account_number });
    event('whitelist_synced', hana, 178, { account_number: hanaTwo.account_number });
    event('login', hana, 1);
    client('Rizal Abdullah', 'rizal', 'rejected', true, 96);
    event('whitelist_orphaned', null, 3, { accounts: ['88999001'], reason: 'Fictional deleted sample client: backend removal unconfirmed. No live account exists.' });
    var snapshotAdded = !db.valetax_snapshot;
    if (snapshotAdded) db.valetax_snapshot = {
      pulledAt: ago(2), importedAt: new Date(now).toISOString(), simulated: true,
      clients: [
        { email: sara.ib_email, name: sara.name, valetax_user_id: 'sample-sara', registered_at: ago(120), has_children: 0, logins: [saraPending.account_number] },
        { email: hana.ib_email, name: hana.name, valetax_user_id: 'sample-hana', registered_at: ago(240), has_children: 0, logins: [hanaOne.account_number, hanaTwo.account_number] },
        { email: 'noor.broker@example.invalid', name: 'Noor Ismail (Sample)', valetax_user_id: 'sample-noor', registered_at: ago(72), has_children: 0, logins: ['88999002'] }
      ]
    };
    db.admin_samples_v1 = { added_at: new Date(now).toISOString(), user_ids: addedUsers, account_ids: addedAccounts, snapshot_added: snapshotAdded };
    saveDb(db);
    return { success: true, clients_added: addedUsers.length, snapshot_added: snapshotAdded };
  }

  function cloneUser(u) {
    var accs = getDb().mt5_accounts.filter(function(a) { return a.user_id === u.id; });
    return { id: u.id, name: u.name, email: u.email, ib_status: u.ib_status, ib_email: u.ib_email || '', ib_type: u.ib_type || '', created_at: u.created_at, mt5_accounts: accs.map(function(a) { return { id: a.id, account_number: a.account_number, status: a.status, created_at: a.created_at, whitelist_requested_at: a.whitelist_requested_at || null }; }) };
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

      // Mirrors hasRequestedIB() in functions/api/_helpers.js
      function hasRequestedIB(u) {
        return !!(u && u.ib_email && u.ib_email.trim() !== '');
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
          if (body.accept_terms !== true) { json = { error: 'You must accept the Terms of Service, Privacy Policy and Risk Disclosure.' }; status = 400; }
            else if (db.users.some(function(u) { return u.email === body.email; })) {
            json = { error: 'Email already registered.' }; status = 409;
          } else {
            var nu = { id: Date.now(), name: body.name, email: body.email, password: body.password, recovery_phrase: body.recovery_phrase, ib_status: 'pending', ib_email: '', ib_type: '', created_at: new Date().toISOString() };
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
            var accs = db.mt5_accounts.filter(function(a) { return a.user_id === au3.id; }).map(function(a) { return { id: a.id, account_number: a.account_number, status: a.status, created_at: a.created_at, whitelist_requested_at: a.whitelist_requested_at || null }; });
            json = { accounts: accs };
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/user/add-mt5')) {
          var au4 = getAuthUser();
          if (!au4) { json = { error: 'Not authenticated.' }; status = 401; }
          else if (!hasRequestedIB(au4)) {
            json = { error: 'Please request IB verification before adding an MT5 account.' }; status = 403;
          }
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
          else if (!hasRequestedIB(au5)) {
            json = { error: 'Please request IB verification before requesting whitelist.' }; status = 403;
          }
          else {
            var acc = db.mt5_accounts.find(function(a) { return a.id === body.account_id && a.user_id === au5.id; });
            if (!acc) { json = { error: 'MT5 account not found.' }; status = 404; }
            else if (acc.status === 'approved') { json = { error: 'Already approved.' }; status = 400; }
            else { acc.status = 'pending'; acc.whitelist_requested_at = new Date().toISOString(); addDemoEvent('whitelist_request', au5.id, { account_id: body.account_id }); console.log('[DEMO NOTIFY] 📊 MT5 Whitelist Request | Name: ' + au5.name + ' | Email: ' + au5.email + ' | Account ID: ' + body.account_id); saveDb(db); json = { success: true, message: 'Whitelist request submitted.' }; }
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/user/request-ib')) {
          var au6 = getAuthUser();
          if (!au6) { json = { error: 'Not authenticated.' }; status = 401; }
          else if (!body.ib_email || !body.ib_email.trim()) { json = { error: 'Valetax email is required.' }; status = 400; }
          else { au6.ib_status = 'pending'; au6.ib_email = body.ib_email.trim(); au6.ib_type = body.ib_type || ''; addDemoEvent('ib_request', au6.id); console.log('[DEMO NOTIFY] 🔐 IB Verification Request | Name: ' + au6.name + ' | Email: ' + au6.email + ' | Valetax Email: ' + body.ib_email.trim() + ' | Selection: ' + (body.ib_type === 'new' ? 'New Account (No Valetax yet)' : 'Already Has Valetax Account')); saveDb(db); json = { success: true, message: 'IB verification request submitted.' }; }
        }

        // --- ADMIN ---
        else if (method === 'POST' && urlStr.includes('/api/admin/demo-seed')) {
          if (!isLocalPreview || !isAdmin()) { json = { error: 'Sample data is only available to the local demo admin.' }; status = 403; }
          else { json = seedAdminSamples(); }
        }
        else if (method === 'GET' && urlStr.includes('/api/admin/status')) {
          json = { valid: isAdmin() };
        }
        else if (method === 'GET' && urlStr.includes('/api/admin/users')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else {
            var filter = new URL(urlStr, 'http://localhost').searchParams.get('status');
            var users = db.users.map(function(u) {
              var accs = db.mt5_accounts.filter(function(a) { return a.user_id === u.id; }).map(function(a) { return { id: a.id, account_number: a.account_number, status: a.status, created_at: a.created_at, whitelist_requested_at: a.whitelist_requested_at || null }; });
              return { id: u.id, name: u.name, email: u.email, ib_status: u.ib_status, ib_email: u.ib_email || '', ib_type: u.ib_type || '', created_at: u.created_at, mt5_accounts: accs };
            });
            if (filter) { users = users.filter(function(u) { return u.ib_status === filter; }); }
            json = { users: users };
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/admin/whitelist')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else {
            var a2 = db.mt5_accounts.find(function(a) { return a.id === body.account_id; });
            if (!a2) { json = { error: 'MT5 account not found.' }; status = 404; }
            else if (!['approved','rejected'].includes(body.status)) { json = { error: 'Invalid status.' }; status = 400; }
            else { a2.status = body.status; saveDb(db); json = { success: true, message: 'MT5 account ' + body.status + '.', backend_synced: true, simulated: true }; }
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/admin/ib')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else {
            var u2 = db.users.find(function(u) { return u.id === body.user_id; });
            if (!u2) { json = { error: 'User not found.' }; status = 404; }
            else if (!['approved','rejected'].includes(body.status)) { json = { error: 'Invalid status.' }; status = 400; }
            else { u2.ib_status = body.status; saveDb(db); json = { success: true, message: 'IB ' + body.status + '.' }; }
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/admin/reset-user-password')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else {
            var u3 = db.users.find(function(u) { return u.id === body.user_id; });
            if (!u3) { json = { error: 'User not found.' }; status = 404; }
            else if (typeof body.new_password !== 'string' || body.new_password.length < 8 || body.new_password.length > 128) { json = { error: 'Use a password of 8 to 128 characters.' }; status = 400; }
            else { u3.password = body.new_password; db.tokens = db.tokens.filter(function(t) { return t.user_id !== u3.id; }); saveDb(db); json = { success: true, message: 'User password has been reset.' }; }
          }
        }

        else if (method === 'POST' && urlStr.includes('/api/admin/delete-user')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else if (!db.users.some(function(u) { return u.id === body.user_id; })) { json = { error: 'User not found.' }; status = 404; }
          else {
            db.tokens = db.tokens.filter(function(t) { return t.user_id !== body.user_id; });
            db.mt5_accounts = db.mt5_accounts.filter(function(a) { return a.user_id !== body.user_id; });
            db.users = db.users.filter(function(u) { return u.id !== body.user_id; });
            (db.events || []).forEach(function(e) { if (e.user_id === body.user_id) e.user_id = null; });
            saveDb(db); json = { success: true, backend_synced: true, orphaned_accounts: [], simulated: true };
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
            var queryP = (urlObj.searchParams.get('q') || '').trim().slice(0,200).toLowerCase();
            var requestedLimit = parseInt(urlObj.searchParams.get('limit'), 10);
            var eventLimit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 200, 1),1000);
            var eventCursor = null;
            try {
              if (urlObj.searchParams.has('cursor')) {
                var rawCursor = urlObj.searchParams.get('cursor');
                eventCursor = JSON.parse(rawCursor);
                if (rawCursor.length > 200 || !Number.isSafeInteger(eventCursor.id) || eventCursor.id < 1 || typeof eventCursor.created_at !== 'string' || eventCursor.created_at.length > 40 || !Number.isFinite(Date.parse(eventCursor.created_at))) throw new Error();
              }
            } catch (_) { json = {error:'Invalid activity cursor.'}; status=400; }
            if ((fromP && !Number.isFinite(Date.parse(fromP))) || (toP && !Number.isFinite(Date.parse(toP))) || (fromP && toP && Date.parse(fromP)>Date.parse(toP))) { json={error:'Invalid date range.'};status=400; }
            if (status === 200) {
              var evts = (db.events || []).map(function(e) {
                var u = db.users.find(function(u) { return u.id === e.user_id; });
                return Object.assign({},e,{user_name:u?u.name:null,user_email:u?u.email:null});
              });
              var validTypes=['pageview','register','login','ib_request','mt5_added','whitelist_request','whitelist_synced','password_reset','account_deletion_request','whitelist_sync_failed','whitelist_orphaned'];
              if (typeP === 'sync_alerts') evts = evts.filter(function(e) { return ['whitelist_sync_failed','whitelist_orphaned'].includes(e.type); });
              else if (validTypes.includes(typeP)) evts = evts.filter(function(e) { return e.type === typeP; });
              if (fromP) evts = evts.filter(function(e) { return new Date(e.created_at) >= new Date(fromP); });
              if (toP) evts = evts.filter(function(e) { return new Date(e.created_at) <= new Date(toP); });
              if (queryP) evts = evts.filter(function(e) { return String(e.user_name||'').toLowerCase().includes(queryP) || String(e.user_email||'').toLowerCase().includes(queryP) || String(e.user_id)===queryP; });
              evts.sort(function(a,b) { return new Date(b.created_at)-new Date(a.created_at) || b.id-a.id; });
              var totalEvents=evts.length;
              if (eventCursor) evts=evts.filter(function(e) { return new Date(e.created_at)<new Date(eventCursor.created_at) || (new Date(e.created_at).getTime()===new Date(eventCursor.created_at).getTime() && e.id<eventCursor.id); });
              var hasMoreEvents=evts.length>eventLimit;
              evts=evts.slice(0,eventLimit);
              var lastEvent=evts[evts.length-1];
              json = {events:evts,total:totalEvents,next_cursor:hasMoreEvents&&lastEvent?JSON.stringify({created_at:lastEvent.created_at,id:lastEvent.id}):null};
            }
          }
        }
        // --- VALETAX RECONCILIATION ---
        // Mirrors the real endpoints so the admin tab renders in the sandbox.
        // The demo DB has no downline to match against, so a snapshot import is
        // held in memory only and reconciled against the demo users.
        else if (method === 'GET' && urlStr.includes('/api/admin/valetax/status')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else if (!db.valetax_snapshot) { json = { hasSnapshot: false }; }
          else {
            var vs = db.valetax_snapshot;
            json = { hasSnapshot: true, snapshotId: 1, pulledAt: vs.pulledAt,
                     importedAt: vs.importedAt, clientCount: vs.clients.length, ageHours: Number.isFinite(Date.parse(vs.pulledAt)) ? Math.max(0,Math.round((Date.now()-Date.parse(vs.pulledAt))/3600000)) : null };
          }
        }
        else if (method === 'POST' && urlStr.includes('/api/admin/valetax/import')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else if (!body || !Array.isArray(body.clients)) {
            json = { error: 'Expected a "clients" array — upload valetax-snapshot.json unmodified.' }; status = 400;
          }
          else if (!body.clients.length) {
            json = { error: 'Snapshot contains no clients. Refusing to replace the current one with an empty pull.' }; status = 400;
          }
          // The three rejections below mirror import.js. Without them the
          // sandbox accepted payloads production refuses, so the demo was a
          // misleading place to learn what a bad snapshot does.
          else if (body.pulledAt != null && (typeof body.pulledAt !== 'string' || body.pulledAt.length > 64)) {
            json = { error: '"pulledAt" must be an ISO date string.' }; status = 400;
          }
          else if (body.clients.length > 5000) {
            json = { error: 'Snapshot has ' + body.clients.length + ' clients, above the 5000 limit. Check this is the right file.' }; status = 413;
          }
          else {
            var dc = body.clients.map(function(c) {
              var tr = c.trading;
              var rows = Array.isArray(tr) ? tr : (tr && typeof tr === 'object' ? [tr] : []);
              var logins = [];
              rows.forEach(function(r) {
                var l = r && (r.login || r.account || r.accountNumber);
                if (l && /^\d{3,20}$/.test(String(l))) logins.push(String(l));
              });
              return { email: (c.userEmail || c.email || '').trim().toLowerCase(),
                       name: c.userName || c.name || '',
                       valetax_user_id: String(c.userId || ''),
                       registered_at: c.registeredAt || '',
                       has_children: c.hasChildren ? 1 : 0, logins: logins };
            });
            var withEmail = dc.filter(function(c) { return c.email; }).length;
            if (!withEmail) {
              json = { error: 'No client in this snapshot had a readable email. The Valetax response shape may have changed — not importing.',
                       clientsSeen: dc.length };
              status = 422;
            } else {
              db.valetax_snapshot = { pulledAt: body.pulledAt || null,
                                      importedAt: new Date().toISOString(), clients: dc };
              saveDb(db);
              json = { success: true, snapshotId: 1, pulledAt: body.pulledAt || null,
                       clientsImported: dc.length,
                       clientsWithEmail: withEmail,
                       mt5AccountsImported: dc.reduce(function(n, c) { return n + c.logins.length; }, 0),
                       subIbsNotRecursed: dc.filter(function(c) { return c.has_children; }).length };
              status = 201;
            }
          }
        }
        else if (method === 'GET' && urlStr.includes('/api/admin/valetax/reconcile')) {
          if (!isAdmin()) { json = { error: 'Unauthorized.' }; status = 403; }
          else if (!db.valetax_snapshot) {
            json = { hasSnapshot: false, message: 'No Valetax snapshot imported yet. Run tools/valetax-sync and upload valetax-snapshot.json.' };
          }
          else {
            var vc = db.valetax_snapshot.clients;
            var vEmails = vc.map(function(c) { return c.email; }).filter(Boolean);
            var vLogins = vc.reduce(function(a, c) { return a.concat(c.logins); }, []);
            var claimers = db.users.filter(function(u) { return (u.ib_email || '').trim() !== ''; });
            var matched = claimers.filter(function(u) { return vEmails.indexOf(u.ib_email.trim().toLowerCase()) !== -1; });
            var claimedNot = claimers.filter(function(u) { return vEmails.indexOf(u.ib_email.trim().toLowerCase()) === -1; });
            var notOnMamba = vc.filter(function(c) {
              if (!c.email) return false;
              return !db.users.some(function(u) {
                return (u.ib_email || '').trim().toLowerCase() === c.email ||
                       (u.email || '').trim().toLowerCase() === c.email;
              });
            });
            var acctsNot = db.mt5_accounts.filter(function(a) { return vLogins.indexOf(String(a.account_number)) === -1; })
              .map(function(a) {
                var ow = db.users.find(function(u) { return u.id === a.user_id; }) || {};
                return { id: a.id, account_number: a.account_number, status: a.status, name: ow.name, email: ow.email };
              });
            json = {
              hasSnapshot: true,
              snapshot: { id: 1, pulledAt: db.valetax_snapshot.pulledAt,
                          importedAt: db.valetax_snapshot.importedAt, clientCount: vc.length },
              counts: { matched: matched.length, claimedNotInValetax: claimedNot.length,
                        inValetaxNotOnMamba: notOnMamba.length, accountsNotInValetax: acctsNot.length,
                        subIbsNotRecursed: vc.filter(function(c) { return c.has_children; }).length },
              matched: matched, claimedNotInValetax: claimedNot,
              inValetaxNotOnMamba: notOnMamba, accountsNotInValetax: acctsNot
            };
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
