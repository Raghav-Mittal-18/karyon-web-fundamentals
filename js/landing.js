/* ============================================================
   KARYON — landing.js
   Marketing site behavior: 3D hero, scroll reveals, counters,
   auth modals wired to auth.js.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();

  initNavbarScroll();
  initThreeHero();
  initScrollReveal();
  initCounters();
  initWorkflowAnimation();
  initPageButtons();
  initModals();
  initAuthForms();

  const params = new URLSearchParams(window.location.search);
  if (params.get('auth') === 'required') {
    openModal('login-overlay');
    showFormError('login-error', 'Please log in to continue.');
  }
});

function initNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const apply = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 18);
  };

  apply();
  window.addEventListener('scroll', apply, { passive: true });
}


/* ---------------- NATIVE CANVAS HERO ---------------- */
function initThreeHero() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let animationId;

  const particles = [];
  const particleCount = 140;

  let mouseX = 0;
  let mouseY = 0;
  let rotation = 0;

  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  function resize() {
    const rect = canvas.getBoundingClientRect();

    width = rect.width;
    height = rect.height;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    particles.length = 0;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        size: Math.random() * 1.8 + 0.5,
        speed: Math.random() * 0.0008 + 0.0003
      });
    }
  }

  function drawParticles() {
    particles.forEach((particle) => {
      particle.y -= particle.speed;

      if (particle.y < 0) {
        particle.y = 1;
        particle.x = Math.random();
        particle.z = Math.random();
      }

      const x = particle.x * width;
      const y = particle.y * height;

      const alpha = 0.2 + particle.z * 0.5;

      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 138, 61, ${alpha})`;
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawWireframe() {
    const centerX = width * 0.72;
    const centerY = height * 0.5;

    const radius = Math.min(width, height) * 0.28;

    const sides = 10;
    const points = [];

    for (let i = 0; i < sides; i++) {
      const angle =
        (i / sides) * Math.PI * 2 +
        rotation;

      const depth =
        Math.sin(angle) * 0.5 + 0.5;

      const x =
        centerX +
        Math.cos(angle) * radius * (0.7 + depth * 0.3);

      const y =
        centerY +
        Math.sin(angle) * radius;

      points.push({
        x,
        y,
        depth
      });
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(226, 113, 46, 0.5)';

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];

      ctx.beginPath();
      ctx.moveTo(current.x, current.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }

    for (let i = 0; i < points.length; i++) {
      const current = points[i];

      for (let j = i + 2; j < points.length; j++) {
        const next = points[j];

        if (Math.random() > 0.35) continue;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(226, 113, 46, ${
          0.08 + current.depth * 0.12
        })`;

        ctx.moveTo(current.x, current.y);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
      }
    }

    // Inner geometric shape
    const innerRadius = radius * 0.55;

    ctx.beginPath();

    for (let i = 0; i <= sides; i++) {
      const angle =
        (i / sides) * Math.PI * 2 -
        rotation * 1.3;

      const x =
        centerX +
        Math.cos(angle) * innerRadius;

      const y =
        centerY +
        Math.sin(angle) * innerRadius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    drawParticles();
    drawWireframe();

    if (!reduceMotion) {
      rotation += 0.004;

      // Small mouse interaction
      const targetX = mouseX * 0.03;
      const targetY = mouseY * 0.03;

      ctx.translate(targetX, targetY);
      ctx.translate(-targetX, -targetY);

      animationId = requestAnimationFrame(draw);
    }
  }

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();

    mouseX =
      (event.clientX - rect.left) /
      rect.width -
      0.5;

    mouseY =
      (event.clientY - rect.top) /
      rect.height -
      0.5;
  });

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  resize();
  createParticles();
  draw();

  // Clean up animation when the page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId);
    } else if (!reduceMotion) {
      draw();
    }
  });
}

/* ---------------- SCROLL REVEAL ---------------- */
function initScrollReveal() {
  const items = document.querySelectorAll('.reveal:not(.in-view)');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in-view'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  items.forEach(el => io.observe(el));
}

function initWorkflowAnimation() {
  const rail = document.querySelector('.workflow-rail');
  if (!rail || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        rail.classList.add('is-visible');
      }
    });
  }, { threshold: 0.2 });

  observer.observe(rail);
}

/* ---------------- ANIMATED COUNTERS ---------------- */
function initCounters() {
  const projects = DB.getProjects().length;
  const tasks = DB.getTasks().length;
  animateCount(document.getElementById('stat-projects'), projects);
  animateCount(document.getElementById('stat-tasks'), tasks);
}

function animateCount(el, target) {
  if (!el) return;
  const duration = 900;
  const start = performance.now();

  function step(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * target);
    if (p < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function initPageButtons() {
  const finalSignup = document.getElementById('final-signup-btn');
  if (finalSignup) {
    finalSignup.addEventListener('click', () => openModal('signup-overlay'));
  }

  const exploreWorkflow = document.getElementById('explore-workflow-btn');
  if (exploreWorkflow) {
    exploreWorkflow.addEventListener('click', () => {
      const workflow = document.getElementById('workflow');
      if (workflow) {
        workflow.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

/* ---------------- MODALS ---------------- */
function openModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  closeAllModals();
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}

function initModals() {
  const navLogin = document.getElementById('nav-login-btn');
  if (navLogin) navLogin.addEventListener('click', () => openModal('login-overlay'));

  const navSignup = document.getElementById('nav-signup-btn');
  if (navSignup) navSignup.addEventListener('click', () => openModal('signup-overlay'));

  const heroSignup = document.getElementById('hero-signup-btn');
  if (heroSignup) heroSignup.addEventListener('click', () => openModal('signup-overlay'));

  const footerSignup = document.getElementById('footer-signup-btn');
  if (footerSignup) footerSignup.addEventListener('click', () => openModal('signup-overlay'));

  const heroArchive = document.getElementById('hero-archive-btn');
  if (heroArchive) {
    heroArchive.addEventListener('click', () => {
      if (Auth.isAuthed()) {
        window.location.href = 'dashboard.html#projects';
      } else {
        openModal('login-overlay');
      }
    });
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  const switchToSignup = document.getElementById('switch-to-signup');
  if (switchToSignup) {
    switchToSignup.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('signup-overlay');
    });
  }

  const switchToLogin = document.getElementById('switch-to-login');
  if (switchToLogin) {
    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('login-overlay');
    });
  }
}

/* ---------------- FORM HANDLING ---------------- */
function clearFieldErrors(prefix) {
  document.querySelectorAll(`[id^="err-${prefix}-"]`).forEach(el => {
    el.textContent = '';
  });
}

function showFormError(bannerId, msg) {
  const el = document.getElementById(bannerId);
  if (!el) return;
  el.innerHTML = msg ? `<div class="form-error-banner">${escapeHtml(msg)}</div>` : '';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function initAuthForms() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearFieldErrors('login');
      showFormError('login-error', '');

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const result = Auth.login({ email, password });

      if (!result.ok) {
        if (result.errors.form) showFormError('login-error', result.errors.form);
        Object.entries(result.errors).forEach(([k, v]) => {
          const el = document.getElementById(`err-login-${k}`);
          if (el) el.textContent = v;
        });
        return;
      }

      window.location.href = 'dashboard.html';
    });
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearFieldErrors('signup');
      showFormError('signup-error', '');

      const payload = {
        name: document.getElementById('signup-name').value.trim(),
        email: document.getElementById('signup-email').value.trim(),
        password: document.getElementById('signup-password').value,
        org: document.getElementById('signup-org').value.trim(),
        role: document.getElementById('signup-role').value
      };

      const result = Auth.signup(payload);
      if (!result.ok) {
        Object.entries(result.errors).forEach(([k, v]) => {
          const el = document.getElementById(`err-signup-${k}`);
          if (el) el.textContent = v;
        });
        return;
      }

      window.location.href = 'dashboard.html?welcome=1';
    });
  }
}
