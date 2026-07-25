// nav.js — header navigation, including the mobile drawer toggle.
//
// Lives in its own file rather than script.js because the legal, support and
// 404 pages do not load script.js, and the navigation has to work everywhere.
(function () {
  'use strict';

  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (!toggle || !links) return;

  function setOpen(open) {
    links.classList.toggle('active', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    // Stop the page scrolling behind an open full-height drawer.
    document.body.style.overflow = open ? 'hidden' : '';
  }

  function isOpen() {
    return links.classList.contains('active');
  }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(!isOpen());
  });

  // Choosing a destination should close the drawer, including for same-page
  // anchors where no navigation actually occurs.
  links.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (isOpen() && !links.contains(e.target) && !toggle.contains(e.target)) {
      setOpen(false);
    }
  });

  // Leaving mobile width with the drawer open would otherwise strand the
  // body in overflow:hidden.
  window.addEventListener('resize', function () {
    if (isOpen() && window.innerWidth > 968) setOpen(false);
  });
})();
