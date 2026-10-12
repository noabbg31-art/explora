// ─────────────────────────────────────────────────────────────
// app.js — le JS du front (single-page app sans framework)
// Rôle : lire l'URL, appeler l'API, afficher la bonne vue,
//        gérer l'autocomplétion de la barre de recherche,
//        le thème clair/sombre et les effets de curseur.
// ─────────────────────────────────────────────────────────────
const app = document.getElementById('app');

// Petit helper pour appeler l'API Node
async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

// ── Thème clair / sombre ────────────────────────────────────
// Respecte le réglage système par défaut, mais l'utilisateur peut
// forcer un choix, mémorisé dans localStorage.
function setupTheme() {
  const saved = localStorage.getItem('explora-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const current = document.documentElement.getAttribute('data-theme') || (prefersDark ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('explora-theme', next);
  });
}

// ── Curseur animé + explosion de particules au clic ──────────
// Désactivé si l'utilisateur préfère moins d'animations, ou sur
// un écran tactile (pas de vraie souris à suivre).
function setupCursorFx() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (reduceMotion || !finePointer) return;

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  document.body.append(dot, ring);

  const canvas = document.createElement('canvas');
  canvas.id = 'fx-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // clientWidth/Height (pas innerWidth/innerHeight, qui incluent la scrollbar
  // et provoqueraient un léger débordement horizontal du canvas fixed)
  let cw = document.documentElement.clientWidth;
  let ch = document.documentElement.clientHeight;
  function resize() {
    cw = document.documentElement.clientWidth;
    ch = document.documentElement.clientHeight;
    canvas.width = cw * devicePixelRatio;
    canvas.height = ch * devicePixelRatio;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // Position réelle du pointeur, et position "retardée" de l'anneau
  let mx = cw / 2, my = ch / 2;
  let rx = mx, ry = my;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  });

  // L'anneau grossit au survol d'un élément cliquable
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, li, input')) ring.classList.add('is-hover');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, li, input')) ring.classList.remove('is-hover');
  });
  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity = '';
    ring.style.opacity = '';
  });

  // Rattrapage en douceur (lerp) : l'anneau suit le curseur avec un léger retard
  (function trail() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(trail);
  })();

  // ── Particules ──
  let particles = [];
  let running = false;

  function burst(x, y) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e2572b';
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 2.2 + Math.random() * 3.4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        size: 2 + Math.random() * 3,
        color: accent,
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function tick() {
    ctx.clearRect(0, 0, cw, ch);
    particles.forEach((p) => {
      p.vy += 0.09;   // petite gravité
      p.vx *= 0.98;   // frottement
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
    });
    particles = particles.filter((p) => p.life > 0);
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(p.size * p.life, 0), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (particles.length) requestAnimationFrame(tick);
    else running = false;
  }

  document.addEventListener('mousedown', (e) => {
    ring.classList.add('is-down');
    burst(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', () => ring.classList.remove('is-down'));
}

// ── Routeur ──────────────────────────────────────────────────
// "/" → accueil, "/c/histoire" → page catégorie, "/javascript" → page sujet
function router() {
  const path = decodeURIComponent(location.pathname.slice(1));
  if (!path) renderHome();
  else if (path.startsWith('c/')) renderCategory(path.slice(2));
  else renderTopic(path);
}

// Navigation sans recharger la page (History API)
function navigate(url) {
  history.pushState(null, '', url);
  router();
}

// Intercepte les clics sur les liens internes marqués data-link
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (!link) return;
  e.preventDefault();
  navigate(link.getAttribute('href'));
});

// Bouton "Précédent" du navigateur
window.addEventListener('popstate', router);

// Petite transition d'entrée à chaque changement de vue
function mount(node) {
  app.classList.remove('view-enter');
  app.replaceChildren(node);
  // force le reflow pour relancer l'animation CSS
  void app.offsetWidth;
  app.classList.add('view-enter');
}

// ── Icônes par catégorie ──────────────────────────────────────
const CATEGORY_ICONS = {
  cpu: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>',
  math: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M8 3 4 7l4 4M6 17h7M17 13l3 8M20 13l-3 8"/></svg>',
  atom: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></svg>',
  flask: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6M10 2v6.5L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 8.5V2"/><path d="M7.5 15h9"/></svg>',
  dna: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3c0 6 12 12 12 18M18 3c0 6-12 12-12 18"/><path d="M7 8h10M6 12h12M7 16h10"/></svg>',
  orbit: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.3"/><ellipse cx="12" cy="12" rx="10" ry="4"/><circle cx="20.5" cy="10.5" r="1" fill="currentColor" stroke="none"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>',
  scroll: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/></svg>',
  map: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z"/><path d="M9 3v16M15 5v16"/></svg>',
  globe: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.3 2.3 3.8 5.6 3.8 9s-1.5 6.7-3.8 9c-2.3-2.3-3.8-5.6-3.8-9s1.5-6.7 3.8-9Z"/></svg>',
  brain: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5"/></svg>',
  speech: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H8l-4 4V4Z"/><path d="M8 9h8M8 12.5h5"/></svg>',
  palette: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 8 0 1 0 0 16c1.1 0 1.6-.7 1.6-1.5 0-.4-.2-.8-.4-1.1-.2-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4H16a4 4 0 0 0 4-4c0-4-3.6-7-8-7Z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="11" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8" r="1" fill="currentColor" stroke="none"/></svg>',
  music: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V4l11-2v14"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  film: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M2.5 9h19M7 5v4M17 5v4M2.5 15h19M7 15v4M17 15v4"/></svg>',
  building: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l8-6 8 6v12"/><path d="M4 21h16M9 21v-6h6v6M9 12h.01M15 12h.01M12 12h.01"/></svg>',
  chart: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>',
  scale: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 21h10M12 6 4 8l4 6 4-6-4-2ZM12 6l8 2-4 6-4-6-4 2"/></svg>',
  people: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.8 14.3c2.6.3 4.7 2.6 4.7 5.7"/></svg>',
  head: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20v-3.3A6 6 0 1 1 18 12c0 1.8-.8 2.8-1.5 3.6-.5.6-.9 1-.9 1.9V20"/><path d="M8 20h8M10 20v1.5M14 20v1.5"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/></svg>',
  flame: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1 0 2 1.5 2 3.5A5 5 0 0 1 7 14C7 8 12 7 12 2Z"/></svg>',
  mask: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7c3-2 13-2 16 0 0 7-3 13-8 13S4 14 4 7Z"/><circle cx="9" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/><path d="M9 16c1.2.8 2.8.8 4 0"/></svg>',
  cap: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9 12 4l10 5-10 5-10-5Z"/><path d="M6 11.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5M21 9v6"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v6a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5"/><path d="M12 14v3M9 21h6M9.5 21c0-2 1-3 2.5-4 1.5 1 2.5 2 2.5 4"/></svg>',
  utensils: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v8a2 2 0 0 0 4 0V2M8 10v12M18 2c-1.7 0-3 2-3 5s1.3 5 3 5v9"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4c-9 0-16 5-16 14 9 0 14-5 16-14Z"/><path d="M4 20 14 10"/></svg>',
  wheat: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V5"/><path d="M12 5c-2 0-3-1.5-3-3 2 0 3 1 3 3ZM12 5c2 0 3-1.5 3-3-2 0-3 1-3 3ZM12 10c-2 0-3-1.5-3-3 2 0 3 1 3 3ZM12 10c2 0 3-1.5 3-3-2 0-3 1-3 3ZM12 15c-2 0-3-1.5-3-3 2 0 3 1 3 3ZM12 15c2 0 3-1.5 3-3-2 0-3 1-3 3Z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2.5 12.5h19"/></svg>',
  newspaper: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12v16H6a2 2 0 0 1-2-2V4Z"/><path d="M16 8h4v10a2 2 0 0 1-2 2h-2M7 8h6M7 11h6M7 14h4"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
};
const DEFAULT_CATEGORY_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>';

// ── Vue : accueil ────────────────────────────────────────────
async function renderHome() {
  document.title = 'Explora — apprends ce que tu veux';
  mount(document.getElementById('tpl-home').content.cloneNode(true));

  const categories = await api('/api/categories');
  document.getElementById('topics-count').textContent = categories.reduce((sum, c) => sum + c.count, 0);
  document.getElementById('category-grid').innerHTML = categories
    .map((c) => `
      <a href="/c/${c.slug}" class="category-card" data-link>
        <span class="category-card-icon">${CATEGORY_ICONS[c.icon] || DEFAULT_CATEGORY_ICON}</span>
        <span class="category-card-name">${escapeHtml(c.name)}</span>
        <span class="category-card-desc">${escapeHtml(c.description)}</span>
        <span class="category-card-count">${c.count} sujet${c.count > 1 ? 's' : ''}</span>
      </a>`)
    .join('');

  setupSearch();
}

// ── Vue : page d'une catégorie ────────────────────────────────
async function renderCategory(slug) {
  mount(document.getElementById('tpl-loading').content.cloneNode(true));

  let category;
  try {
    category = await api('/api/categories/' + encodeURIComponent(slug));
  } catch {
    mount(document.createRange().createContextualFragment(
      `<p class="error">Cette catégorie n'existe pas. <a href="/" data-link>Retour</a></p>`
    ));
    return;
  }

  document.title = `${category.name} — Explora`;
  const view = document.getElementById('tpl-category').content.cloneNode(true);

  view.querySelector('#category-icon').innerHTML = CATEGORY_ICONS[category.icon] || DEFAULT_CATEGORY_ICON;
  view.querySelector('.category-name').textContent = category.name;
  view.querySelector('.category-description').textContent = category.description;
  const countLabel = view.querySelector('#category-count');
  countLabel.textContent = `${category.topics.length} sujet${category.topics.length > 1 ? 's' : ''}`;

  const grid = view.querySelector('#category-topics');
  const filterInput = view.querySelector('#category-filter');

  function drawTopics(list) {
    grid.innerHTML = list.length
      ? list
          .map((t) => `
            <a href="/${t.slug}" class="topic-card" data-link>
              <span class="topic-card-name">${escapeHtml(t.name)}</span>
              <span class="topic-card-summary">${escapeHtml(t.summary)}</span>
              <svg class="resource-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>
            </a>`)
          .join('')
      : `<p class="empty-state">Aucun sujet ne correspond à ta recherche.</p>`;
  }
  drawTopics(category.topics);

  // Filtre en direct : tout est déjà chargé, pas besoin de rappeler l'API
  let filterTimer;
  filterInput.addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      const q = normalizeClient(filterInput.value.trim());
      drawTopics(
        q
          ? category.topics.filter((t) => normalizeClient(t.name).includes(q) || normalizeClient(t.summary).includes(q))
          : category.topics
      );
    }, 100);
  });

  mount(view);
  window.scrollTo(0, 0);
}

// Normalisation côté client (identique à celle du serveur) pour le filtre de catégorie
function normalizeClient(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Autocomplétion ───────────────────────────────────────────
function setupSearch() {
  const input = document.getElementById('search-input');
  const list = document.getElementById('suggestions');
  let results = [];
  let active = -1;   // index de la suggestion surlignée au clavier
  let timer;

  input.focus();

  // "Debounce" : on attend 150 ms après la dernière frappe avant d'appeler l'API
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      results = await api('/api/search?q=' + encodeURIComponent(input.value));
      active = results.length ? 0 : -1;
      draw();
    }, 150);
  });

  // Navigation clavier : ↑ ↓ Entrée Échap
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, results.length - 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp')   { active = Math.max(active - 1, 0); draw(); e.preventDefault(); }
    if (e.key === 'Enter' && results[active]) navigate('/' + results[active].slug);
    if (e.key === 'Escape') { results = []; draw(); }
  });

  // Clic sur une suggestion
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (li) navigate('/' + li.dataset.slug);
  });

  function draw() {
    list.innerHTML = results
      .map((r, i) => `
        <li role="option" data-slug="${r.slug}" class="${i === active ? 'active' : ''}">
          <span>${escapeHtml(r.name)}</span>
          ${r.category ? `<span class="suggestion-category">${escapeHtml(r.category.name)}</span>` : ''}
        </li>`)
      .join('');
  }
}

// ── Icônes par type de ressource ─────────────────────────────
const RESOURCE_ICONS = {
  doc: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  cours: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>',
  jeu: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="20" height="10" rx="5"/><path d="M8 11v2M7 12h2M15.5 11.5h.01M17.5 13.5h.01"/></svg>',
  site: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.3 2.3 3.8 5.6 3.8 9s-1.5 6.7-3.8 9c-2.3-2.3-3.8-5.6-3.8-9s1.5-6.7 3.8-9Z"/></svg>',
  outil: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8Z"/></svg>',
};
const DEFAULT_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>';

// ── Vue : page d'un sujet ────────────────────────────────────
async function renderTopic(slug) {
  mount(document.getElementById('tpl-loading').content.cloneNode(true));

  let topic;
  try {
    topic = await api('/api/topics/' + encodeURIComponent(slug));
  } catch {
    mount(document.createRange().createContextualFragment(
      `<p class="error">Ce sujet n'existe pas encore. <a href="/" data-link>Retour</a></p>`
    ));
    return;
  }

  document.title = `${topic.name} — Explora`;
  const view = document.getElementById('tpl-topic').content.cloneNode(true);

  const categoryBadge = view.querySelector('#topic-category');
  if (topic.category) {
    categoryBadge.textContent = topic.category.name;
    categoryBadge.setAttribute('href', `/c/${topic.category.slug}`);
  } else {
    categoryBadge.remove();
  }

  view.querySelector('.topic-name').textContent = topic.name;
  view.querySelector('.topic-summary').textContent = topic.summary;

  view.querySelector('.resources').innerHTML = topic.resources.length
    ? topic.resources
        .map((r) => `
          <li><a href="${r.url}" target="_blank" rel="noopener">
            <span class="resource-title">
              <span class="resource-icon">${RESOURCE_ICONS[r.type] || DEFAULT_ICON}</span>
              <span>${escapeHtml(r.title)}</span>
            </span>
            <span class="resource-meta">
              <span class="tag">${escapeHtml(r.type)}</span>
              <svg class="resource-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>
            </span>
          </a></li>`)
        .join('')
    : `<li class="empty-state">Ressources à venir pour ce sujet — reviens bientôt.</li>`;

  view.querySelector('.related').innerHTML = topic.related
    .map((t) => `<a href="/${t.slug}" data-link>${escapeHtml(t.name)}</a>`)
    .join('');

  mount(view);
  window.scrollTo(0, 0);
}

// Évite l'injection de HTML via les données (sécurité XSS)
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Premier rendu au chargement
setupTheme();
setupCursorFx();
router();
