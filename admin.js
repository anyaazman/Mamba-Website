(function () {
  'use strict';
  var API_BASE = '/api';
  var $ = function (id) { return document.getElementById(id); };
  function safeSession(action, key, value) {
    try {
      if (action === 'get') return sessionStorage.getItem(key);
      if (action === 'set') sessionStorage.setItem(key, value);
      if (action === 'remove') sessionStorage.removeItem(key);
    } catch (_) { return null; }
  }
  var adminKey = safeSession('get', 'mamba_admin_key');
  var allUsers = [], selectedUserId = null, currentFilter = '', usersLoaded = false;
  var syncAlertCount = null, usersRequest = 0, eventsRequest = 0;
  var currentView = 'overview', currentEventType = '', currentDateRange = '';
  var eventCursors = [null], eventPage = 0, nextEventCursor = null;
  var appliedCustomFrom = '', appliedCustomTo = '', pendingAction = null, actionBusy = false;
  var notices = [];
  try { notices = JSON.parse(safeSession('get', 'mamba_admin_warnings')) || []; } catch (_) {}
  if (!Array.isArray(notices)) notices = [];
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
  }
  var escAttr = esc;
  function showToast(message, type) {
    var previous = document.querySelector('.toast-message'); if (previous) previous.remove();
    var el = document.createElement('div'); el.className = 'toast-message show ' + (type === 'success' ? 'toast-success' : 'toast-error');
    el.setAttribute('role','status'); el.textContent = message; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 5000);
  }
  function renderNotices() {
    $('actionNotice').hidden = !notices.length;
    $('actionNotice').className = 'action-notice warning';
    $('actionNotice').innerHTML = '<strong>Follow-up needed</strong>' + notices.map(function(n) { return '<p>' + esc(n) + '</p>'; }).join('') + '<button class="admin-button" id="clearNotices">Clear reviewed notices</button>';
    if ($('clearNotices')) $('clearNotices').onclick = function () { notices = []; safeSession('remove','mamba_admin_warnings'); renderNotices(); };
  }
  function warn(message) { notices.push(message); safeSession('set','mamba_admin_warnings',JSON.stringify(notices)); renderNotices(); $('actionNotice').scrollIntoView({block:'nearest'}); }
  async function request(route, body) {
    var res = await fetch(API_BASE + route, {method: body ? 'POST' : 'GET', headers:{'X-Admin-Key':adminKey,'Content-Type':'application/json'}, body:body ? JSON.stringify(body) : undefined});
    var data; try { data = await res.json(); } catch (_) { throw new Error('The server returned an unreadable response. Refresh and try again.'); }
    if (res.status === 403) { safeSession('remove','mamba_admin_key'); showKeyScreen(); throw new Error('Admin access expired. Enter your key again.'); }
    if (!res.ok || data.success === false) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }
  function showKeyScreen() { $('keyScreen').style.display='flex'; $('adminPanel').style.display='none'; }
  function showAdminPanel() { $('keyScreen').style.display='none'; $('adminPanel').style.display='block'; $('demoLabel').hidden=!window.MAMBA_DEMO; $('loadDemoClients').hidden=!(window.MAMBA_DEMO && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)); renderNotices(); }
  async function verifyKey(key) {
    try { var r=await fetch(API_BASE+'/admin/status',{headers:{'X-Admin-Key':key}}); var d=await r.json(); return r.ok && d.valid; } catch (_) { return false; }
  }
  function hasIBRequest(u) { return !!String(u.ib_email || '').trim(); }
  function needsIB(u) { return hasIBRequest(u) && u.ib_status === 'pending'; }
  function needsWhitelist(a) { return a.status === 'pending' && !!a.whitelist_requested_at; }
  function accountCount(u) { return (u.mt5_accounts || []).length; }
  function ibLabel(u) { return u.ib_status === 'pending' && !hasIBRequest(u) ? 'Not requested' : ({pending:'Requested',approved:'Approved',rejected:'Rejected'}[u.ib_status] || 'Unknown'); }
  function badge(status,label) { return '<span class="status-badge status-'+ (['pending','approved','rejected'].includes(status) ? status : 'neutral') +'">'+esc(label)+'</span>'; }
  function nextAction(u) {
    if (needsIB(u)) return 'Review IB request';
    if (u.ib_status === 'rejected') return 'IB follow-up needed';
    if (u.ib_status !== 'approved') return 'Waiting for IB request';
    if (!accountCount(u)) return 'Waiting for MT5 account';
    if (u.mt5_accounts.some(needsWhitelist)) return 'Review whitelist request';
    if (u.mt5_accounts.some(function(a){return a.status==='rejected';})) return 'MT5 follow-up needed';
    if (u.mt5_accounts.every(function(a){return a.status==='approved';})) return 'Portal approvals complete';
    return 'Waiting for whitelist request';
  }
  function dateText(value) {
    if (!value) return 'Not recorded';
    var str=String(value), d=new Date(str.includes('T') ? str : str.replace(' ','T')+'Z');
    if (isNaN(d)) return 'Unknown date';
    return new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
  }
  async function loadUsers() {
    var serial=++usersRequest;
    try {
      var data=await request('/admin/users'); if(serial!==usersRequest)return;
      allUsers=data.users || []; usersLoaded=true; renderOverview(); applyFilters();
    } catch(e) {
      if(serial!==usersRequest)return;
      // Do not let a parallel sync-alert refresh republish stale client data.
      usersLoaded=false; allUsers=[]; selectedUserId=null;
      $('usersContainer').innerHTML='<p class="empty-state">'+esc(e.message)+'</p>';
      $('reviewQueue').textContent=e.message;
      $('overviewStats').textContent='Client counts unavailable. Use Refresh data to retry.';
      $('clientCount').textContent='Client data unavailable';
      renderClient();
    }
  }
  async function loadSyncAlerts() {
    try { var d=await request('/admin/events?type=sync_alerts&limit=1'); syncAlertCount=Number.isFinite(d.total)?d.total:null; } catch(_) { syncAlertCount=null; }
    renderOverview();
  }
  function renderOverview() {
    if (!usersLoaded) return;
    var ib=allUsers.filter(needsIB).length;
    var mt5=allUsers.reduce(function(n,u){return n+(u.mt5_accounts || []).filter(needsWhitelist).length;},0);
    var stats=[['pending',ib,'IB requests','Submitted and awaiting review'],['whitelist',mt5,'Whitelist requests','MT5 accounts awaiting review'],['alerts',syncAlertCount===null?'—':syncAlertCount,'Sync alerts','All recorded alerts · may be resolved'],['',allUsers.length,'Total clients','All registered member accounts']];
    $('overviewStats').innerHTML=stats.map(function(s){return '<button class="stat-button" data-queue="'+s[0]+'"><span class="stat-name">'+s[2]+'</span><span class="stat-value">'+s[1]+'</span><span class="stat-note">'+s[3]+'</span></button>';}).join('');
    $('overviewStats').querySelectorAll('button').forEach(function(b){b.onclick=function(){var q=b.dataset.queue;if(q==='alerts'){currentEventType='sync_alerts';currentDateRange='';$('eventSearch').value='';$('customDateRange').style.display='none';syncEventTabs();resetEvents();openView('events');}else{currentFilter=q;$('adminSearch').value='';openView('users');applyFilters();}};});
    var queue=allUsers.filter(function(u){return needsIB(u)||(u.mt5_accounts||[]).some(needsWhitelist);});
    $('reviewQueue').innerHTML=queue.length ? queue.slice(0,8).map(function(u){return '<div class="queue-row"><div><strong>'+esc(u.name)+'</strong><p>'+esc(u.email)+'</p>'+badge('pending',nextAction(u))+'</div><button class="admin-button" data-review="'+esc(u.id)+'">Review request</button></div>';}).join('')+(queue.length>8?'<p class="muted">Showing 8 clients. Open Clients for the full list.</p>':'') : '<div class="empty-state"><strong>No submitted requests waiting.</strong><p>New IB and MT5 whitelist requests will appear here.</p></div>';
    $('reviewQueue').querySelectorAll('[data-review]').forEach(function(b){b.onclick=function(){currentFilter='';$('adminSearch').value='';selectedUserId=String(b.dataset.review);openView('users');applyFilters();focusDetail();};});
  }
  function applyFilters() {
    var query=$('adminSearch').value.trim().toLowerCase();
    document.querySelectorAll('#userFilterTabs button').forEach(function(b){b.classList.toggle('active',b.dataset.status===currentFilter);b.setAttribute('aria-pressed',String(b.dataset.status===currentFilter));});
    var filtered=allUsers.filter(function(u){
      var statusMatches=!currentFilter || (currentFilter==='pending'?needsIB(u):currentFilter==='whitelist'?(u.mt5_accounts||[]).some(needsWhitelist):currentFilter==='not_requested'?!hasIBRequest(u)&&u.ib_status==='pending':u.ib_status===currentFilter);
      return statusMatches && (!query || [u.name,u.email,u.ib_email].concat((u.mt5_accounts||[]).map(function(a){return a.account_number;})).join(' ').toLowerCase().includes(query));
    });
    $('clientCount').textContent=filtered.length+' of '+allUsers.length+' clients';
    if(!filtered.some(function(u){return String(u.id)===String(selectedUserId);}))selectedUserId=filtered.length?String(filtered[0].id):null;
    $('usersContainer').innerHTML=filtered.length?filtered.map(function(u){return '<button class="client-row" data-client="'+esc(u.id)+'" aria-pressed="'+(String(u.id)===String(selectedUserId))+'"><strong>'+esc(u.name)+'</strong><small>'+esc(u.email)+'</small><span class="client-row-meta">'+badge(ibLabel(u)==='Not requested'?'neutral':u.ib_status,'IB: '+ibLabel(u))+'<span>'+accountCount(u)+' MT5</span></span><small>'+esc(nextAction(u))+'</small></button>';}).join(''):'<p class="empty-state">No clients match this filter. Try another name or select All clients.</p>';
    $('usersContainer').querySelectorAll('[data-client]').forEach(function(b){b.onclick=function(){selectedUserId=b.dataset.client;applyFilters();focusDetail();};});
    renderClient();
  }
  function focusDetail(){if(matchMedia('(max-width:700px)').matches){$('clientDetail').scrollIntoView({block:'start'});$('clientDetail').focus({preventScroll:true});}}
  function renderClient() {
    var u=allUsers.find(function(u){return String(u.id)===String(selectedUserId);});
    if(!u){$('clientDetail').innerHTML='<div class="empty-state">Select a client to see their onboarding progress and accounts.</div>';return;}
    var accounts=u.mt5_accounts||[];
    var steps=[['Registered',true],['IB requested',hasIBRequest(u)],['IB approved',u.ib_status==='approved'],['MT5 added',accounts.length>0],['Whitelist requested',accounts.some(function(a){return !!a.whitelist_requested_at;})],['All MT5 approved',accounts.length>0&&accounts.every(function(a){return a.status==='approved';})]];
    var h='<div class="detail-header"><div><h2>'+esc(u.name)+'</h2><p>'+esc(u.email)+'</p><p>Joined '+esc(dateText(u.created_at))+' MYT</p></div><details class="more-actions"><summary class="admin-button">More actions</summary><div class="more-menu"><button class="admin-button" data-action="reset">Reset password</button><button class="admin-button danger" data-action="delete">Delete client</button></div></details></div>';
    h+='<ol class="client-progress" aria-label="Recorded onboarding progress">'+steps.map(function(s){return '<li class="'+(s[1]?'done':'')+'">'+(s[1]?'✓ ':'○ ')+s[0]+'</li>';}).join('')+'</ol><p class="muted">Recorded portal progress. App installation and live trading are not tracked here.</p>';
    h+='<section class="detail-section"><h3>IB verification '+badge(ibLabel(u)==='Not requested'?'neutral':u.ib_status,ibLabel(u))+'</h3><dl class="detail-data"><dt>Valetax email</dt><dd>'+esc(u.ib_email||'Not submitted')+'</dd><dt>Account path</dt><dd>'+esc(u.ib_type==='new'?'New Valetax account':u.ib_type==='existing'?'Existing Valetax account':u.ib_type||'Not selected')+'</dd></dl>';
    if(!hasIBRequest(u))h+='<p class="muted">No IB request email is recorded. Manual status controls remain available below.</p>';
    h+='<div class="action-row">'+(u.ib_status!=='approved'?'<button class="admin-button primary" data-action="ib" data-status="approved">Approve IB</button>':'')+(u.ib_status!=='rejected'?'<button class="admin-button" data-action="ib" data-status="rejected">Reject IB</button>':'')+'<button class="admin-button" data-client-valetax>Compare in Valetax</button></div></section>';
    h+='<section class="detail-section"><h3>MT5 accounts <span class="muted">('+accounts.length+')</span></h3><p class="muted">Whitelist approval is managed separately for each account.</p>';
    h+=accounts.length?accounts.map(function(a){return '<article class="account-card"><div class="account-heading"><strong>MT5 '+esc(a.account_number)+'</strong>'+badge(a.status,'Portal: '+a.status)+'</div><p>'+(a.whitelist_requested_at?'Whitelist requested '+esc(dateText(a.whitelist_requested_at))+' MYT':'No whitelist request date recorded')+'</p><div class="action-row">'+(a.status!=='approved'?'<button class="admin-button primary" data-action="whitelist" data-account="'+esc(a.id)+'" data-status="approved">Approve account</button>':'')+(a.status!=='rejected'?'<button class="admin-button" data-action="whitelist" data-account="'+esc(a.id)+'" data-status="rejected">Reject account</button>':'')+'</div></article>';}).join(''):'<p class="empty-state">No MT5 accounts added yet.</p>';
    $('clientDetail').innerHTML=h+'</section>';
    $('clientDetail').querySelectorAll('[data-action]').forEach(function(b){b.onclick=function(){openAction(u,b.dataset.action,b.dataset.status,b.dataset.account);};});
    $('clientDetail').querySelector('[data-client-valetax]').onclick=function(){openView('valetax');};
  }
  function openAction(u,kind,status,accountId) {
    var account=(u.mt5_accounts||[]).find(function(a){return String(a.id)===String(accountId);});
    var verb=status==='approved'?'Approve':'Reject';
    var title=kind==='reset'?'Reset password':kind==='delete'?'Delete client':kind==='ib'?verb+' IB verification':verb+' MT5 account';
    var identity=u.name+' ('+u.email+')';
    var description=kind==='reset'?'Set a new password for '+identity+'. Their existing sessions will end.':kind==='delete'?'Delete '+identity+' and their portal accounts. Backend whitelist removal will also be attempted. This cannot be undone.':kind==='ib'?verb+' the IB status for '+identity+'. This does not change MT5 approval.':verb+' MT5 '+account.account_number+' for '+identity+'. The portal status and trading backend confirmation will be reported separately.';
    pendingAction={kind:kind,user:u,account:account,status:status};
    $('dialogTitle').textContent=title;$('dialogDescription').textContent=description;$('dialogError').hidden=true;
    $('dialogFields').innerHTML=kind==='reset'?'<label class="field-label" for="newAdminPassword">New password (at least 8 characters)</label><input id="newAdminPassword" class="admin-search-input" type="password" autocomplete="new-password" minlength="8" maxlength="128" required><label class="field-label" for="confirmAdminPassword">Confirm new password</label><input id="confirmAdminPassword" class="admin-search-input" type="password" autocomplete="new-password" minlength="8" maxlength="128" required>':kind==='delete'?'<label class="field-label" for="deleteConfirmation">Type DELETE to confirm</label><input id="deleteConfirmation" class="admin-search-input" autocomplete="off" required pattern="DELETE">':'';
    $('dialogSubmit').textContent=title;$('dialogSubmit').className='admin-button '+(kind==='delete'?'danger':'primary');
    $('actionDialog').showModal();
  }
  function closeDialog(){if(actionBusy)return;$('actionDialog').close();$('dialogFields').innerHTML='';pendingAction=null;}
  async function submitAction(e){
    e.preventDefault();if(actionBusy||!pendingAction)return;
    var a=pendingAction, body,route;
    if(a.kind==='reset'){
      if($('newAdminPassword').value!==$('confirmAdminPassword').value){$('dialogError').textContent='The passwords do not match.';$('dialogError').hidden=false;return;}
      route='/admin/reset-user-password';body={user_id:Number(a.user.id),new_password:$('newAdminPassword').value};
    }else if(a.kind==='delete'){route='/admin/delete-user';body={user_id:Number(a.user.id)};}
    else if(a.kind==='ib'){route='/admin/ib';body={user_id:Number(a.user.id),status:a.status};}
    else{route='/admin/whitelist';body={account_id:Number(a.account.id),status:a.status};}
    actionBusy=true;$('dialogSubmit').disabled=true;$('dialogCancel').disabled=true;$('dialogClose').disabled=true;
    try {
      var d=await request(route,body);
      if(!d.success)throw new Error(d.error||'The change was not confirmed.');
      var who=a.user.name+' ('+a.user.email+')';
      if(a.kind==='whitelist'){
        var accountName='MT5 '+a.account.account_number+' for '+who;
        if(d.backend_synced!==true)warn(accountName+': portal marked '+a.status+'. '+(d.warning||'Trading backend confirmation is unavailable. Check the backend before treating this as complete.'));
        else showToast(accountName+': '+a.status+'. '+(d.simulated?'Local demo result; no live backend was contacted.':'Trading backend confirmed.'),'success');
      } else if(a.kind==='delete') {
        if(d.backend_synced!==true)warn(who+': deleted from the portal. Backend removal is not confirmed'+(d.orphaned_accounts&&d.orphaned_accounts.length?' for MT5 '+d.orphaned_accounts.join(', '):'')+'. Reconcile these accounts manually.');
        else showToast(who+': deleted.'+(d.simulated?' Local demo only.':''),'success');
      } else showToast(who+': '+(a.kind==='reset'?'password reset.':'IB '+a.status+'.'),'success');
      // Keep this dialog locked through the refresh: an older finally must
      // never re-enable controls belonging to a newer in-flight action.
      await Promise.all([loadUsers(),loadSyncAlerts()]);
      actionBusy=false;closeDialog();
    }catch(err){$('dialogError').textContent=err.message;$('dialogError').hidden=false;}
    finally{actionBusy=false;$('dialogSubmit').disabled=false;$('dialogCancel').disabled=false;$('dialogClose').disabled=false;}
  }
  function openView(view){
    currentView=view;
    ['overview','users','valetax','events'].forEach(function(v){$(v+'View').style.display=view===v?'block':'none';});
    document.querySelectorAll('#viewTabs button').forEach(function(b){b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    if(view==='events')loadEvents();if(view==='valetax')loadValetaxStatus();if(view==='users')applyFilters();
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
    $('valetaxReport').hidden = true;
    valetaxReport = null;
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
        if (!r.ok) throw new Error(r.data.error || 'Could not load the comparison.');
        if (!r.data.hasSnapshot) return;
        valetaxReport = r.data;
        renderValetaxReport();
      })
      .catch(function(e) { $('valetaxStatusLine').textContent = 'Snapshot found, but the comparison could not load: ' + e.message; });
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

  var EVENT_LABELS={pageview:'Page viewed',register:'Member registered',login:'Signed in',ib_request:'IB verification requested',mt5_added:'MT5 account added',whitelist_request:'Whitelist requested',whitelist_synced:'Whitelist auto-synced',whitelist_sync_failed:'Whitelist sync failed',whitelist_orphaned:'Backend removal unconfirmed',password_reset:'Password reset',account_deletion_request:'Account deletion requested'};
  function getDateRangeParams(){
    var now=new Date(),my=new Date(now.getTime()+8*3600000),y=my.getUTCFullYear(),m=my.getUTCMonth(),d=my.getUTCDate(),from=null,to=null;
    function midnight(day){return new Date(Date.UTC(y,m,day)-8*3600000);}
    if(currentDateRange==='today'){from=midnight(d);to=now;}
    if(currentDateRange==='yesterday'){from=midnight(d-1);to=new Date(midnight(d).getTime()-1);}
    if(currentDateRange==='7d'){from=midnight(d-6);to=now;}
    if(currentDateRange==='month'){from=midnight(1);to=now;}
    if(currentDateRange==='custom'){if(appliedCustomFrom)from=new Date(appliedCustomFrom+'T00:00:00+08:00');if(appliedCustomTo)to=new Date(appliedCustomTo+'T23:59:59.999+08:00');}
    return {from:from?from.toISOString():null,to:to?to.toISOString():null};
  }
  function resetEvents(){eventCursors=[null];eventPage=0;nextEventCursor=null;}
  function syncEventTabs(){
    document.querySelectorAll('#eventFilterTabs button').forEach(function(b){b.classList.toggle('active',b.dataset.type===currentEventType);b.setAttribute('aria-pressed',String(b.dataset.type===currentEventType));});
    document.querySelectorAll('#dateFilterTabs button').forEach(function(b){b.classList.toggle('active',b.dataset.range===currentDateRange);b.setAttribute('aria-pressed',String(b.dataset.range===currentDateRange));});
  }
  function applyEventFilters(){resetEvents();loadEvents();}
  async function loadEvents(){
    var serial=++eventsRequest,range=getDateRangeParams(),query=new URLSearchParams({limit:'50'});
    if(currentEventType)query.set('type',currentEventType);
    if(range.from)query.set('from',range.from);if(range.to)query.set('to',range.to);
    var search=$('eventSearch').value.trim();if(search)query.set('q',search);
    if(eventCursors[eventPage])query.set('cursor',eventCursors[eventPage]);
    $('eventsContainer').innerHTML='<p class="empty-state">Loading activity…</p>';$('eventsNext').disabled=true;$('eventsPrevious').disabled=true;
    $('activityScope').textContent=(currentEventType==='sync_alerts'?'Historical sync alerts. These may already be resolved; this is not a live backend health check. ':'')+(currentDateRange==='custom'?'Custom dates: '+(appliedCustomFrom||'any start')+' to '+(appliedCustomTo||'any end')+' (MYT).':'');
    try{
      var data=await request('/admin/events?'+query);if(serial!==eventsRequest)return;
      nextEventCursor=data.next_cursor||null;renderEvents(data.events||[]);
      $('eventsPage').textContent='Page '+(eventPage+1)+(Number.isFinite(data.total)?' · '+data.total+' events':'');
      $('eventsNext').disabled=!nextEventCursor;$('eventsPrevious').disabled=eventPage===0;
    }catch(e){if(serial!==eventsRequest)return;$('eventsContainer').innerHTML='<p class="empty-state">'+esc(e.message)+'</p>';$('eventsPage').textContent='Activity unavailable';}
  }
  function renderEvents(events){
    $('eventsContainer').innerHTML=events.length?'<div class="activity-list">'+events.map(function(e){
      var meta=e.metadata;try{meta=JSON.stringify(typeof meta==='string'?JSON.parse(meta):meta||{},null,2);}catch(_){meta=String(meta||'');}
      return '<details class="activity-item"><summary><time>'+esc(dateText(e.created_at))+' MYT</time><strong>'+esc(EVENT_LABELS[e.type]||String(e.type).replace(/_/g,' '))+'</strong><span>'+esc(e.user_name||(e.user_id?'Client #'+e.user_id:'Anonymous / deleted client'))+'<small>'+esc(e.user_email||'')+'</small></span></summary><div class="event-detail"><p><strong>Page:</strong> '+esc(e.page||'Not recorded')+'</p><p><strong>Title:</strong> '+esc(e.title||'Not recorded')+'</p><p><strong>Referrer:</strong> '+esc(e.referrer||'Not recorded')+'</p><p><strong>Event ID:</strong> '+esc(e.id)+' · <strong>Client ID:</strong> '+esc(e.user_id||'Not available')+'</p><p><strong>Metadata</strong></p><pre>'+esc(meta)+'</pre></div></details>';
    }).join('')+'</div>':'<p class="empty-state">No activity matches these filters. Try a wider date range or clear the client search.</p>';
  }
  document.addEventListener('DOMContentLoaded',function(){
    $('keyForm').addEventListener('submit',async function(e){e.preventDefault();var form=e.currentTarget,key=form.elements.admin_key.value.trim(),button=form.querySelector('[type=submit]');if(!key)return;button.disabled=true;var valid=await verifyKey(key);button.disabled=false;if(valid){adminKey=key;safeSession('set','mamba_admin_key',key);form.reset();form.querySelector('.key-error').style.display='none';showAdminPanel();loadUsers();loadSyncAlerts();}else{var error=form.querySelector('.key-error');error.textContent='Invalid admin key, or the server is unavailable.';error.style.display='block';}});
    $('adminLogoutBtn').onclick=function(){safeSession('remove','mamba_admin_key');safeSession('remove','mamba_admin_warnings');window.location.href='/index.html';};
    document.querySelectorAll('#viewTabs button').forEach(function(b){b.onclick=function(){openView(b.dataset.view);};});
    document.querySelectorAll('[data-open-view]').forEach(function(b){b.onclick=function(){openView(b.dataset.openView);};});
    document.querySelectorAll('#userFilterTabs button').forEach(function(b){b.onclick=function(){currentFilter=b.dataset.status;applyFilters();};});
    $('adminSearch').addEventListener('input',applyFilters);
    $('refreshAdmin').onclick=function(){loadUsers();loadSyncAlerts();};
    $('loadDemoClients').onclick=async function(){
      var button=$('loadDemoClients');button.disabled=true;
      try {
        var data=await request('/admin/demo-seed',{});
        await Promise.all([loadUsers(),loadSyncAlerts()]);
        button.textContent='Sample clients added';
        showToast(data.already_added?'Sample clients are already loaded. Your edits have been kept.':data.clients_added+' sample clients added. Existing local data kept.','success');
      } catch(e) {button.disabled=false;showToast(e.message,'error');}
    };
    $('dialogClose').onclick=closeDialog;$('dialogCancel').onclick=closeDialog;$('actionForm').addEventListener('submit',submitAction);
    $('actionDialog').addEventListener('cancel',function(e){if(actionBusy)e.preventDefault();});
    $('actionDialog').addEventListener('close',function(){$('dialogFields').innerHTML='';pendingAction=null;});
    document.querySelectorAll('#dateFilterTabs button').forEach(function(b){b.onclick=function(){
      $('customDateRange').style.display=b.dataset.range==='custom'?'flex':'none';
      if(b.dataset.range==='custom'){$('customDateFrom').focus();return;}
      currentDateRange=b.dataset.range;syncEventTabs();applyEventFilters();
    };});
    $('customDateApply').onclick=function(){var from=$('customDateFrom').value,to=$('customDateTo').value;
      if(!from&&!to){showToast('Choose at least one date.','error');return;}if(from&&to&&from>to){showToast('The start date must come before the end date.','error');return;}
      appliedCustomFrom=from;appliedCustomTo=to;currentDateRange='custom';syncEventTabs();applyEventFilters();};
    document.querySelectorAll('#eventFilterTabs button').forEach(function(b){b.onclick=function(){currentEventType=b.dataset.type;syncEventTabs();applyEventFilters();};});
    var timer;$('eventSearch').addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(applyEventFilters,200);});
    $('eventsNext').onclick=function(){if(!nextEventCursor)return;eventPage++;eventCursors[eventPage]=nextEventCursor;loadEvents();};
    $('eventsPrevious').onclick=function(){if(eventPage){eventPage--;loadEvents();}};
    setupValetaxView();
    (async function(){if(adminKey&&await verifyKey(adminKey)){showAdminPanel();loadUsers();loadSyncAlerts();}else{safeSession('remove','mamba_admin_key');showKeyScreen();}var ls=document.querySelector('.loading-screen');if(ls)ls.remove();document.body.classList.add('page-loaded');})();
  });
})();
