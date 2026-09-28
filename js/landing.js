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

/* ---------------- THREE.JS HERO ---------------- */
function initThreeHero() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', resize);
  resize();

  const geo = new THREE.IcosahedronGeometry(3.1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xe2712e, wireframe: true, transparent: true, opacity: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(2.4, 0.4, 0);
  scene.add(mesh);

  const geo2 = new THREE.IcosahedronGeometry(2.2, 0);
  const mat2 = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.06 });
  const mesh2 = new THREE.Mesh(geo2, mat2);
  mesh2.position.copy(mesh.position);
  scene.add(mesh2);

  const particleCount = 140;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0xff8a3d, size: 0.035, transparent: true, opacity: 0.55 });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  let targetRotY = 0;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    targetRotY = mouseX * 0.25;
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animate() {
    if (!reduceMotion) {
      mesh.rotation.y += 0.0018;
      mesh.rotation.x += 0.0008;
      mesh2.rotation.y -= 0.001;
      mesh2.rotation.x += 0.0006;
      particles.rotation.y += 0.0004;

      mesh.rotation.y += (targetRotY - mesh.rotation.y) * 0.01;
      camera.position.x += (mouseX * 0.6 - camera.position.x) * 0.02;
      camera.position.y += (-mouseY * 0.3 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
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
