(function() {
  'use strict';

  function send(payload) {
    var headers = { 'Content-Type': 'application/json' };
    var token = localStorage.getItem('mamba_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
      fetch('/api/events', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function() {});
    } catch(e) {}
  }

  function track(type, meta) {
    send({
      type: type,
      page: window.location.pathname,
      referrer: document.referrer || '',
      title: document.title || '',
      metadata: meta || {}
    });
  }

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    track('pageview');
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      track('pageview');
    });
  }

  window.mambaTrack = track;
})();
