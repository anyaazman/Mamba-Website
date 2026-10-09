/* A quiet invitation after the visitor has had time to understand Mamba. */
(() => {
  'use strict';
  const prompt = document.getElementById('setupPrompt');
  const overview = document.getElementById('how-it-works');
  if (!prompt || !overview) return;

  const SEEN = 'mamba_setup_prompt_seen';
  const DISMISSED = 'mamba_setup_prompt_dismissed_until';
  const WEEK = 7 * 86400000;
  const DELAY = 15000;
  // If storage is unavailable, keep the normal page links and skip promotion.
  function suppressed() {
    try {
      return Boolean(localStorage.getItem('mamba_token')) ||
        Boolean(sessionStorage.getItem(SEEN)) ||
        Number(localStorage.getItem(DISMISSED)) > Date.now();
    } catch { return true; }
  }
  if (suppressed()) return;

  let visibleTime = 0;
  let visibleSince = document.visibilityState === 'visible' ? performance.now() : null;
  let reachedOverview = false;
  let shown = false;
  let finished = false;
  let focusBefore = null;

  function rememberSeen() {
    try { sessionStorage.setItem(SEEN, '1'); return true; } catch { return false; }
  }
  function isVisible(element) {
    return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  }
  function busy() {
    const active = document.activeElement;
    if (active && (active.matches('input, textarea, select, [contenteditable="true"]'))) return true;
    if (document.querySelector('#navToggle[aria-expanded="true"]')) return true;
    if (Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"], .modal-overlay.active, #appBanner')).some(isVisible)) return true;
    // Avoid covering content in short landscape viewports or above a phone keyboard.
    return (window.visualViewport?.height || innerHeight) < 440;
  }
  function hide() {
    const heldFocus = prompt.contains(document.activeElement);
    prompt.hidden = true;
    if (heldFocus) {
      const target = focusBefore && focusBefore !== document.body && focusBefore.isConnected && isVisible(focusBefore)
        ? focusBefore : overview.querySelector('a');
      target?.focus({ preventScroll: true });
    }
  }
  function finish() {
    finished = true;
    clearInterval(timer);
    hide();
  }
  function tick() {
    if (finished) return;
    if (shown) {
      // Respect a dismissal or login in another tab; avoid competing UI.
      try {
        if (localStorage.getItem('mamba_token') || Number(localStorage.getItem(DISMISSED)) > Date.now()) return finish();
      } catch { return finish(); }
      if (document.visibilityState !== 'visible' || busy()) hide();
      else prompt.hidden = false;
      return;
    }
    if (suppressed()) return finish();
    if (document.visibilityState !== 'visible') return;
    const rect = overview.getBoundingClientRect();
    if (scrollY > 0 && rect.top <= innerHeight * .7) reachedOverview = true;
    const elapsed = visibleTime + (visibleSince === null ? 0 : performance.now() - visibleSince);
    if (!reachedOverview || elapsed < DELAY || busy()) return;
    // Establish writable storage before showing a prompt we could not remember dismissing.
    try { localStorage.setItem(DISMISSED, localStorage.getItem(DISMISSED) || '0'); }
    catch { return finish(); }
    if (!rememberSeen()) return finish();
    focusBefore = document.activeElement;
    shown = true;
    prompt.hidden = false;
  }
  const timer = setInterval(tick, 250);
  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    if (visibleSince !== null) visibleTime += now - visibleSince;
    visibleSince = document.visibilityState === 'visible' ? now : null;
    tick();
  });

  function dismiss() {
    try { localStorage.setItem(DISMISSED, String(Date.now() + WEEK)); } catch { /* Session suppression remains. */ }
    finish();
  }
  prompt.querySelector('button').addEventListener('click', dismiss);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !prompt.hidden) dismiss();
  });
  // Any existing signup/sign-in/store action is already a response to the invitation.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    const memberLink = url.origin === location.origin && /\/(login|dashboard)(\.html)?\/?$/.test(url.pathname);
    const storeLink = ['apps.apple.com', 'play.google.com'].includes(url.hostname);
    if (prompt.contains(link) || memberLink || storeLink) { rememberSeen(); finish(); }
  }, true);
  window.addEventListener('storage', tick);
  // Back/forward cache can restore the old timer and markup without rerunning this file.
  window.addEventListener('pageshow', event => {
    if (event.persisted) { rememberSeen(); finish(); }
  });
})();
