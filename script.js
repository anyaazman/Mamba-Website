// ==== MEMBER AREA PROMO POPUP ====
(function() {
    var overlay = document.getElementById('promoOverlay');
    var closeBtn = document.getElementById('promoClose');
    if (!overlay) return;

    // Show once per session
    if (sessionStorage.getItem('mamba_promo_shown')) return;
    sessionStorage.setItem('mamba_promo_shown', '1');

    // Show after loading screen (2.5s delay)
    window.addEventListener('load', function() {
        setTimeout(function() {
            overlay.classList.add('active');
        }, 2500);
    });

    closeBtn.addEventListener('click', function() {
        overlay.classList.remove('active');
    });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
})();

// ==== NEURAL TRADING MATRIX - INTERACTIVE EXPERIENCE ====

// ==== COMING SOON TOAST ====
function showComingSoon(event) {
    if (event) event.preventDefault();

    // Remove existing toast if any
    const existingToast = document.querySelector('.coming-soon-toast');
    if (existingToast) existingToast.remove();

    // Create toast
    const toast = document.createElement('div');
    toast.className = 'coming-soon-toast';
    toast.textContent = 'Coming Soon';
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 10);

    // Hide and remove after 700ms
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 700);
}

// ==== LOADING SCREEN SYSTEM ====
function hideLoadingScreen() {
    const loadingScreen = document.querySelector('.loading-screen');
    const body = document.body;

    if (!loadingScreen) return;

    console.log('Hiding loading screen...');

    // Add loaded class to fade out loading screen
    loadingScreen.classList.add('loaded');

    // Add page-loaded class to body to show content
    body.classList.add('page-loaded');

    // Remove loading screen from DOM after transition
    setTimeout(() => {
        if (loadingScreen && loadingScreen.parentNode) {
            loadingScreen.remove();
        }
    }, 1000);
}

// Multiple fallback mechanisms to ensure loading screen disappears
let loadingHidden = false;

// Method 1: DOMContentLoaded (fastest - when HTML is parsed)
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    if (!loadingHidden) {
        setTimeout(() => {
            if (!loadingHidden) {
                hideLoadingScreen();
                loadingHidden = true;
            }
        }, 800); // Minimum display time
    }
    initializeNeuralMatrix();
});

// Method 2: window.load (when all resources are loaded)
window.addEventListener('load', function() {
    console.log('Window Load Event');
    if (!loadingHidden) {
        setTimeout(() => {
            if (!loadingHidden) {
                hideLoadingScreen();
                loadingHidden = true;
            }
        }, 500);
    }
});

// Method 3: Absolute failsafe - force hide after 3 seconds
setTimeout(() => {
    if (!loadingHidden) {
        console.log('Failsafe: Forcing loading screen to hide');
        hideLoadingScreen();
        loadingHidden = true;
    }
}, 3000);

function initializeNeuralMatrix() {
    // Initialize all systems
    initNavigationSystem();
    initHeroAnimations();
    initScrollRevealSystem();
    initFormSystem();
    initInteractiveLogo();
    initFeatureVideos(); // Changed: Videos play without WebP transition
    initCenterViewportAnimations();
    initMobileVideoFix();
    // initCard3DTilt(); // disabled - tilt removed
}

// ==== NAVIGATION SYSTEM ====
function initNavigationSystem() {
    const burger = document.querySelector('.burger');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-links a');

    // Only add burger menu listeners if elements exist
    if (burger && navLinks) {
        burger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            burger.classList.toggle('active');

            // Animate burger lines
            const spans = burger.querySelectorAll('span');
            spans.forEach((span, index) => {
                if (burger.classList.contains('active')) {
                    if (index === 0) span.style.transform = 'rotate(45deg) translate(5px, 5px)';
                    if (index === 1) span.style.opacity = '0';
                    if (index === 2) span.style.transform = 'rotate(-45deg) translate(7px, -6px)';
                } else {
                    span.style.transform = 'none';
                    span.style.opacity = '1';
                }
            });
        });
    }

    // Smooth scrolling with parallax effect
    if (navItems.length > 0) {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('href');
                const targetSection = document.querySelector(targetId);

                if (targetSection) {
                    const headerHeight = document.querySelector('.header').offsetHeight;
                    const targetPosition = targetSection.offsetTop - headerHeight;

                    // Close mobile menu
                    if (navLinks && burger) {
                        navLinks.classList.remove('active');
                        burger.classList.remove('active');
                    }

                    // Smooth scroll with easing
                    smoothScrollTo(targetPosition, 1000);

                    // Add glitch effect to clicked nav item
                    createGlitchEffect(item);
                }
            });
        });
    }

    // Header scroll effect
    const header = document.querySelector('.header');

    if (header) {
        let lastScrollY = window.scrollY;
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;

                    // Hide/show header based on scroll direction
                    if (currentScrollY > lastScrollY && currentScrollY > 200) {
                        header.classList.add('hidden');
                    } else {
                        header.classList.remove('hidden');
                    }

                    lastScrollY = currentScrollY;
                    ticking = false;
                });

                ticking = true;
            }
        });
    }
}

// ==== HERO ANIMATIONS ====
function initHeroAnimations() {
    // Typewriter effect for hero title
    const titleLines = document.querySelectorAll('.title-line');

    titleLines.forEach((line, index) => {
        const text = line.textContent;
        line.textContent = '';
        line.style.opacity = '1';

        setTimeout(() => {
            typeWriter(line, text, 50);
        }, index * 800);
    });

    // Animated metrics counters
    const metrics = document.querySelectorAll('.metric-value');

    const observerMetrics = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
            }
        });
    }, { threshold: 0.5 });

    metrics.forEach(metric => {
        observerMetrics.observe(metric);
    });

    // CTA button interactions
    const ctaPrimary = document.querySelector('.cta-primary');
    const ctaSecondary = document.querySelector('.cta-secondary');

    if (ctaPrimary) {
        ctaPrimary.addEventListener('click', () => {
            createRippleEffect(ctaPrimary, '#39ff14');
            // Scroll to access section
            const accessSection = document.querySelector('#access');
            if (accessSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                smoothScrollTo(accessSection.offsetTop - headerHeight, 1000);
            }
        });
    }

    if (ctaSecondary) {
        ctaSecondary.addEventListener('click', () => {
            createRippleEffect(ctaSecondary, '#00ffff');
            // Create modal for demo video
            createDemoModal();
        });
    }
}

// ==== SCROLL REVEAL SYSTEM ====
function initScrollRevealSystem() {
    // Updated to target elements that actually exist in HTML
    const revealElements = document.querySelectorAll('.step-card, .scenario-card, .card');

    if (revealElements.length === 0) {
        console.log('No reveal elements found, skipping scroll reveal system');
        return;
    }

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0) rotateX(0)';
                    createDataStream(entry.target);
                }, index * 100);

                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(50px) rotateX(10deg)';
        element.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        revealObserver.observe(element);
    });
}

// ==== FORM SYSTEM ====
function initFormSystem() {
    const form = document.querySelector('.form'); // Fixed: was .neural-form, now matches HTML
    const inputs = document.querySelectorAll('.form-group input, .form-group select, .form-group textarea');

    // Input focus effects
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            const formGroup = input.closest('.form-group');
            if (formGroup) {
                createInputScanEffect(formGroup);
            }
        });

        input.addEventListener('input', () => {
            if (input.value) {
                input.style.borderColor = '#39ff14';
                input.style.boxShadow = '0 0 10px rgba(57, 255, 20, 0.3)';
            } else {
                input.style.borderColor = '#30363d';
                input.style.boxShadow = 'none';
            }
        });
    });

    // Form submission
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('.submit-btn');
            const formData = new FormData(form);

            // Validate required fields
            const requiredFields = form.querySelectorAll('[required]');
            let isValid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    createErrorEffect(field);
                }
            });

            if (isValid) {
                // Create success animation
                createNeuralSubmissionEffect(submitBtn, () => {
                    showSuccessModal();
                    form.reset();
                });
            } else {
                createFormErrorEffect(form);
            }
        });
    }
}

// ==== UTILITY FUNCTIONS ====

function smoothScrollTo(target, duration) {
    const start = window.pageYOffset;
    const distance = target - start;
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = easeInOutCubic(timeElapsed, start, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    requestAnimationFrame(animation);
}

function easeInOutCubic(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t * t + b;
    t -= 2;
    return c / 2 * (t * t * t + 2) + b;
}

function typeWriter(element, text, speed) {
    let i = 0;
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

function animateCounter(element) {
    const target = element.textContent;
    const isNumber = /^\d/.test(target);

    if (isNumber) {
        const finalValue = parseFloat(target.replace(/[^\d.]/g, ''));
        let current = 0;
        const increment = finalValue / 60;
        const timer = setInterval(() => {
            current += increment;
            if (current >= finalValue) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = target.replace(/[\d.]+/, current.toFixed(target.includes('.') ? 3 : 0));
            }
        }, 16);
    }
}

function createRippleEffect(element, color) {
    const ripple = document.createElement('div');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: radial-gradient(circle, ${color} 0%, transparent 70%);
        transform: scale(0);
        animation: ripple 0.6s linear;
        width: ${size}px;
        height: ${size}px;
        left: 50%;
        top: 50%;
        transform-origin: center;
        pointer-events: none;
    `;

    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
}

function createGlitchEffect(element) {
    element.style.animation = 'glitch 0.3s ease-in-out';
    setTimeout(() => element.style.animation = '', 300);
}

function createDataStream(element) {
    const stream = document.createElement('div');
    stream.style.cssText = `
        position: absolute;
        width: 2px;
        height: 100px;
        background: linear-gradient(to bottom, transparent, #00ffff, transparent);
        left: ${Math.random() * 100}%;
        top: -100px;
        animation: dataStream 2s ease-out;
        pointer-events: none;
    `;

    element.style.position = 'relative';
    element.appendChild(stream);

    setTimeout(() => stream.remove(), 2000);
}

function createScanEffect(element) {
    const scan = document.createElement('div');
    scan.style.cssText = `
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.3), transparent);
        animation: scan 0.5s ease-out;
        pointer-events: none;
    `;

    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(scan);

    setTimeout(() => scan.remove(), 500);
}

function createInputScanEffect(formGroup) {
    const scan = document.createElement('div');
    scan.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, transparent, #00ffff, transparent);
        animation: inputScan 1s ease-out;
        pointer-events: none;
    `;

    formGroup.appendChild(scan);
    setTimeout(() => scan.remove(), 1000);
}

function createErrorEffect(field) {
    field.style.borderColor = '#ff6b6b';
    field.style.boxShadow = '0 0 10px rgba(255, 107, 107, 0.5)';
    field.style.animation = 'shake 0.5s ease-in-out';

    setTimeout(() => {
        field.style.animation = '';
    }, 500);
}

function createNeuralSubmissionEffect(button, callback) {
    button.style.background = 'linear-gradient(135deg, #39ff14 0%, #00ffff 100%)';
    button.innerHTML = '<span>PROCESSING...</span>';
    button.disabled = true;

    // Create loading particles
    const particles = [];
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 3px;
            height: 3px;
            background: #fff;
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: particleFloat 2s ease-out;
            pointer-events: none;
        `;
        button.appendChild(particle);
        particles.push(particle);
    }

    setTimeout(() => {
        particles.forEach(p => p.remove());
        button.innerHTML = '<span>ACCESS GRANTED</span>';
        button.style.background = 'linear-gradient(135deg, #39ff14 0%, #39ff14 100%)';

        setTimeout(() => {
            callback();
            button.disabled = false;
            button.innerHTML = '<span>INITIATE ACCESS PROTOCOL</span>';
            button.style.background = '';
        }, 1500);
    }, 2000);
}

function createFormErrorEffect(form) {
    form.style.animation = 'formError 0.5s ease-in-out';
    setTimeout(() => form.style.animation = '', 500);
}

function showSuccessModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: modalFadeIn 0.3s ease-out;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: #161b22;
        border: 2px solid #00ffff;
        border-radius: 16px;
        padding: 3rem;
        text-align: center;
        max-width: 500px;
        box-shadow: 0 0 50px rgba(0, 255, 255, 0.5);
    `;

    content.innerHTML = `
        <div style="font-size: 4rem; margin-bottom: 1rem;">🚀</div>
        <h3 style="color: #39ff14; font-size: 1.5rem; margin-bottom: 1rem; text-transform: uppercase;">NEURAL ACCESS INITIATED</h3>
        <p style="color: #c9d1d9; margin-bottom: 2rem;">Welcome to the future of algorithmic trading. Your neural link has been established.</p>
        <button onclick="this.closest('.modal').remove()" style="
            background: linear-gradient(135deg, #39ff14 0%, #00ffff 100%);
            color: #0a0a0a;
            border: none;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: bold;
            text-transform: uppercase;
            cursor: pointer;
        ">ENTER THE MATRIX</button>
    `;

    modal.className = 'modal';
    modal.appendChild(content);
    document.body.appendChild(modal);

    // Auto close after 5 seconds
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 5000);
}

function createDemoModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: modalFadeIn 0.3s ease-out;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: #161b22;
        border: 2px solid #00ffff;
        border-radius: 16px;
        padding: 3rem;
        text-align: center;
        max-width: 600px;
        box-shadow: 0 0 50px rgba(0, 255, 255, 0.5);
    `;

    content.innerHTML = `
        <h3 style="color: #00ffff; font-size: 2rem; margin-bottom: 2rem; text-transform: uppercase;">NEURAL DEMO PROTOCOL</h3>
        <div style="background: #0a0a0a; border: 1px solid #30363d; border-radius: 8px; padding: 2rem; margin-bottom: 2rem;">
            <div style="color: #39ff14; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; line-height: 1.6;">
                > Initializing neural trading matrix...<br>
                > Connecting to quantum servers...<br>
                > Loading algorithmic protocols...<br>
                > Demo ready for deployment.<br><br>
                <span style="color: #00ffff;">[SYSTEM]: Demo will be available in the next release cycle.</span>
            </div>
        </div>
        <button onclick="this.closest('.modal').remove()" style="
            background: linear-gradient(135deg, #00ffff 0%, #39ff14 100%);
            color: #0a0a0a;
            border: none;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: bold;
            text-transform: uppercase;
            cursor: pointer;
            margin-right: 1rem;
        ">UNDERSTOOD</button>
        <button onclick="this.closest('.modal').remove(); document.querySelector('#access').scrollIntoView();" style="
            background: transparent;
            color: #00ffff;
            border: 2px solid #00ffff;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: bold;
            text-transform: uppercase;
            cursor: pointer;
        ">REQUEST EARLY ACCESS</button>
    `;

    modal.className = 'modal';
    modal.appendChild(content);
    document.body.appendChild(modal);
}

// ==== CSS ANIMATIONS VIA JAVASCRIPT ====
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    @keyframes glitch {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-2px); }
        40% { transform: translateX(2px); }
        60% { transform: translateX(-2px); }
        80% { transform: translateX(2px); }
    }

    @keyframes dataStream {
        0% { transform: translateY(0); opacity: 0; }
        50% { opacity: 1; }
        100% { transform: translateY(200px); opacity: 0; }
    }

    @keyframes scan {
        0% { left: -100%; }
        100% { left: 100%; }
    }

    @keyframes tradePopup {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1) translateY(-50px); opacity: 0; }
    }

    @keyframes dataLine {
        0% { opacity: 0; transform: rotate(var(--angle)) scaleX(0); }
        50% { opacity: 1; }
        100% { opacity: 0; transform: rotate(var(--angle)) scaleX(1); }
    }

    @keyframes nodePulseExpand {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
    }

    @keyframes hologramParticle {
        0% { transform: translate(-50%, -50%) rotate(0deg) translateX(50px) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg) translateX(50px) rotate(-360deg); }
    }

    @keyframes inputScan {
        0% { transform: scaleX(0); }
        100% { transform: scaleX(1); }
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }

    @keyframes particleFloat {
        0% { transform: translateY(0) scale(0); opacity: 0; }
        50% { opacity: 1; }
        100% { transform: translateY(-50px) scale(1); opacity: 0; }
    }

    @keyframes formError {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }

    @keyframes modalFadeIn {
        0% { opacity: 0; transform: scale(0.8); }
        100% { opacity: 1; transform: scale(1); }
    }

    @keyframes securityScan {
        0% { box-shadow: inset 0 0 0 rgba(57, 255, 20, 0.1); }
        50% { box-shadow: inset 0 0 20px rgba(57, 255, 20, 0.3); }
        100% { box-shadow: inset 0 0 0 rgba(57, 255, 20, 0.1); }
    }
`;

document.head.appendChild(styleSheet);

// ==== INTERACTIVE LOGO SYSTEM ====
// Store interval ID for cleanup
let logoAnimationInterval = null;

function initInteractiveLogo() {
    const logo = document.querySelector('.interactive-logo');
    const logoSymbol = document.querySelector('.logo-symbol');
    const centerDot = document.querySelector('.center-dot');

    // Return early if elements don't exist - this is expected on most pages
    if (!logo) {
        console.log('Interactive logo not found, skipping logo animations');
        return;
    }

    let isAnimating = false;
    let mouseX = 0;
    let mouseY = 0;

    // Enhanced mouse tracking for 3D effects
    logo.addEventListener('mousemove', (e) => {
        const rect = logo.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        mouseX = (e.clientX - centerX) / rect.width;
        mouseY = (e.clientY - centerY) / rect.height;

        // Apply subtle 3D rotation based on mouse position
        const rotateX = mouseY * 10;
        const rotateY = mouseX * 10;

        if (logoSymbol) {
            logoSymbol.style.transform = `translate(200px, 90px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        }
    });

    // Reset transform on mouse leave
    logo.addEventListener('mouseleave', () => {
        if (logoSymbol) {
            logoSymbol.style.transform = 'translate(200px, 90px)';
        }
    });

    // Advanced click effects
    logo.addEventListener('click', () => {
        if (isAnimating) return;
        isAnimating = true;

        // Trigger advanced glitch effect
        logo.classList.add('glitch-active');

        // Create energy burst effect
        createEnergyBurst(logo);

        // Reset after animation
        setTimeout(() => {
            logo.classList.remove('glitch-active');
            isAnimating = false;
        }, 600);
    });

    // Periodic subtle animations - stored for potential cleanup
    logoAnimationInterval = setInterval(() => {
        if (!isAnimating && centerDot) {
            centerDot.style.animationDuration = `${0.8 + Math.random() * 0.4}s`;
        }
    }, 3000);
}

// Create energy burst effect
function createEnergyBurst(element) {
    const burst = document.createElement('div');
    burst.className = 'energy-burst';
    burst.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100px;
        height: 100px;
        margin: -50px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0,255,255,0.3) 0%, rgba(57,255,20,0.2) 50%, transparent 70%);
        animation: energyExpand 0.6s ease-out forwards;
        pointer-events: none;
        z-index: 10;
    `;

    element.style.position = 'relative';
    element.appendChild(burst);

    // Remove after animation
    setTimeout(() => {
        if (burst.parentNode) {
            burst.parentNode.removeChild(burst);
        }
    }, 600);
}

// Add energy burst animation styles
const energyStyles = document.createElement('style');
energyStyles.textContent = `
    @keyframes energyExpand {
        0% {
            transform: scale(0);
            opacity: 1;
        }
        100% {
            transform: scale(3);
            opacity: 0;
        }
    }

    .glitch-active .mamba-logo {
        animation: logoAdvancedGlitch 0.6s ease-out !important;
    }

    @keyframes logoAdvancedGlitch {
        0% { transform: scale(1.1) rotateY(15deg); filter: none; }
        10% { transform: scale(1.2) rotateY(15deg) translateX(2px); filter: hue-rotate(90deg) saturate(150%); }
        20% { transform: scale(1.15) rotateY(15deg) translateX(-2px); filter: hue-rotate(180deg) contrast(120%); }
        30% { transform: scale(1.25) rotateY(15deg) translateY(1px); filter: hue-rotate(270deg) brightness(130%); }
        40% { transform: scale(1.1) rotateY(15deg) translateY(-1px); filter: hue-rotate(360deg) blur(0.5px); }
        50% { transform: scale(1.2) rotateY(15deg) skew(1deg); filter: invert(20%) sepia(100%); }
        60% { transform: scale(1.15) rotateY(15deg) skew(-1deg); filter: contrast(150%) saturate(200%); }
        80% { transform: scale(1.1) rotateY(15deg); filter: hue-rotate(45deg); }
        100% { transform: scale(1.1) rotateY(15deg); filter: none; }
    }
`;

document.head.appendChild(energyStyles);

// ==== CENTER VIEWPORT ANIMATIONS ====
function initCenterViewportAnimations() {
    // Center viewport indicator disabled (removed visual cursor on mobile)
    // createCenterIndicator();

    // Detect if mobile
    const isMobile = window.innerWidth <= 768;

    // Target elements that should animate when reaching viewport center
    // Note: .feature-animation excluded because videos are handled by initGifToWebpTransition()
    // Note: .feature-block with videos excluded to prevent hiding video containers
    const animateOnScroll = document.querySelectorAll('.card, .scenario-card, .step-card, .iphone-mockup img, .iphone-mockup picture');

    // Add initial hidden state (but not on first load for hero)
    animateOnScroll.forEach(element => {
        // Skip feature blocks, mobile previews, and videos - they should never be hidden
        if (element.closest('.features-clean')) return;

        // Don't hide elements that are already in viewport on load
        const rect = element.getBoundingClientRect();
        if (rect.top > window.innerHeight) {
            element.classList.add('scroll-hidden');
        }
    });

    // Different settings for mobile vs desktop
    const observerOptions = {
        root: null,
        // Mobile: gentler trigger zone for smoother transitions
        rootMargin: isMobile ? '-20% 0px -20% 0px' : '-40% 0px -40% 0px',
        threshold: isMobile ? [0, 0.1, 0.25, 0.5, 0.75] : 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // Skip elements inside features-clean section
            if (entry.target.closest('.features-clean')) return;

            if (entry.isIntersecting) {
                // Smoother transition - no delay to prevent jank
                entry.target.classList.add('scroll-visible');
                entry.target.classList.remove('scroll-hidden');

                // Add center-focused effect with slight delay for smoothness
                setTimeout(() => {
                    entry.target.classList.add('center-focused');
                }, 100);

                // Optional: Unobserve after animation (comment out for repeating animations)
                // observer.unobserve(entry.target);
            } else {
                // Gentle removal for smooth exit
                entry.target.classList.remove('center-focused');

                // Delay hiding to prevent abrupt disappearance
                setTimeout(() => {
                    if (!entry.isIntersecting) {
                        entry.target.classList.remove('scroll-visible');
                        entry.target.classList.add('scroll-hidden');
                    }
                }, 50);
            }
        });
    }, observerOptions);

    // Observe all target elements
    animateOnScroll.forEach(element => {
        observer.observe(element);
    });
}

// Create center viewport indicator
function createCenterIndicator() {
    // Only show on mobile/tablet devices
    if (window.innerWidth > 1024) return;

    const indicator = document.createElement('div');
    indicator.className = 'center-viewport-indicator';
    indicator.innerHTML = `
        <div class="indicator-pulse"></div>
        <div class="indicator-ring"></div>
        <div class="indicator-dot"></div>
    `;
    document.body.appendChild(indicator);

    // Update position on resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            indicator.style.display = 'none';
        } else {
            indicator.style.display = 'flex';
        }
    });
}

// Pulse center indicator when element enters
function pulseCenterIndicator() {
    const indicator = document.querySelector('.center-viewport-indicator');
    if (!indicator) return;

    indicator.classList.add('pulse-active');
    setTimeout(() => {
        indicator.classList.remove('pulse-active');
    }, 600);
}

// ==== CARD 3D AUTO-TILT ====
function initCard3DTilt() {
    const cards = document.querySelectorAll('.card-3d');
    const isMobile = window.innerWidth <= 768;

    cards.forEach(card => {
        if (!isMobile) {
            // Desktop: Mouse-based tilt
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const mouseX = (e.clientX - centerX) / rect.width;
                const mouseY = (e.clientY - centerY) / rect.height;

                // Apply 3D rotation based on mouse position
                const rotateX = mouseY * -15; // Negative for natural tilt
                const rotateY = mouseX * 15;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            });

            // Reset on mouse leave
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(8deg) rotateZ(-3deg)';
            });
        } else {
            // Mobile: Auto-tilt animation when in view
            const observerOptions = {
                root: null,
                rootMargin: '0px',
                threshold: 0.3
            };

            const tiltObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Add subtle auto-tilt animation class
                        entry.target.classList.add('auto-tilt-active');
                    } else {
                        entry.target.classList.remove('auto-tilt-active');
                    }
                });
            }, observerOptions);

            tiltObserver.observe(card);
        }
    });
}

// ==== FEATURE VIDEOS (PLAY ONCE AND STOP) ====
function initFeatureVideos() {
    // Prevent multiple initializations
    if (window.featureVideosInitialized) {
        console.log('initFeatureVideos already initialized, skipping');
        return;
    }
    window.featureVideosInitialized = true;
    console.log('Initializing feature videos (play once then stop)');

    // Handle feature videos - play once then stop on last frame
    const featureVideos = document.querySelectorAll('.video-to-webp');
    console.log(`Found ${featureVideos.length} videos to manage`);

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const video = entry.target;

                console.log('Video entered viewport:', video.src);

                // Force video attributes (critical for mobile)
                video.muted = true;
                video.playsInline = true;
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', '');
                // Respect loop attribute if set in HTML, otherwise disable
                if (!video.hasAttribute('loop')) {
                    video.loop = false; // Disable loop - play once only
                }
                video.removeAttribute('controls'); // Remove any controls

                // Force visibility on mobile
                video.style.opacity = '1';
                video.style.visibility = 'visible';
                video.style.display = 'block';

                // Aggressive play attempt with retry limit
                let retryCount = 0;
                const maxRetries = 10; // Maximum 10 retries (1 second total)

                const tryPlay = () => {
                    if (retryCount >= maxRetries) {
                        console.log('Max retries reached for video, stopping');
                        return;
                    }
                    retryCount++;
                    console.log('Attempting to play video, readyState:', video.readyState, 'retry:', retryCount);
                    video.play()
                        .then(() => {
                            console.log('Video playing successfully');
                        })
                        .catch(err => {
                            console.log('Feature video autoplay blocked:', err.name);
                            // Try again after short delay
                            setTimeout(tryPlay, 100);
                        });
                };

                // Try to play when in viewport
                if (video.readyState >= 2) {
                    tryPlay();
                } else {
                    video.addEventListener('loadeddata', tryPlay, { once: true });
                    video.addEventListener('canplay', tryPlay, { once: true });
                }

                // Stop observing after first play attempt
                videoObserver.unobserve(video);
            }
        });
    }, observerOptions);

    featureVideos.forEach((video, index) => {
        // Check if this video already has observer attached
        if (video.dataset.observerAttached === 'true') {
            console.log(`Video ${index + 1} already has observer, skipping`);
            return;
        }
        video.dataset.observerAttached = 'true';
        console.log(`Setting up video ${index + 1} for autoplay`);

        // Pre-set mobile-friendly attributes
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'auto';

        // Force visibility immediately (mobile fix)
        video.style.opacity = '1';
        video.style.visibility = 'visible';
        video.style.display = 'block';
        video.style.transform = 'none';

        console.log(`Video ${index + 1} attributes set, starting observation`);

        videoObserver.observe(video);

        // Add ended event listener only for non-looping videos
        if (!video.hasAttribute('loop')) {
            video.addEventListener('ended', function() {
                console.log(`Video ${index + 1} finished playing, staying on last frame`);
                // Video will naturally stop and show last frame
                // No need to do anything - just let it stay visible
            }, { once: true });
        }

        // Mobile-specific: Try to load video immediately
        if (video.readyState < 2) {
            video.load();
            console.log(`Video ${index + 1} load() called`);
        }
    });
}

// ==== MOBILE VIDEO FIX ====
function initMobileVideoFix() {
    const heroVideo = document.querySelector('video.hero-animation');

    if (!heroVideo) {
        console.log('Hero video element not found');
        return;
    }

    // Set important mobile attributes programmatically
    heroVideo.setAttribute('playsinline', 'true');
    heroVideo.setAttribute('webkit-playsinline', 'true');
    heroVideo.muted = true;
    heroVideo.defaultMuted = true;
    heroVideo.volume = 0;

    // Force load
    heroVideo.load();

    // Check readyState after load and try fallback if needed
    setTimeout(() => {
        if (heroVideo.readyState === 0) {
            const sourceElement = heroVideo.querySelector('source');
            if (sourceElement) {
                const sourceSrc = sourceElement.getAttribute('src');
                heroVideo.src = sourceSrc;
                heroVideo.load();

                setTimeout(() => {
                    if (heroVideo.readyState === 0) {
                        heroVideo.src = decodeURIComponent(sourceSrc);
                        heroVideo.load();
                    }
                }, 500);
            }
        }
    }, 1000);

    // Simple play function
    const attemptPlay = () => {
        const promise = heroVideo.play();
        if (promise !== undefined) {
            promise.catch(err => {
                // Silently handle autoplay block - user interaction will trigger play
            });
        }
    };

    // Multiple play attempts with delays
    attemptPlay();
    setTimeout(() => attemptPlay(), 100);
    setTimeout(() => attemptPlay(), 500);

    // Play when ready
    if (heroVideo.readyState >= 2) {
        setTimeout(() => attemptPlay(), 100);
        setTimeout(() => attemptPlay(), 300);
    } else {
        heroVideo.addEventListener('loadedmetadata', () => {
            attemptPlay();
            setTimeout(() => attemptPlay(), 50);
        });

        heroVideo.addEventListener('loadeddata', () => {
            attemptPlay();
            setTimeout(() => attemptPlay(), 50);
        });

        heroVideo.addEventListener('canplay', () => {
            attemptPlay();
            setTimeout(() => attemptPlay(), 50);
        });

        heroVideo.addEventListener('canplaythrough', () => {
            attemptPlay();
        });
    }

    // User interaction fallback
    const userInteractionEvents = ['touchstart', 'touchmove', 'touchend', 'click', 'scroll', 'mousemove'];
    let hasPlayedFromInteraction = false;

    userInteractionEvents.forEach(eventName => {
        document.addEventListener(eventName, () => {
            if (!hasPlayedFromInteraction && heroVideo.paused) {
                attemptPlay();
                hasPlayedFromInteraction = true;
            }
        }, { once: true, passive: true });
    });

    // Handle errors
    heroVideo.addEventListener('error', () => {
        const errorCode = heroVideo.error?.code;

        // Handle unsupported format (Error code 4)
        if (errorCode === 4) {
            heroVideo.style.display = 'none';

            // Create fallback image if poster doesn't show
            const fallbackImg = document.createElement('img');
            fallbackImg.src = 'web-files/2/iphone-spin-up-1.webp';
            fallbackImg.alt = 'Mamba Trading App';
            fallbackImg.className = 'hero-animation';
            fallbackImg.style.cssText = 'width: 100%; max-width: 600px; height: auto; border-radius: 20px; display: block;';

            const videoContainer = heroVideo.parentElement;
            if (!videoContainer.querySelector('img.hero-animation')) {
                videoContainer.appendChild(fallbackImg);
            }
        }
    });

    // Ensure video loops properly
    heroVideo.addEventListener('ended', () => {
        heroVideo.currentTime = 0;
        heroVideo.play().catch(() => {});
    });

    // Keep playing when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && heroVideo.paused) {
            heroVideo.play().catch(() => {});
        }
    });

    // Safety check: if video pauses unexpectedly, try to resume
    heroVideo.addEventListener('pause', () => {
        if (!heroVideo.ended && document.visibilityState === 'visible') {
            setTimeout(() => {
                if (heroVideo.paused) {
                    heroVideo.play().catch(() => {});
                }
            }, 100);
        }
    });
}

// ==== FLOATING TELEGRAM BUTTON ====
(function() {
    const fab = document.getElementById('telegramFab');
    const menu = document.getElementById('telegramMenu');

    if (!fab || !menu) return;

    // Pop in after page loads, auto-open menu, then close
    window.addEventListener('load', () => {
        setTimeout(() => {
            fab.classList.add('pop-in');

            // Auto-open menu after pop-in finishes
            setTimeout(() => {
                fab.classList.add('active');
                menu.classList.add('open');

                // Auto-close menu after 3 seconds
                setTimeout(() => {
                    fab.classList.remove('active');
                    menu.classList.remove('open');
                }, 3000);
            }, 600);
        }, 800);
    });

    fab.addEventListener('click', () => {
        fab.classList.toggle('active');
        menu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.floating-telegram')) {
            fab.classList.remove('active');
            menu.classList.remove('open');
        }
    });
})();