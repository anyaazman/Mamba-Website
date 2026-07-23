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
  var currentUser = null;

  // --- Scroll Lock for Modals (prevents background page from scrolling) ---
  var _modalScrollPosition = 0;
  var _activeModals = 0;

  function lockBodyScroll() {
    if (_activeModals === 0) {
      _modalScrollPosition = window.scrollY || document.documentElement.scrollTop;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    _activeModals++;
  }

  function unlockBodyScroll() {
    _activeModals = Math.max(0, _activeModals - 1);
    if (_activeModals === 0) {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      window.scrollTo(0, _modalScrollPosition);
    }
  }

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

  function hasRequestedIB() {
    return currentUser && currentUser.ib_email && currentUser.ib_email.trim() !== '';
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
    html += '<a href="https://apps.apple.com/my/app/mamba-management/id6776478463" target="_blank" rel="noopener noreferrer" class="store-btn app-store">';
    html += '<div class="store-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z"/></svg></div>';
    html += '<div class="store-text"><span class="store-label">Download on the</span><span class="store-name">App Store</span></div>';
    html += '</a>';
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
        if (!hasRequestedIB()) {
          openIBRequiredPopup();
          return;
        }
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
    // New accounts default to 'pending' in the DB even before they request
    // anything — distinguish "never requested" from "requested, under review"
    var requested = !!(user.ib_email && user.ib_email.trim() !== '');
    var effective = status === 'approved' ? 'approved'
      : status === 'rejected' ? 'rejected'
      : requested ? 'pending' : 'none';

    var config = {
      approved: { icon: '&#10003;', text: 'IB VERIFIED', cls: 'approved' },
      pending:  { icon: '&#9203;', text: 'IB VERIFICATION PENDING', cls: 'pending' },
      rejected: { icon: '&#10007;', text: 'IB VERIFICATION REJECTED', cls: 'rejected' },
      none:     { icon: '&#9675;', text: 'IB NOT VERIFIED YET', cls: 'none' }
    };
    var cfg = config[effective];

    var html = '<div class="status-badge-lg ' + cfg.cls + '">';
    html += '<span class="badge-icon">' + cfg.icon + '</span>';
    html += '<span>' + cfg.text + '</span>';
    html += '</div>';

    if (effective !== 'approved') {
      html += '<div style="margin-top: 1rem;">';
      if (effective === 'rejected') {
        html += '<p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.75rem;">Your IB verification was not approved. You can re-request.</p>';
      } else if (effective === 'pending') {
        html += '<p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.75rem;">Your request is being reviewed. We\'ll verify your Valetax account shortly.</p>';
      } else {
        html += '<p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.75rem;">Request verification that you are under our IB network to unlock all features.</p>';
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
    showIBStepSelect();
    lockBodyScroll();
    document.getElementById('ibModal').classList.add('active');
  }

  function closeIBModal() {
    document.getElementById('ibModal').classList.remove('active');
    unlockBodyScroll();
  }

  function showIBStepSelect() {
    document.getElementById('ibStepSelect').style.display = 'block';
    document.getElementById('ibStepNew').style.display = 'none';
    document.getElementById('ibStepExisting').style.display = 'none';
    document.getElementById('ibModalTitle').textContent = 'Request IB Verification';
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
    }).catch(function() {
      showToast('Network error. Please try again.', 'error');
      submitBtns.forEach(function(b) { b.disabled = false; b.textContent = 'Submit IB Request'; });
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
    document.getElementById('cancelIBNew').addEventListener('click', showIBStepSelect);
    document.getElementById('cancelIBExisting').addEventListener('click', showIBStepSelect);

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

    // --- Carousel setup ---
    var carouselTrack = document.getElementById('ibCarouselTrack');
    var carouselDots = document.querySelectorAll('#ibCarouselDots .ib-carousel-dot');
    var carouselPrev = document.getElementById('ibCarouselPrev');
    var carouselNext = document.getElementById('ibCarouselNext');
    var carouselSlides = carouselTrack.querySelectorAll('.ib-carousel-slide');
    var totalSlides = carouselSlides.length;
    var currentSlide = 0;

    function goToSlide(n) {
      // Handle wrap-around
      currentSlide = ((n % totalSlides) + totalSlides) % totalSlides;
      // Move track
      carouselTrack.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
      // Sync carousel container height to current slide to avoid jerky resizing
      var carousel = carouselTrack.parentElement;
      var currentSlideEl = carouselSlides[currentSlide];
      carousel.style.minHeight = currentSlideEl.offsetHeight + 'px';
      // Update dots
      carouselDots.forEach(function(dot, i) {
        dot.classList.toggle('active', i === currentSlide);
      });
      // Show/hide arrows on slide 1 (hide prev since it wraps to last)
      // Always show both on slides 2 & 3
    }

    // Arrow clicks
    carouselPrev.addEventListener('click', function() { goToSlide(currentSlide - 1); });
    carouselNext.addEventListener('click', function() { goToSlide(currentSlide + 1); });

    // Dot clicks
    carouselDots.forEach(function(dot) {
      dot.addEventListener('click', function() {
        goToSlide(parseInt(dot.getAttribute('data-slide')));
      });
    });

    // Smooth touch/drag carousel with direction locking
    var dragStartX = 0;
    var dragStartY = 0;
    var isDragging = false;
    var dragLocked = null;        // null | 'horizontal' | 'vertical'
    var dragOffset = 0;
    var dragSafetyTimer = null;   // safety timeout against stuck state
    var DRAG_LOCK_RATIO = 1.5;    // dx must be > dy * 1.5 to lock horizontal
    var DRAG_LOCK_THRESHOLD = 10; // minimum px movement before locking axis
    var SAFETY_TIMEOUT_MS = 600;  // auto-reset drag if no touchend

    function startDrag(clientX, clientY) {
      isDragging = true;
      dragLocked = null;
      dragStartX = clientX;
      dragStartY = clientY;
      dragOffset = 0;
      carouselTrack.classList.add('dragging');
      clearTimeout(dragSafetyTimer);
      dragSafetyTimer = setTimeout(function() {
        if (isDragging) {
          isDragging = false;
          dragLocked = null;
          carouselTrack.classList.remove('dragging');
          carouselTrack.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
        }
      }, SAFETY_TIMEOUT_MS);
    }

    function moveDrag(clientX, clientY) {
      if (!isDragging) return;
      var dx = clientX - dragStartX;
      var dy = clientY - dragStartY;
      if (dragLocked === null) {
        if (Math.abs(dx) < DRAG_LOCK_THRESHOLD && Math.abs(dy) < DRAG_LOCK_THRESHOLD) return;
        if (Math.abs(dx) > Math.abs(dy) * DRAG_LOCK_RATIO) {
          dragLocked = 'horizontal';
        } else if (Math.abs(dy) > Math.abs(dx) * DRAG_LOCK_RATIO) {
          dragLocked = 'vertical';
          isDragging = false;
          carouselTrack.classList.remove('dragging');
          carouselTrack.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
          clearTimeout(dragSafetyTimer);
          return;
        }
        return;
      }
      if (dragLocked === 'horizontal') {
        dragOffset = dx;
        carouselTrack.style.transform = 'translateX(calc(-' + (currentSlide * 100) + '% + ' + dragOffset + 'px))';
      }
    }

    function endDrag() {
      clearTimeout(dragSafetyTimer);
      if (!isDragging) return;
      isDragging = false;
      dragLocked = null;
      carouselTrack.classList.remove('dragging');
      var threshold = carouselTrack.offsetWidth * 0.2;
      if (Math.abs(dragOffset) > threshold) {
        goToSlide(currentSlide + (dragOffset < 0 ? 1 : -1));
      } else {
        carouselTrack.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
      }
    }

    // Touch events — non-passive on touchmove so we can preventDefault during horizontal swipe
    carouselTrack.addEventListener('touchstart', function(e) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    carouselTrack.addEventListener('touchmove', function(e) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      if (dragLocked === 'horizontal') e.preventDefault();
    }, { passive: false });

    carouselTrack.addEventListener('touchend', endDrag);

    carouselTrack.addEventListener('touchcancel', function() {
      clearTimeout(dragSafetyTimer);
      if (isDragging) {
        isDragging = false;
        dragLocked = null;
        carouselTrack.classList.remove('dragging');
        carouselTrack.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
      }
    });

    // Mouse events (desktop drag)
    carouselTrack.addEventListener('mousedown', function(e) {
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', function(e) {
      moveDrag(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', function() {
      if (isDragging) endDrag();
    });

    // Copy buttons (mobile-friendly with iOS-safe fallback)
    carouselTrack.querySelectorAll('.ib-copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var text = btn.getAttribute('data-copy');

        function showCopied() {
          btn.classList.add('copied');
          var origHTML = btn.innerHTML;
          btn.innerHTML = '<span style="font-size:0.65rem;font-weight:700;">COPIED!</span>';
          setTimeout(function() {
            btn.classList.remove('copied');
            btn.innerHTML = origHTML;
          }, 1500);
        }

        // Primary: Clipboard API (requires HTTPS + secure context)
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function() {
            showCopied();
          }).catch(function() {
            fallbackCopy(text);
          });
        } else {
          fallbackCopy(text);
        }

        function fallbackCopy(text) {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.contentEditable = 'true';
          ta.readOnly = true;
          // iOS requires the textarea to be in-viewport (not hidden via opacity:0)
          ta.style.position = 'fixed';
          ta.style.top = '0';
          ta.style.left = '0';
          ta.style.width = '1px';
          ta.style.height = '1px';
          ta.style.padding = '0';
          ta.style.border = 'none';
          ta.style.outline = 'none';
          ta.style.boxShadow = 'none';
          ta.style.background = 'transparent';
          ta.style.color = 'transparent';
          document.body.appendChild(ta);
          // iOS needs focus before selection
          ta.focus();
          ta.select();
          ta.setSelectionRange(0, 999999);
          try {
            document.execCommand('copy');
          } catch (err) {
            // Last resort — select all text so user can manually copy
            ta.style.top = '10px';
            ta.style.left = '10px';
            ta.style.width = 'auto';
            ta.style.height = 'auto';
            ta.style.padding = '8px';
            ta.style.background = '#1C1C1E';
            ta.style.color = '#fff';
            ta.style.border = '2px solid var(--cyan-primary)';
            ta.style.borderRadius = '8px';
            ta.style.zIndex = '99999';
            ta.style.fontSize = '14px';
            ta.readOnly = false;
          }
          document.body.removeChild(ta);
          showCopied();
        }
      });
    });

    // Reset carousel to slide 1 when returning to selection screen or re-entering
    // Reset on the existing "Back" buttons that return to selection screen
    document.getElementById('cancelIBNew').addEventListener('click', function() { goToSlide(0); });
    document.getElementById('cancelIBExisting').addEventListener('click', function() { goToSlide(0); });
    // Reset on selecting the existing option
    document.getElementById('ibOptExisting').addEventListener('click', function() { goToSlide(0); });
  }

  // --- IB Required Modal ---
  function openIBRequiredPopup() {
    lockBodyScroll();
    document.getElementById('ibRequiredModal').classList.add('active');
  }

  function closeIBRequiredPopup() {
    document.getElementById('ibRequiredModal').classList.remove('active');
    unlockBodyScroll();
  }

  function setupIBRequiredPopup() {
    var modal = document.getElementById('ibRequiredModal');
    document.getElementById('ibRequiredCancel').addEventListener('click', closeIBRequiredPopup);
    document.getElementById('ibRequiredGoBtn').addEventListener('click', function() {
      closeIBRequiredPopup();
      openIBModal();
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeIBRequiredPopup();
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
        if (!hasRequestedIB()) {
          openIBRequiredPopup();
          return;
        }
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
        }).catch(function() {
          showToast('Network error. Please try again.', 'error');
          btn.disabled = false;
          btn.textContent = 'Request Whitelist';
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
      if (!hasRequestedIB()) {
        openIBRequiredPopup();
        return;
      }
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
      }).catch(function() {
        showToast('Network error. Please try again.', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Add';
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
      currentUser = result.data.user;
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
      lockBodyScroll();
      modal.classList.add('active');
    });

    cancelBtn.addEventListener('click', function() { modal.classList.remove('active'); unlockBodyScroll(); });
    modal.addEventListener('click', function(e) { if (e.target === modal) { modal.classList.remove('active'); unlockBodyScroll(); } });

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
          unlockBodyScroll();
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
    setupIBRequiredPopup();
    setupAddMT5();
    refreshDashboard();
  });
})();
