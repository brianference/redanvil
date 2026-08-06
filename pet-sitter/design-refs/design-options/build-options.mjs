/**
 * Build three structurally distinct Pet Sitter Finder design options.
 * Real seed sitters only. mark-01 brand mark. Light+dark Ã— 375+1280 Ã— home+detail.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

/** @typedef {{ id: string, name: string, hood: string, rate: number, pets: string[], bio: string, reviews: number, score: number | null, from: string, to: string, avatar: string, initials: string }} Sitter */

/** Real seed rows from migrations/0003_rebuild.sql. Scores only when a review row exists. */
const SITTERS = /** @type {Sitter[]} */ ([
  {
    id: 'sit-leslieville-01',
    name: 'Avery Chen',
    hood: 'Leslieville',
    rate: 55,
    pets: ['Dogs', 'Cats'],
    bio: 'Evening walks and overnight stays for small and medium dogs. Quiet home near Greenwood Park.',
    reviews: 24,
    score: 5.0,
    from: '2026-08-01',
    to: '2026-12-31',
    avatar: 'avatars/avery-chen.jpg',
    initials: 'AC',
  },
  {
    id: 'sit-annex-02',
    name: 'Jordan Patel',
    hood: 'The Annex',
    rate: 65,
    pets: ['Dogs'],
    bio: 'Apartment-based overnight care near Bloor. Accepts dogs under 40 lb with a trial meet.',
    reviews: 41,
    score: 5.0,
    from: '2026-08-01',
    to: '2026-11-30',
    avatar: 'avatars/jordan-patel.jpg',
    initials: 'JP',
  },
  {
    id: 'sit-riverdale-03',
    name: 'Sam Okonkwo',
    hood: 'Riverdale',
    rate: 48,
    pets: ['Cats', 'Small mammals'],
    bio: 'Cat-only drop-ins and multi-day stays. Litter, meds, and photo updates included.',
    reviews: 18,
    score: 4.0,
    from: '2026-08-05',
    to: '2026-10-31',
    avatar: 'avatars/sam-okonkwo.jpg',
    initials: 'SO',
  },
  {
    id: 'sit-beaches-04',
    name: 'Riley Ng',
    hood: 'The Beaches',
    rate: 70,
    pets: ['Dogs'],
    bio: 'Beach-area house with fenced yard. Best for active dogs that need long morning walks.',
    reviews: 33,
    score: 5.0,
    from: '2026-08-10',
    to: '2026-12-15',
    avatar: 'avatars/riley-ng.jpg',
    initials: 'RN',
  },
  {
    id: 'sit-liberty-05',
    name: 'Morgan Ellis',
    hood: 'Liberty Village',
    rate: 58,
    pets: ['Dogs', 'Cats'],
    bio: 'Condo stays with flexible drop-off windows. Happy to coordinate with building pet policies.',
    reviews: 12,
    score: null,
    from: '2026-08-01',
    to: '2026-09-30',
    avatar: 'avatars/morgan-ellis.jpg',
    initials: 'ME',
  },
  {
    id: 'sit-highpark-06',
    name: 'Casey Brooks',
    hood: 'High Park',
    rate: 62,
    pets: ['Dogs'],
    bio: 'Near High Park trails. Mid-day walks and overnight boarding for one or two dogs.',
    reviews: 29,
    score: null,
    from: '2026-08-01',
    to: '2026-12-31',
    avatar: 'avatars/casey-brooks.jpg',
    initials: 'CB',
  },
  {
    id: 'sit-distillery-07',
    name: 'Taylor Kim',
    hood: 'Distillery District',
    rate: 75,
    pets: ['Cats'],
    bio: 'Quiet loft for cats only. Daily play sessions and twice-daily food checks.',
    reviews: 9,
    score: null,
    from: '2026-08-15',
    to: '2026-11-15',
    avatar: 'avatars/taylor-kim.jpg',
    initials: 'TK',
  },
  {
    id: 'sit-yorkville-08',
    name: 'Alex Rivera',
    hood: 'Yorkville',
    rate: 80,
    pets: ['Dogs', 'Cats'],
    bio: 'Short-notice overnight coverage for city travellers. References available on request.',
    reviews: 52,
    score: 4.0,
    from: '2026-08-01',
    to: '2026-12-31',
    avatar: 'avatars/alex-rivera.jpg',
    initials: 'AR',
  },
]);

const DETAIL = SITTERS[0]; // Avery Chen detail hero across options
const MARK = 'mark-01.png';

/**
 * @param {number | null} score
 * @param {number} reviews
 */
function ratingHtml(score, reviews) {
  if (score == null) {
    return `<span class="rating" aria-label="${reviews} verified reviews"><span class="star" aria-hidden="true">★</span> <span class="score">Verified</span> · ${reviews} reviews</span>`;
  }
  const full = Math.floor(score);
  const stars = '★'.repeat(full) + (score % 1 >= 0.5 ? '½' : '') + '☆'.repeat(Math.max(0, 5 - full - (score % 1 >= 0.5 ? 1 : 0)));
  return `<span class="rating" aria-label="${score.toFixed(1)} out of 5, ${reviews} reviews"><span class="stars" aria-hidden="true">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span> <span class="score">${score.toFixed(1)}</span> · ${reviews} reviews</span>`;
}

/**
 * @param {string[]} pets
 */
function pillsHtml(pets) {
  return pets.map((p) => `<span class="pill">${escapeHtml(p)}</span>`).join('');
}

/**
 * @param {string} from
 * @param {string} to
 */
function availLabel(from, to) {
  const f = formatShort(from);
  const t = formatShort(to);
  return `Available ${f} - ${t}`;
}

/**
 * @param {string} iso
 */
function formatShort(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const SHARED_SHELL = `
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font);
  background: #12141a;
  color: #e8e8ee;
  padding: 28px 16px 64px;
  line-height: 1.45;
}
.page-head { max-width: 1320px; margin: 0 auto 20px; }
.page-head h1 { margin: 0 0 8px; font-size: 26px; font-weight: 800; letter-spacing: -0.03em; color: #fff; }
.page-head .arch { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border: 1px solid #fff; padding: 4px 10px; margin-bottom: 10px; }
.page-head p { margin: 0; color: #a0a0ae; max-width: 70ch; font-size: 15px; }
.section-label {
  max-width: 1320px; margin: 28px auto 12px; font-size: 12px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; color: #8b8b9a;
}
.row {
  max-width: 1320px; margin: 0 auto 8px;
  display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start; justify-content: flex-start;
}
.frame-wrap { flex: 0 0 auto; }
.frame-cap {
  text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: #9a9aaa; margin-bottom: 8px;
}
.phone {
  width: 375px; height: 780px; overflow: hidden; position: relative;
  border: 3px solid #000; border-radius: 28px; background: var(--bg);
  box-shadow: 0 20px 50px rgba(0,0,0,0.45);
  color: var(--text); font-family: var(--font); font-size: 16px;
  display: flex; flex-direction: column;
}
.desktop {
  width: 1280px; height: 820px; overflow: hidden; position: relative;
  border: 3px solid #000; border-radius: 12px; background: var(--bg);
  box-shadow: 0 20px 50px rgba(0,0,0,0.45);
  color: var(--text); font-family: var(--font); font-size: 16px;
  display: flex; flex-direction: column;
  transform-origin: top left;
}
.desktop-scale { width: 640px; height: 410px; overflow: hidden; }
.desktop-scale .desktop { transform: scale(0.5); }
.scroll { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
button, a, input, select { font: inherit; }
button { cursor: pointer; min-height: 44px; min-width: 44px; }
img { display: block; max-width: 100%; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
`;

// --- OPTION A: Photo-card marketplace (Airbnb-class) -------------------------
function optionA() {
  const tokens = `
  .opt-a {
    --font: "DM Sans", "Segoe UI", system-ui, sans-serif;
    --bg: var(--a-bg); --surface: var(--a-surface); --text: var(--a-text);
    --muted: var(--a-muted); --border: var(--a-border); --accent: var(--a-accent);
    --accent-ink: var(--a-accent-ink); --chip: var(--a-chip); --ok: var(--a-ok);
    --shadow: var(--a-shadow); --radius: 20px; --radius-sm: 12px;
  }
  .opt-a[data-theme="light"] {
    --a-bg: #faf6f1; --a-surface: #ffffff; --a-text: #1c1410;
    --a-muted: #6b5e56; --a-border: #eadfd4; --a-accent: #e05a4f;
    --a-accent-ink: #ffffff; --a-chip: #f3e8e0; --a-ok: #1f7a4c;
    --a-shadow: 0 8px 28px rgba(28,20,16,0.08);
  }
  .opt-a[data-theme="dark"] {
    --a-bg: #14110f; --a-surface: #1f1a17; --a-text: #f7f1eb;
    --a-muted: #b0a49a; --a-border: #3a322c; --a-accent: #f07167;
    --a-accent-ink: #1c1410; --a-chip: #2a2320; --a-ok: #5dca8d;
    --a-shadow: 0 8px 28px rgba(0,0,0,0.35);
  }
  .opt-a .nav {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 16px; padding-top: max(10px, env(safe-area-inset-top));
    background: var(--surface); border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 20;
  }
  .opt-a .brand { display: flex; align-items: center; gap: 10px; min-height: 44px; text-decoration: none; color: inherit; }
  .opt-a .brand img { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; }
  .opt-a .brand-name { font-weight: 800; font-size: 15px; letter-spacing: -0.02em; }
  .opt-a .nav-actions { display: flex; align-items: center; gap: 6px; }
  .opt-a .nav-link {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 44px; padding: 0 12px; border-radius: 999px; color: var(--muted);
    text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid transparent;
  }
  .opt-a .nav-link:hover, .opt-a .nav-link[aria-current="page"] {
    color: var(--text); background: var(--chip); border-color: var(--border);
  }
  .opt-a .icon-btn {
    width: 44px; height: 44px; border-radius: 999px; border: 1px solid var(--border);
    background: var(--surface); color: var(--text); display: inline-flex;
    align-items: center; justify-content: center;
  }
  .opt-a .hero {
    padding: 20px 16px 8px; background:
      radial-gradient(120% 80% at 10% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 55%),
      var(--bg);
  }
  .opt-a .hero h1 {
    margin: 0 0 6px; font-size: 28px; line-height: 1.15; font-weight: 800; letter-spacing: -0.03em;
  }
  .opt-a .hero p { margin: 0 0 16px; color: var(--muted); font-size: 16px; max-width: 36ch; }
  .opt-a .search-capsule {
    display: flex; flex-direction: column; gap: 0; background: var(--surface); border: 1px solid var(--border);
    border-radius: 24px; box-shadow: var(--shadow); overflow: hidden;
  }
  .opt-a .search-fields {
    display: grid; grid-template-columns: 1.2fr 1fr 1fr auto; align-items: stretch;
  }
  .opt-a .search-fields label {
    display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; min-height: 56px;
    border-right: 1px solid var(--border); font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
  }
  .opt-a .search-fields label:last-of-type { border-right: 0; }
  .opt-a .search-fields input, .opt-a .search-fields select {
    border: 0; background: transparent; color: var(--text); font-size: 15px; font-weight: 600;
    padding: 0; min-height: 22px; outline: none; width: 100%;
  }
  .opt-a .search-go {
    margin: 6px; width: 48px; height: 48px; border: 0; border-radius: 999px;
    background: var(--accent); color: var(--accent-ink); font-weight: 800; font-size: 18px;
    flex-shrink: 0; align-self: center;
  }
  .phone.opt-a .search-fields { grid-template-columns: 1fr; }
  .phone.opt-a .search-capsule { border-radius: 20px; }
  .phone.opt-a .search-fields label {
    border-right: 0; border-bottom: 1px solid var(--border); min-height: 52px;
  }
  .phone.opt-a .search-fields label:last-of-type { border-bottom: 1px solid var(--border); }
  .phone.opt-a .search-go {
    width: 100%; margin: 0; border-radius: 0; height: 48px; min-height: 48px;
    align-self: stretch;
  }
  .opt-a .chips {
    display: flex; gap: 8px; overflow-x: auto; padding: 14px 16px 6px;
    scrollbar-width: none;
  }
  .opt-a .chips::-webkit-scrollbar { display: none; }
  .opt-a .chip {
    flex: 0 0 auto; min-height: 44px; padding: 0 16px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--surface); color: var(--text);
    font-weight: 600; font-size: 14px; white-space: nowrap;
  }
  .opt-a .chip[aria-pressed="true"] {
    background: var(--text); color: var(--bg); border-color: var(--text);
  }
  .opt-a .meta-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 8px 16px 12px; color: var(--muted); font-size: 14px;
  }
  .opt-a .meta-row strong { color: var(--text); font-weight: 700; }
  .opt-a .card-grid {
    display: grid; gap: 18px; padding: 0 16px 100px; list-style: none; margin: 0;
  }
  .desktop.opt-a .card-grid { grid-template-columns: repeat(3, 1fr); gap: 22px; padding: 0 28px 40px; }
  .desktop.opt-a .hero { padding: 28px 28px 12px; }
  .desktop.opt-a .chips { padding: 16px 28px 8px; }
  .desktop.opt-a .meta-row { padding: 8px 28px 16px; }
  .opt-a .card {
    background: var(--surface); border-radius: var(--radius); overflow: hidden;
    box-shadow: var(--shadow); border: 1px solid var(--border); display: flex; flex-direction: column;
  }
  .opt-a .card-media {
    position: relative; aspect-ratio: 4/3; background: var(--chip); overflow: hidden;
  }
  .opt-a .card-media img { width: 100%; height: 100%; object-fit: cover; }
  .opt-a .price-badge {
    position: absolute; left: 12px; bottom: 12px; background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(8px); border-radius: 999px; padding: 8px 12px; font-weight: 800;
    font-size: 14px; border: 1px solid var(--border); min-height: 36px; display: inline-flex; align-items: center;
  }
  .opt-a .price-badge span { font-weight: 500; color: var(--muted); margin-left: 2px; }
  .opt-a .card-body { padding: 14px 14px 16px; display: flex; flex-direction: column; gap: 8px; }
  .opt-a .card-top { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
  .opt-a .card-name { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
  .opt-a .card-hood { margin: 2px 0 0; color: var(--muted); font-size: 14px; }
  .opt-a .rating { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 13px; color: var(--muted); }
  .opt-a .rating .stars { color: #d4a017; letter-spacing: 1px; }
  .opt-a .rating .score { color: var(--text); font-weight: 800; }
  .opt-a .pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .opt-a .pill {
    display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px;
    border-radius: 999px; background: var(--chip); color: var(--text); font-size: 13px; font-weight: 600;
    border: 1px solid var(--border);
  }
  .opt-a .avail {
    display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ok); font-weight: 600;
  }
  .opt-a .avail::before {
    content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--ok); flex-shrink: 0;
  }
  .opt-a .card-cta {
    margin-top: 4px; min-height: 44px; border-radius: 999px; border: 0;
    background: var(--accent); color: var(--accent-ink); font-weight: 700; width: 100%;
  }
  .opt-a .assist-dock {
    flex-shrink: 0; padding: 10px 16px max(12px, env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    border-top: 1px solid var(--border); z-index: 15;
  }
  .opt-a .assist {
    min-height: 48px; width: 100%; padding: 0 18px; border-radius: 999px; border: 0;
    background: var(--text); color: var(--bg); font-weight: 700; font-size: 14px;
    box-shadow: var(--shadow); display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  }
  .phone.opt-a .card-grid { padding-bottom: 24px; }
  .desktop.opt-a .assist-dock { padding: 12px 28px 20px; }
  .desktop.opt-a .assist { max-width: 280px; }
  /* Detail */
  .opt-a .detail-hero {
    position: relative; height: 280px; background: var(--chip);
  }
  .desktop.opt-a .detail-hero { height: 360px; }
  .opt-a .detail-hero img { width: 100%; height: 100%; object-fit: cover; }
  .opt-a .detail-back {
    position: absolute; top: 12px; left: 12px; width: 44px; height: 44px; border-radius: 999px;
    border: 0; background: color-mix(in srgb, var(--surface) 90%, transparent); backdrop-filter: blur(8px);
    color: var(--text); font-size: 18px;
  }
  .opt-a .detail-body { padding: 20px 16px 120px; }
  .desktop.opt-a .detail-layout {
    display: grid; grid-template-columns: 1.4fr 0.9fr; gap: 28px; padding: 28px; align-items: start;
  }
  .desktop.opt-a .detail-body { padding: 0; }
  .opt-a .detail-name { margin: 0 0 4px; font-size: 30px; font-weight: 800; letter-spacing: -0.03em; }
  .opt-a .detail-hood { margin: 0 0 12px; color: var(--muted); }
  .opt-a .detail-bio { margin: 14px 0; color: var(--text); font-size: 16px; line-height: 1.55; max-width: 62ch; }
  .opt-a .book-bar {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 18;
    padding: 12px 16px max(12px, env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(12px);
    border-top: 1px solid var(--border); display: flex; gap: 12px; align-items: center;
  }
  .opt-a .book-price { font-weight: 800; font-size: 18px; }
  .opt-a .book-price span { font-weight: 500; font-size: 14px; color: var(--muted); }
  .opt-a .book-dates { flex: 1; font-size: 13px; color: var(--muted); }
  .opt-a .book-cta {
    min-height: 48px; padding: 0 20px; border: 0; border-radius: 999px;
    background: var(--accent); color: var(--accent-ink); font-weight: 800; white-space: nowrap;
  }
  .desktop.opt-a .book-side {
    position: sticky; top: 16px; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px;
  }
  .desktop.opt-a .book-side h3 { margin: 0 0 12px; font-size: 18px; }
  .opt-a .date-field {
    display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px;
    font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted);
  }
  .opt-a .date-field input {
    min-height: 44px; border-radius: 12px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text); padding: 0 12px; font-weight: 600;
  }
  .desktop.opt-a .book-side .book-cta { width: 100%; margin-top: 8px; }
  .desktop.opt-a .nav-links { display: flex; gap: 4px; }
  .phone.opt-a .nav-links { display: none; }
  .opt-a .crumb { font-size: 13px; color: var(--muted); margin-bottom: 10px; }
  .opt-a .crumb a { color: var(--muted); }
  .opt-a .state-skeleton {
    height: 180px; border-radius: var(--radius); background: linear-gradient(90deg, var(--chip), var(--border), var(--chip));
    background-size: 200% 100%; animation: shimmer 1.2s infinite; margin: 0 16px 12px;
  }
  @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
  `;

  /**
   * @param {'light'|'dark'} theme
   * @param {'phone'|'desktop'} device
   * @param {'home'|'detail'} screen
   */
  function frame(theme, device, screen) {
    const cls = device === 'phone' ? 'phone' : 'desktop';
    const wrapStart = device === 'desktop' ? `<div class="desktop-scale">` : '';
    const wrapEnd = device === 'desktop' ? `</div>` : '';
    const navLinks =
      device === 'desktop'
        ? `<nav class="nav-links" aria-label="Primary">
            <a class="nav-link" href="#" ${screen === 'home' ? 'aria-current="page"' : ''}>Find sitters</a>
            <a class="nav-link" href="#">About</a>
            <a class="nav-link" href="#">Sign in</a>
          </nav>`
        : '';

    const nav = `
      <header class="nav">
        <a class="brand" href="#">
          <img src="${MARK}" alt="" width="40" height="40" />
          <span class="brand-name">Pet Sitter Finder</span>
        </a>
        ${navLinks}
        <div class="nav-actions">
          <button type="button" class="icon-btn" aria-label="Switch theme">${theme === 'light' ? 'Dark' : 'Light'}</button>
          ${device === 'phone' ? `<button type="button" class="icon-btn" aria-label="Open menu">=</button>` : ''}
        </div>
      </header>`;

    let body = '';
    if (screen === 'home') {
      const cards = SITTERS.map(
        (s) => `
        <li class="card">
          <div class="card-media">
            <img src="${s.avatar}" alt="${escapeHtml(s.name)}" width="400" height="300" />
            <div class="price-badge">$${s.rate}<span>/night</span></div>
          </div>
          <div class="card-body">
            <div class="card-top">
              <div>
                <h2 class="card-name">${escapeHtml(s.name)}</h2>
                <p class="card-hood">${escapeHtml(s.hood)}</p>
              </div>
              ${ratingHtml(s.score, s.reviews)}
            </div>
            <div class="pills">${pillsHtml(s.pets)}</div>
            <div class="avail">${availLabel(s.from, s.to)}</div>
            <button type="button" class="card-cta">View profile</button>
          </div>
        </li>`
      ).join('');

      body = `
        ${nav}
        <div class="scroll">
          <section class="hero">
            <h1>Trusted sitters near your pet</h1>
            <p>Browse neighbourhood hosts with real reviews, clear rates, and open dates.</p>
            <form class="search-capsule" role="search" aria-label="Find sitters">
              <div class="search-fields">
                <label>Where
                  <input type="search" name="q" placeholder="Leslieville, Annex..." value="" />
                </label>
                <label>Check-in
                  <input type="date" name="from" value="2026-08-12" />
                </label>
                <label>Check-out
                  <input type="date" name="to" value="2026-08-16" />
                </label>
                ${device === 'desktop' ? `<button type="submit" class="search-go" aria-label="Search">Go</button>` : ''}
              </div>
              ${device === 'phone' ? `<button type="submit" class="search-go">Search sitters</button>` : ''}
            </form>
          </section>
          <div class="chips" role="toolbar" aria-label="Pet type filters">
            <button type="button" class="chip" aria-pressed="true">All pets</button>
            <button type="button" class="chip" aria-pressed="false">Dogs</button>
            <button type="button" class="chip" aria-pressed="false">Cats</button>
            <button type="button" class="chip" aria-pressed="false">Small mammals</button>
            <button type="button" class="chip" aria-pressed="false">Under $60</button>
          </div>
          <div class="meta-row"><span><strong>${SITTERS.length}</strong> sitters open for Aug 12-16</span><span>Sort: Top rated</span></div>
          <ul class="card-grid">${cards}</ul>
        </div>
        <div class="assist-dock">
          <button type="button" class="assist" aria-label="Ask about sitters">Ask about sitters</button>
        </div>`;
    } else {
      const s = DETAIL;
      const main = `
        <div class="detail-hero">
          <img src="${s.avatar}" alt="${escapeHtml(s.name)}" />
          ${device === 'phone' ? `<button type="button" class="detail-back" aria-label="Back">Back</button>` : ''}
        </div>
        <div class="detail-body">
          ${device === 'desktop' ? `<p class="crumb"><a href="#">Find sitters</a> / ${escapeHtml(s.name)}</p>` : ''}
          <h1 class="detail-name">${escapeHtml(s.name)}</h1>
          <p class="detail-hood">${escapeHtml(s.hood)} · Toronto</p>
          ${ratingHtml(s.score, s.reviews)}
          <div class="pills" style="margin-top:12px">${pillsHtml(s.pets)}</div>
          <div class="avail" style="margin-top:12px">${availLabel(s.from, s.to)}</div>
          <p class="detail-bio">${escapeHtml(s.bio)}</p>
          <h2 style="font-size:18px;margin:20px 0 8px">What guests say</h2>
          <p style="margin:0;color:var(--muted);font-size:15px">"Reliable evening walks and clear photo updates every night."</p>
        </div>`;

      if (device === 'phone') {
        body = `
          ${nav}
          <div class="scroll">${main}</div>
          <div class="book-bar">
            <div>
              <div class="book-price">$${s.rate}<span> / night</span></div>
              <div class="book-dates">Aug 12 - Aug 16</div>
            </div>
            <button type="button" class="book-cta">Request to book</button>
          </div>`;
      } else {
        body = `
          ${nav}
          <div class="scroll">
            <div class="detail-layout">
              <div>${main}</div>
              <aside class="book-side">
                <h3>$${s.rate} <span style="font-weight:500;color:var(--muted);font-size:14px">/ night</span></h3>
                ${ratingHtml(s.score, s.reviews)}
                <label class="date-field" style="margin-top:16px">Check-in
                  <input type="date" value="2026-08-12" />
                </label>
                <label class="date-field">Check-out
                  <input type="date" value="2026-08-16" />
                </label>
                <div class="avail" style="margin:10px 0 14px">${availLabel(s.from, s.to)}</div>
                <button type="button" class="book-cta">Request to book</button>
              </aside>
            </div>
          </div>`;
      }
    }

    return `
    <div class="frame-wrap">
      <div class="frame-cap">${device === 'phone' ? '375' : '1280'} · ${theme} · ${screen}</div>
      ${wrapStart}
      <div class="${cls} opt-a" data-theme="${theme}">
        ${body}
      </div>
      ${wrapEnd}
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Option A - Photo-card marketplace · Pet Sitter Finder</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    ${SHARED_SHELL}
    ${tokens}
  </style>
</head>
<body>
  <header class="page-head">
    <div class="arch">Option A</div>
    <h1>Photo-card marketplace</h1>
    <p><strong>Architecture:</strong> floating multi-field search capsule Go full-bleed photo cards with faces Go sticky booking bar on detail.
    <strong>Visual:</strong> warm coral on cream, soft 20px radii, Airbnb-class depth. Distinct element: the pill search capsule and price-on-photo badges.</p>
  </header>

  <div class="section-label">Home - light</div>
  <div class="row">
    ${frame('light', 'phone', 'home')}
    ${frame('light', 'desktop', 'home')}
  </div>
  <div class="section-label">Home - dark</div>
  <div class="row">
    ${frame('dark', 'phone', 'home')}
    ${frame('dark', 'desktop', 'home')}
  </div>
  <div class="section-label">Sitter detail (Avery Chen) - light</div>
  <div class="row">
    ${frame('light', 'phone', 'detail')}
    ${frame('light', 'desktop', 'detail')}
  </div>
  <div class="section-label">Sitter detail - dark</div>
  <div class="row">
    ${frame('dark', 'phone', 'detail')}
    ${frame('dark', 'desktop', 'detail')}
  </div>
</body>
</html>`;
}

// --- OPTION B: Map stage + sheet rail ----------------------------------------
function optionB() {
  const tokens = `
  .opt-b {
    --font: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
    --bg: var(--b-bg); --surface: var(--b-surface); --text: var(--b-text);
    --muted: var(--b-muted); --border: var(--b-border); --accent: var(--b-accent);
    --accent-ink: var(--b-accent-ink); --chip: var(--b-chip); --ok: var(--b-ok);
    --map: var(--b-map); --shadow: var(--b-shadow); --radius: 16px;
  }
  .opt-b[data-theme="light"] {
    --b-bg: #f3f6f4; --b-surface: #ffffff; --b-text: #0f1f18;
    --b-muted: #4d6358; --b-border: #d5e0d9; --b-accent: #0f7a55;
    --b-accent-ink: #ffffff; --b-chip: #e6f2eb; --b-ok: #0f7a55;
    --b-map: #dfece4; --b-shadow: 0 12px 32px rgba(15,31,24,0.12);
  }
  .opt-b[data-theme="dark"] {
    --b-bg: #0c1410; --b-surface: #15201a; --b-text: #eaf3ee;
    --b-muted: #9bb0a4; --b-border: #2a3b32; --b-accent: #3dcf94;
    --b-accent-ink: #0c1410; --b-chip: #1c2b23; --b-ok: #3dcf94;
    --b-map: #1a2820; --b-shadow: 0 12px 32px rgba(0,0,0,0.4);
  }
  .opt-b .top {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(10px); border-bottom: 1px solid var(--border);
    position: absolute; top: 0; left: 0; right: 0; z-index: 30;
    min-width: 0;
  }
  .opt-b .brand { display: flex; align-items: center; gap: 8px; min-height: 44px; color: inherit; text-decoration: none; flex-shrink: 0; }
  .opt-b .brand img { width: 36px; height: 36px; border-radius: 10px; }
  .opt-b .brand-name { font-weight: 800; font-size: 14px; }
  /* Defect 1 fix: hide wordmark on phone so search never overlaps "Sit..." */
  .phone.opt-b .brand-name { display: none; }
  .opt-b .search-over {
    flex: 1 1 auto; display: flex; align-items: center; gap: 8px; min-height: 44px; min-width: 0;
    background: var(--surface); border: 1px solid var(--border); border-radius: 999px;
    padding: 0 6px 0 14px; box-shadow: var(--shadow);
  }
  .opt-b .search-over input {
    flex: 1; border: 0; background: transparent; color: var(--text); font-weight: 600; min-width: 0; outline: none;
  }
  .opt-b .search-over button {
    width: 40px; height: 40px; border: 0; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-weight: 800;
  }
  .opt-b .icon-btn {
    width: 44px; height: 44px; border-radius: 999px; border: 1px solid var(--border);
    background: var(--surface); color: var(--text);
  }
  .opt-b .stage { flex: 1; display: flex; flex-direction: column; position: relative; min-height: 0; }
  .opt-b .map {
    flex: 1; background:
      linear-gradient(180deg, transparent 60%, color-mix(in srgb, var(--bg) 40%, transparent)),
      radial-gradient(circle at 30% 40%, color-mix(in srgb, var(--accent) 12%, var(--map)), var(--map));
    position: relative; min-height: 220px;
  }
  .opt-b .map-grid {
    position: absolute; inset: 0; opacity: 0.35;
    background-image:
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  .opt-b .pin {
    position: absolute; width: 48px; height: 48px; border-radius: 50%;
    border: 3px solid var(--surface); box-shadow: var(--shadow); overflow: hidden;
    background: var(--chip); padding: 0; transform: translate(-50%, -50%);
  }
  .opt-b .pin img { width: 100%; height: 100%; object-fit: cover; }
  .opt-b .pin.active { outline: 3px solid var(--accent); width: 56px; height: 56px; z-index: 2; }
  .opt-b .sheet {
    background: var(--surface); border-radius: 20px 20px 0 0; box-shadow: 0 -8px 30px rgba(0,0,0,0.12);
    border-top: 1px solid var(--border); display: flex; flex-direction: column; max-height: 52%;
    z-index: 20;
  }
  .desktop.opt-b .stage { flex-direction: row; }
  .desktop.opt-b .map { flex: 1.15; min-height: 100%; }
  .desktop.opt-b .sheet {
    flex: 0 0 420px; max-height: none; height: 100%; border-radius: 0;
    border-top: 0; border-left: 1px solid var(--border); box-shadow: none;
  }
  .opt-b .sheet-handle {
    width: 40px; height: 4px; border-radius: 999px; background: var(--border);
    margin: 10px auto 6px;
  }
  .desktop.opt-b .sheet-handle { display: none; }
  .opt-b .sheet-head { padding: 4px 16px 10px; }
  .opt-b .sheet-head h1 { margin: 0 0 4px; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
  .opt-b .sheet-head p { margin: 0; color: var(--muted); font-size: 14px; }
  .opt-b .date-row {
    display: flex; gap: 8px; padding: 0 16px 12px; overflow-x: auto;
  }
  .opt-b .date-chip {
    flex: 0 0 auto; min-height: 44px; padding: 0 14px; border-radius: 12px;
    border: 1px solid var(--border); background: var(--bg); color: var(--text);
    font-weight: 700; font-size: 13px; white-space: nowrap;
  }
  .opt-b .date-chip[aria-pressed="true"] {
    background: var(--accent); color: var(--accent-ink); border-color: var(--accent);
  }
  .opt-b .rail {
    list-style: none; margin: 0; padding: 0 12px 16px; overflow-y: auto; flex: 1;
  }
  .desktop.opt-b .rail { padding-bottom: 16px; }
  .opt-b .rail-row {
    display: grid; grid-template-columns: 64px 1fr auto; gap: 12px; align-items: center;
    padding: 12px; border-radius: var(--radius); border: 1px solid transparent;
    background: transparent; width: 100%; text-align: left; color: inherit; min-height: 88px;
  }
  .opt-b .rail-row:hover, .opt-b .rail-row.active {
    background: var(--chip); border-color: var(--border);
  }
  .opt-b .rail-avatar {
    width: 64px; height: 64px; border-radius: 16px; object-fit: cover; background: var(--chip);
  }
  .opt-b .rail-name { margin: 0; font-size: 16px; font-weight: 800; }
  .opt-b .rail-meta { margin: 2px 0 6px; color: var(--muted); font-size: 13px; }
  .opt-b .rating { font-size: 12px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .opt-b .rating .stars { color: #c9a227; }
  .opt-b .rating .score { color: var(--text); font-weight: 800; }
  .opt-b .pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .opt-b .pill {
    font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px;
    background: var(--bg); border: 1px solid var(--border); color: var(--text);
  }
  .opt-b .rail-price { font-weight: 800; font-size: 16px; white-space: nowrap; }
  .opt-b .rail-price span { display: block; font-weight: 500; font-size: 11px; color: var(--muted); }
  .opt-b .avail-dot {
    display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ok); font-weight: 700; margin-top: 4px;
  }
  .opt-b .avail-dot::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }
  .opt-b .assist-dock {
    flex-shrink: 0; padding: 10px 12px max(12px, env(safe-area-inset-bottom));
    background: var(--surface); border-top: 1px solid var(--border); z-index: 25;
  }
  .opt-b .assist {
    min-height: 48px; width: 100%; padding: 0 16px; border-radius: 999px; border: 0;
    background: var(--text); color: var(--bg); font-weight: 700; font-size: 14px;
    box-shadow: var(--shadow);
  }
  .desktop.opt-b .assist-dock {
    position: absolute; left: 16px; bottom: 16px; right: auto; width: auto;
    background: transparent; border: 0; padding: 0; z-index: 25;
  }
  .desktop.opt-b .assist { width: auto; min-width: 180px; }
  /* Detail */
  .opt-b .detail-shell { display: flex; flex-direction: column; height: 100%; }
  .desktop.opt-b .detail-shell { flex-direction: row; }
  .opt-b .detail-map {
    height: 200px; background: var(--map); position: relative; flex-shrink: 0;
  }
  .desktop.opt-b .detail-map { flex: 1; height: auto; }
  .opt-b .detail-panel {
    flex: 1; background: var(--surface); overflow-y: auto; padding: 20px 16px 110px;
    border-radius: 20px 20px 0 0; margin-top: -16px; position: relative; z-index: 2;
    border-top: 1px solid var(--border);
  }
  .desktop.opt-b .detail-panel {
    flex: 0 0 440px; margin: 0; border-radius: 0; border-top: 0; border-left: 1px solid var(--border);
    padding: 24px; padding-top: 72px;
  }
  .opt-b .detail-avatar {
    width: 88px; height: 88px; border-radius: 22px; object-fit: cover;
    border: 3px solid var(--surface); margin-top: -52px; box-shadow: var(--shadow);
  }
  .desktop.opt-b .detail-avatar { margin-top: 0; width: 96px; height: 96px; }
  .opt-b .detail-name { margin: 12px 0 4px; font-size: 26px; font-weight: 800; letter-spacing: -0.03em; }
  .opt-b .detail-hood { margin: 0 0 10px; color: var(--muted); }
  .opt-b .detail-bio { margin: 14px 0; line-height: 1.55; }
  .opt-b .book-bar {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 20;
    display: flex; gap: 12px; align-items: center; padding: 12px 16px max(12px, env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(10px);
    border-top: 1px solid var(--border);
  }
  .desktop.opt-b .book-bar { position: static; margin-top: 20px; padding: 0; border: 0; background: transparent; flex-direction: column; align-items: stretch; }
  .opt-b .book-cta {
    min-height: 48px; padding: 0 18px; border: 0; border-radius: 999px;
    background: var(--accent); color: var(--accent-ink); font-weight: 800;
  }
  .desktop.opt-b .book-cta { width: 100%; }
  .opt-b .nav-links { display: none; }
  .desktop.opt-b .nav-links { display: flex; gap: 4px; margin-left: auto; }
  .opt-b .nav-link {
    min-height: 40px; padding: 0 12px; border-radius: 999px; color: var(--muted);
    text-decoration: none; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center;
  }
  .opt-b .nav-link[aria-current="page"] { background: var(--chip); color: var(--text); }
  `;

  const pinPositions = [
    [28, 35],
    [48, 42],
    [62, 28],
    [35, 58],
    [70, 55],
    [22, 48],
    [55, 68],
    [78, 38],
  ];

  /**
   * @param {'light'|'dark'} theme
   * @param {'phone'|'desktop'} device
   * @param {'home'|'detail'} screen
   */
  function frame(theme, device, screen) {
    const cls = device === 'phone' ? 'phone' : 'desktop';
    const wrapStart = device === 'desktop' ? `<div class="desktop-scale">` : '';
    const wrapEnd = device === 'desktop' ? `</div>` : '';

    if (screen === 'home') {
      const pins = SITTERS.map((s, i) => {
        const [x, y] = pinPositions[i];
        return `<button type="button" class="pin${i === 0 ? ' active' : ''}" style="left:${x}%;top:${y}%" aria-label="${escapeHtml(s.name)} in ${escapeHtml(s.hood)}">
          <img src="${s.avatar}" alt="" />
        </button>`;
      }).join('');

      const rows = SITTERS.map(
        (s, i) => `
        <li>
          <button type="button" class="rail-row${i === 0 ? ' active' : ''}">
            <img class="rail-avatar" src="${s.avatar}" alt="" />
            <div>
              <h2 class="rail-name">${escapeHtml(s.name)}</h2>
              <p class="rail-meta">${escapeHtml(s.hood)}</p>
              ${ratingHtml(s.score, s.reviews)}
              <div class="pills">${pillsHtml(s.pets)}</div>
              <div class="avail-dot">${availLabel(s.from, s.to)}</div>
            </div>
            <div class="rail-price">$${s.rate}<span>/night</span></div>
          </button>
        </li>`
      ).join('');

      const body = `
        <div class="stage">
          <div class="top">
            <a class="brand" href="#"><img src="${MARK}" alt="" width="36" height="36" /><span class="brand-name">${device === 'desktop' ? 'Pet Sitter Finder' : 'Sitters'}</span></a>
            <form class="search-over" role="search" aria-label="Find sitters">
              <label class="sr-only" for="b-q-${theme}-${device}">Search</label>
              <input id="b-q-${theme}-${device}" type="search" placeholder="Neighbourhood or name" />
              <button type="submit" aria-label="Search">Go</button>
            </form>
            ${
              device === 'desktop'
                ? `<nav class="nav-links" aria-label="Primary">
                    <a class="nav-link" href="#" aria-current="page">Map</a>
                    <a class="nav-link" href="#">About</a>
                    <a class="nav-link" href="#">Sign in</a>
                  </nav>`
                : ''
            }
            <button type="button" class="icon-btn" aria-label="Switch theme">${theme === 'light' ? 'Dark' : 'Light'}</button>
          </div>
          <div class="map" role="img" aria-label="Map of Toronto sitters">
            <div class="map-grid" aria-hidden="true"></div>
            ${pins}
          </div>
          <section class="sheet" aria-label="Sitter results">
            ${device === 'phone' ? `<div class="sheet-handle" aria-hidden="true"></div>` : ''}
            <div class="sheet-head">
              <h1>${SITTERS.length} sitters nearby</h1>
              <p>Toronto · sorted by distance</p>
            </div>
            <div class="date-row" role="toolbar" aria-label="Stay dates">
              <button type="button" class="date-chip" aria-pressed="true">Aug 12-16</button>
              <button type="button" class="date-chip" aria-pressed="false">This weekend</button>
              <button type="button" class="date-chip" aria-pressed="false">Flexible</button>
            </div>
            <ul class="rail">${rows}</ul>
            <div class="assist-dock">
              <button type="button" class="assist">Ask about sitters</button>
            </div>
          </section>
        </div>`;

      return `
      <div class="frame-wrap">
        <div class="frame-cap">${device === 'phone' ? '375' : '1280'} · ${theme} · ${screen}</div>
        ${wrapStart}
        <div class="${cls} opt-b" data-theme="${theme}">${body}</div>
        ${wrapEnd}
      </div>`;
    }

    // detail
    const s = DETAIL;
    const body = `
      <div class="detail-shell">
        <div class="top">
          <button type="button" class="icon-btn" aria-label="Back">Back</button>
          <a class="brand" href="#"><img src="${MARK}" alt="" width="36" height="36" /><span class="brand-name">Pet Sitter Finder</span></a>
          <button type="button" class="icon-btn" aria-label="Switch theme">${theme === 'light' ? 'Dark' : 'Light'}</button>
        </div>
        <div class="detail-map" role="img" aria-label="Map near ${escapeHtml(s.hood)}">
          <div class="map-grid" aria-hidden="true"></div>
          <button type="button" class="pin active" style="left:48%;top:52%" aria-label="${escapeHtml(s.name)}">
            <img src="${s.avatar}" alt="" />
          </button>
        </div>
        <div class="detail-panel">
          <img class="detail-avatar" src="${s.avatar}" alt="${escapeHtml(s.name)}" />
          <h1 class="detail-name">${escapeHtml(s.name)}</h1>
          <p class="detail-hood">${escapeHtml(s.hood)} · ~1.2 km</p>
          ${ratingHtml(s.score, s.reviews)}
          <div class="pills" style="margin-top:10px">${pillsHtml(s.pets)}</div>
          <div class="avail-dot" style="margin-top:10px">${availLabel(s.from, s.to)}</div>
          <p class="detail-bio">${escapeHtml(s.bio)}</p>
          ${
            device === 'desktop'
              ? `<div class="book-bar">
                  <div style="font-weight:800;font-size:20px">$${s.rate} <span style="font-weight:500;color:var(--muted);font-size:14px">/ night</span></div>
                  <div style="color:var(--muted);font-size:14px;margin:4px 0 8px">Aug 12 - Aug 16 selected</div>
                  <button type="button" class="book-cta">Request to book</button>
                </div>`
              : ''
          }
        </div>
        ${
          device === 'phone'
            ? `<div class="book-bar">
                <div>
                  <div style="font-weight:800;font-size:18px">$${s.rate}<span style="font-weight:500;color:var(--muted);font-size:13px"> / night</span></div>
                  <div style="font-size:12px;color:var(--muted)">Aug 12 - 16</div>
                </div>
                <button type="button" class="book-cta">Request to book</button>
              </div>`
            : ''
        }
      </div>`;

    return `
    <div class="frame-wrap">
      <div class="frame-cap">${device === 'phone' ? '375' : '1280'} · ${theme} · ${screen}</div>
      ${wrapStart}
      <div class="${cls} opt-b" data-theme="${theme}">${body}</div>
      ${wrapEnd}
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Option B - Map stage + sheet rail · Pet Sitter Finder</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    ${SHARED_SHELL}
    ${tokens}
  </style>
</head>
<body>
  <header class="page-head">
    <div class="arch">Option B</div>
    <h1>Map stage + sheet rail</h1>
    <p><strong>Architecture:</strong> full map with face pins owns the canvas; results live in a bottom sheet (phone) or side rail (desktop).
    <strong>Visual:</strong> sage trust green, soft map wash. Distinct element: avatar map pins and distance-sorted rail rows.</p>
  </header>
  <div class="section-label">Home - light</div>
  <div class="row">${frame('light', 'phone', 'home')}${frame('light', 'desktop', 'home')}</div>
  <div class="section-label">Home - dark</div>
  <div class="row">${frame('dark', 'phone', 'home')}${frame('dark', 'desktop', 'home')}</div>
  <div class="section-label">Sitter detail - light</div>
  <div class="row">${frame('light', 'phone', 'detail')}${frame('light', 'desktop', 'detail')}</div>
  <div class="section-label">Sitter detail - dark</div>
  <div class="row">${frame('dark', 'phone', 'detail')}${frame('dark', 'desktop', 'detail')}</div>
</body>
</html>`;
}

// --- OPTION C: Date-first calendar funnel ------------------------------------
function optionC() {
  const tokens = `
  .opt-c {
    --font: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
    --display: "Fraunces", Georgia, serif;
    --bg: var(--c-bg); --surface: var(--c-surface); --text: var(--c-text);
    --muted: var(--c-muted); --border: var(--c-border); --accent: var(--c-accent);
    --accent-ink: var(--c-accent-ink); --chip: var(--c-chip); --ok: var(--c-ok);
    --shadow: var(--c-shadow); --radius: 14px;
  }
  .opt-c[data-theme="light"] {
    --c-bg: #f7f1e6; --c-surface: #fffdf8; --c-text: #1a1510;
    --c-muted: #6a5d4e; --c-border: #e4d5c0; --c-accent: #c45c26;
    --c-accent-ink: #fffdf8; --c-chip: #f0e4d2; --c-ok: #2f6b3a;
    --c-shadow: 0 6px 20px rgba(26,21,16,0.08);
  }
  .opt-c[data-theme="dark"] {
    --c-bg: #12100e; --c-surface: #1c1915; --c-text: #f6efe4;
    --c-muted: #b5a792; --c-border: #3a332a; --c-accent: #e8894a;
    --c-accent-ink: #1a1510; --c-chip: #2a241c; --c-ok: #6dba78;
    --c-shadow: 0 6px 20px rgba(0,0,0,0.35);
  }
  .opt-c .nav {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 20;
  }
  .opt-c .brand { display: flex; align-items: center; gap: 10px; min-height: 44px; color: inherit; text-decoration: none; }
  .opt-c .brand img { width: 40px; height: 40px; border-radius: 12px; }
  .opt-c .brand-name { font-family: var(--display); font-weight: 700; font-size: 17px; letter-spacing: -0.02em; }
  .opt-c .nav-actions { display: flex; gap: 6px; align-items: center; }
  .opt-c .nav-link {
    min-height: 44px; padding: 0 12px; border-radius: 10px; color: var(--muted);
    text-decoration: none; font-weight: 700; font-size: 14px; display: inline-flex; align-items: center;
  }
  .opt-c .nav-link[aria-current="page"] { color: var(--text); background: var(--chip); }
  .opt-c .icon-btn {
    width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--border);
    background: var(--surface); color: var(--text);
  }
  .phone.opt-c .nav-links { display: none; }
  .desktop.opt-c .nav-links { display: flex; gap: 4px; }
  .opt-c .cal-hero {
    padding: 18px 16px 12px;
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, var(--bg)), var(--bg));
  }
  .desktop.opt-c .home-split {
    display: grid; grid-template-columns: 380px 1fr; gap: 0; flex: 1; min-height: 0;
  }
  .desktop.opt-c .cal-hero {
    border-right: 1px solid var(--border); height: 100%; overflow-y: auto; padding: 24px;
    position: sticky; top: 0;
  }
  .opt-c .cal-hero h1 {
    margin: 0 0 6px; font-family: var(--display); font-size: 28px; font-weight: 700;
    letter-spacing: -0.03em; line-height: 1.15;
  }
  .opt-c .cal-hero .lead { margin: 0 0 16px; color: var(--muted); font-size: 16px; }
  .opt-c .range-box {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px; box-shadow: var(--shadow); margin-bottom: 14px;
  }
  .opt-c .range-box .labels {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;
  }
  .opt-c .range-box label {
    display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
  }
  .opt-c .range-box input {
    min-height: 44px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text); padding: 0 10px; font-weight: 700;
  }
  .opt-c .month-title {
    display: flex; justify-content: space-between; align-items: center;
    font-weight: 800; margin-bottom: 8px; font-size: 15px;
  }
  .opt-c .month-nav button {
    width: 44px; height: 44px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text);
  }
  .opt-c .cal-grid {
    display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; text-align: center;
    width: 100%; min-width: 0;
  }
  .opt-c .cal-dow {
    font-size: 11px; font-weight: 800; color: var(--muted); padding: 6px 0; text-transform: uppercase;
    min-width: 0; overflow: hidden;
  }
  .opt-c .cal-day {
    min-height: 40px; border-radius: 10px; border: 0; background: transparent; color: var(--text);
    font-weight: 700; font-size: 14px; position: relative; min-width: 0; width: 100%; padding: 0;
  }
  /* Defect 2 fix: fit 7 columns at 375px without clipping Saturday */
  .phone.opt-c .cal-hero { padding: 14px 10px 10px; overflow-x: hidden; max-width: 100%; }
  .phone.opt-c .cal-grid { gap: 2px; }
  .phone.opt-c .cal-dow { font-size: 10px; padding: 4px 0; letter-spacing: 0; }
  .phone.opt-c .cal-day { min-height: 34px; font-size: 12px; border-radius: 8px; }
  .phone.opt-c .range-box { padding: 10px; }
  .phone.opt-c .range-box input { padding: 0 6px; font-size: 13px; }
  .opt-c .cal-day.muted { color: var(--muted); opacity: 0.45; }
  .opt-c .cal-day.in-range { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .opt-c .cal-day.range-end, .opt-c .cal-day.range-start {
    background: var(--accent); color: var(--accent-ink);
  }
  .opt-c .cal-day.has-sitters::after {
    content: ""; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
    width: 4px; height: 4px; border-radius: 50%; background: var(--ok);
  }
  .opt-c .search-inline {
    display: flex; gap: 8px; margin-top: 12px;
  }
  .opt-c .search-inline input {
    flex: 1; min-height: 44px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--surface); color: var(--text); padding: 0 12px; font-weight: 600;
  }
  .opt-c .search-inline button {
    min-height: 44px; padding: 0 16px; border: 0; border-radius: 10px;
    background: var(--accent); color: var(--accent-ink); font-weight: 800;
  }
  .opt-c .timeline-wrap { flex: 1; overflow-y: auto; padding: 12px 16px 16px; }
  .desktop.opt-c .timeline-wrap { padding: 20px 28px 16px; }
  .opt-c .timeline-meta {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 12px; color: var(--muted); font-size: 14px;
  }
  .opt-c .timeline-meta strong { color: var(--text); }
  .opt-c .timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .opt-c .t-row {
    display: grid; grid-template-columns: 72px 1fr; gap: 14px; align-items: start;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px; box-shadow: var(--shadow); text-align: left; color: inherit; width: 100%;
    min-height: 96px;
  }
  .opt-c .t-avatar {
    width: 72px; height: 72px; border-radius: 18px; object-fit: cover; background: var(--chip);
  }
  .opt-c .t-name { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
  .opt-c .t-hood { margin: 2px 0 6px; color: var(--muted); font-size: 14px; }
  .opt-c .rating { font-size: 13px; color: var(--muted); display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .opt-c .rating .stars { color: #c4892a; }
  .opt-c .rating .score { color: var(--text); font-weight: 800; }
  .opt-c .pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .opt-c .pill {
    min-height: 28px; padding: 0 10px; border-radius: 8px; display: inline-flex; align-items: center;
    background: var(--chip); border: 1px solid var(--border); font-size: 12px; font-weight: 700;
  }
  .opt-c .week-bar {
    display: grid; grid-template-columns: repeat(14, 1fr); gap: 3px; margin-top: 8px;
  }
  .opt-c .week-bar span {
    height: 10px; border-radius: 3px; background: var(--chip); border: 1px solid var(--border);
  }
  .opt-c .week-bar span.open { background: color-mix(in srgb, var(--ok) 55%, var(--chip)); border-color: var(--ok); }
  .opt-c .week-bar span.busy { background: color-mix(in srgb, var(--accent) 25%, var(--chip)); }
  .opt-c .t-foot {
    display: flex; justify-content: space-between; align-items: center; margin-top: 10px; gap: 8px;
  }
  .opt-c .t-price { font-weight: 800; font-size: 16px; }
  .opt-c .t-price span { font-weight: 500; color: var(--muted); font-size: 13px; }
  .opt-c .t-cta {
    min-height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text); font-weight: 800; font-size: 13px;
  }
  .opt-c .assist-dock {
    flex-shrink: 0; padding: 10px 16px max(12px, env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    border-top: 1px solid var(--border); z-index: 15;
  }
  .opt-c .assist {
    min-height: 48px; width: 100%; padding: 0 16px; border-radius: 12px; border: 0;
    background: var(--text); color: var(--bg); font-weight: 800; font-size: 14px;
    box-shadow: var(--shadow);
  }
  .desktop.opt-c .assist-dock { padding: 12px 28px 20px; }
  .desktop.opt-c .assist { max-width: 280px; margin-left: auto; }
  /* Detail */
  .opt-c .detail-top {
    display: grid; grid-template-columns: 120px 1fr; gap: 16px; padding: 20px 16px 8px; align-items: center;
  }
  .desktop.opt-c .detail-layout {
    display: grid; grid-template-columns: 1fr 360px; gap: 28px; padding: 28px; align-items: start;
  }
  .opt-c .detail-avatar {
    width: 120px; height: 120px; border-radius: 28px; object-fit: cover; border: 1px solid var(--border);
  }
  .opt-c .detail-name {
    margin: 0 0 4px; font-family: var(--display); font-size: 28px; font-weight: 700; letter-spacing: -0.03em;
  }
  .opt-c .detail-hood { margin: 0 0 8px; color: var(--muted); }
  .opt-c .detail-body { padding: 8px 16px 120px; }
  .desktop.opt-c .detail-body { padding: 0; }
  .opt-c .detail-bio { margin: 14px 0; line-height: 1.55; max-width: 60ch; }
  .opt-c .book-panel {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 16px; box-shadow: var(--shadow);
  }
  .opt-c .book-panel h3 { margin: 0 0 12px; font-family: var(--display); font-size: 22px; }
  .opt-c .book-bar {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 18;
    padding: 12px 16px max(12px, env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--surface) 95%, transparent); backdrop-filter: blur(10px);
    border-top: 1px solid var(--border); display: flex; gap: 12px; align-items: center;
  }
  .opt-c .book-cta {
    min-height: 48px; padding: 0 18px; border: 0; border-radius: 12px;
    background: var(--accent); color: var(--accent-ink); font-weight: 800;
  }
  .desktop.opt-c .book-panel .book-cta { width: 100%; margin-top: 10px; }
  .opt-c .crumb { font-size: 13px; color: var(--muted); margin-bottom: 10px; }
  `;

  /**
   * Half-month calendar cells for Aug 2026 with range 12-16 selected.
   */
  function calendarHtml() {
    const dows = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
      .map((d) => `<div class="cal-dow">${d}</div>`)
      .join('');
    // Aug 2026 starts Saturday
    const cells = [];
    for (let i = 0; i < 6; i++) cells.push(`<button type="button" class="cal-day muted" tabindex="-1">${26 + i}</button>`);
    for (let d = 1; d <= 31; d++) {
      let cls = 'cal-day';
      if (d >= 12 && d <= 16) cls += ' in-range';
      if (d === 12) cls += ' range-start';
      if (d === 16) cls += ' range-end';
      if ([1, 5, 8, 10, 12, 13, 14, 15, 16, 20, 22, 28].includes(d)) cls += ' has-sitters';
      cells.push(`<button type="button" class="${cls}" aria-label="August ${d}">${d}</button>`);
    }
    return `<div class="cal-grid">${dows}${cells.join('')}</div>`;
  }

  /**
   * Availability bar from available_from/to roughly mapped onto Aug half-month.
   * @param {Sitter} s
   */
  function weekBar(s) {
    const start = new Date(s.from + 'T12:00:00');
    const end = new Date(s.to + 'T12:00:00');
    const augStart = new Date('2026-08-01T12:00:00');
    const cells = [];
    for (let i = 0; i < 14; i++) {
      const day = new Date(augStart);
      day.setDate(1 + i);
      const open = day >= start && day <= end;
      // mark selected range 12-16 as "busy" visual for contrast when open
      const inTrip = i + 1 >= 12 && i + 1 <= 16;
      let cls = open ? 'open' : 'busy';
      if (open && inTrip) cls = 'open';
      if (!open) cls = 'busy';
      cells.push(`<span class="${cls}" title="${day.toISOString().slice(0, 10)}"></span>`);
    }
    return `<div class="week-bar" aria-label="Availability Aug 1-14">${cells.join('')}</div>`;
  }

  /**
   * @param {'light'|'dark'} theme
   * @param {'phone'|'desktop'} device
   * @param {'home'|'detail'} screen
   */
  function frame(theme, device, screen) {
    const cls = device === 'phone' ? 'phone' : 'desktop';
    const wrapStart = device === 'desktop' ? `<div class="desktop-scale">` : '';
    const wrapEnd = device === 'desktop' ? `</div>` : '';

    const nav = `
      <header class="nav">
        <a class="brand" href="#">
          <img src="${MARK}" alt="" width="40" height="40" />
          <span class="brand-name">Pet Sitter Finder</span>
        </a>
        <nav class="nav-links" aria-label="Primary">
          <a class="nav-link" href="#" ${screen === 'home' ? 'aria-current="page"' : ''}>Dates</a>
          <a class="nav-link" href="#">About</a>
          <a class="nav-link" href="#">Sign in</a>
        </nav>
        <div class="nav-actions">
          <button type="button" class="icon-btn" aria-label="Switch theme">${theme === 'light' ? 'Dark' : 'Light'}</button>
          ${device === 'phone' ? `<button type="button" class="icon-btn" aria-label="Menu">=</button>` : ''}
        </div>
      </header>`;

    if (screen === 'home') {
      const calBlock = `
        <section class="cal-hero">
          <h1>When do you need care?</h1>
          <p class="lead">Pick dates first - only sitters free for your stay appear below.</p>
          <div class="range-box">
            <div class="labels">
              <label>Check-in<input type="date" value="2026-08-12" /></label>
              <label>Check-out<input type="date" value="2026-08-16" /></label>
            </div>
            <div class="month-title">
              <span>August 2026</span>
              <div class="month-nav">
                <button type="button" aria-label="Previous month"><</button>
                <button type="button" aria-label="Next month">></button>
              </div>
            </div>
            ${calendarHtml()}
            <form class="search-inline" role="search" aria-label="Find sitters">
              <label class="sr-only" for="c-q-${theme}-${device}">Search sitters</label>
              <input id="c-q-${theme}-${device}" type="search" placeholder="Neighbourhood or name" />
              <button type="submit">Find</button>
            </form>
          </div>
        </section>`;

      const rows = SITTERS.map(
        (s) => `
        <li>
          <button type="button" class="t-row">
            <img class="t-avatar" src="${s.avatar}" alt="" />
            <div>
              <h2 class="t-name">${escapeHtml(s.name)}</h2>
              <p class="t-hood">${escapeHtml(s.hood)}</p>
              ${ratingHtml(s.score, s.reviews)}
              <div class="pills">${pillsHtml(s.pets)}</div>
              ${weekBar(s)}
              <div class="t-foot">
                <div class="t-price">$${s.rate}<span> / night</span></div>
                <span class="t-cta">See profile</span>
              </div>
            </div>
          </button>
        </li>`
      ).join('');

      const list = `
        <div class="timeline-wrap">
          <div class="timeline-meta">
            <span><strong>${SITTERS.length}</strong> open Aug 12-16</span>
            <span>Bars = Aug 1-14 availability</span>
          </div>
          <ul class="timeline">${rows}</ul>
        </div>`;

      const assistDock = `<div class="assist-dock"><button type="button" class="assist">Ask about sitters</button></div>`;

      const body =
        device === 'phone'
          ? `${nav}<div class="scroll">${calBlock}${list}</div>${assistDock}`
          : `${nav}<div class="home-split">${calBlock}${list}</div>${assistDock}`;

      return `
      <div class="frame-wrap">
        <div class="frame-cap">${device === 'phone' ? '375' : '1280'} · ${theme} · ${screen}</div>
        ${wrapStart}
        <div class="${cls} opt-c" data-theme="${theme}">${body}</div>
        ${wrapEnd}
      </div>`;
    }

    const s = DETAIL;
    const main = `
      <div class="detail-top">
        <img class="detail-avatar" src="${s.avatar}" alt="${escapeHtml(s.name)}" />
        <div>
          ${device === 'desktop' ? `<p class="crumb">Dates / ${escapeHtml(s.name)}</p>` : ''}
          <h1 class="detail-name">${escapeHtml(s.name)}</h1>
          <p class="detail-hood">${escapeHtml(s.hood)}</p>
          ${ratingHtml(s.score, s.reviews)}
        </div>
      </div>
      <div class="detail-body">
        <div class="pills">${pillsHtml(s.pets)}</div>
        <p class="detail-bio">${escapeHtml(s.bio)}</p>
        <h2 style="font-size:16px;margin:18px 0 8px;font-weight:800">Availability</h2>
        ${weekBar(s)}
        <p style="margin:8px 0 0;color:var(--muted);font-size:14px">${availLabel(s.from, s.to)}</p>
        <h2 style="font-size:16px;margin:18px 0 8px;font-weight:800">Guest note</h2>
        <p style="margin:0;color:var(--muted)">"Reliable evening walks and clear photo updates every night."</p>
      </div>`;

    const book = `
      <div class="book-panel">
        <h3>$${s.rate} <span style="font-weight:500;font-size:14px;color:var(--muted)">/ night</span></h3>
        <label class="date-field" style="display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Check-in
          <input type="date" value="2026-08-12" style="min-height:44px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);padding:0 10px;font-weight:700" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Check-out
          <input type="date" value="2026-08-16" style="min-height:44px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);padding:0 10px;font-weight:700" />
        </label>
        <button type="button" class="book-cta">Request to book</button>
      </div>`;

    const body =
      device === 'phone'
        ? `${nav}<div class="scroll">${main}</div>
           <div class="book-bar">
             <div>
               <div style="font-weight:800;font-size:18px">$${s.rate}<span style="font-weight:500;color:var(--muted);font-size:13px"> / night</span></div>
               <div style="font-size:12px;color:var(--muted)">Aug 12 - 16</div>
             </div>
             <button type="button" class="book-cta">Request to book</button>
           </div>`
        : `${nav}<div class="scroll"><div class="detail-layout"><div>${main}</div><aside>${book}</aside></div></div>`;

    return `
    <div class="frame-wrap">
      <div class="frame-cap">${device === 'phone' ? '375' : '1280'} · ${theme} · ${screen}</div>
      ${wrapStart}
      <div class="${cls} opt-c" data-theme="${theme}">${body}</div>
      ${wrapEnd}
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Option C - Date-first calendar funnel · Pet Sitter Finder</title>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Source+Sans+3:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    ${SHARED_SHELL}
    ${tokens}
  </style>
</head>
<body>
  <header class="page-head">
    <div class="arch">Option C</div>
    <h1>Date-first calendar funnel</h1>
    <p><strong>Architecture:</strong> check-in/out + half-month calendar owns the fold; sitters render as a timeline with week availability bars.
    <strong>Visual:</strong> honey amber + charcoal editorial type. Distinct element: calendar hero and per-row availability strips.</p>
  </header>
  <div class="section-label">Home - light</div>
  <div class="row">${frame('light', 'phone', 'home')}${frame('light', 'desktop', 'home')}</div>
  <div class="section-label">Home - dark</div>
  <div class="row">${frame('dark', 'phone', 'home')}${frame('dark', 'desktop', 'home')}</div>
  <div class="section-label">Sitter detail - light</div>
  <div class="row">${frame('light', 'phone', 'detail')}${frame('light', 'desktop', 'detail')}</div>
  <div class="section-label">Sitter detail - dark</div>
  <div class="row">${frame('dark', 'phone', 'detail')}${frame('dark', 'desktop', 'detail')}</div>
</body>
</html>`;
}

function gallery() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Design options gallery · Pet Sitter Finder</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: Inter, system-ui, sans-serif;
      background: #0d0d12; color: #f0f0f4; padding: 28px 20px 80px; line-height: 1.45;
    }
    header { max-width: 1400px; margin: 0 auto 24px; }
    header h1 { margin: 0 0 8px; font-size: 28px; font-weight: 900; letter-spacing: -0.03em; }
    header p { margin: 0; color: #a0a0ae; max-width: 72ch; font-size: 15px; }
    .note {
      margin-top: 14px; padding: 12px 14px; border: 1px solid #333344; background: #16161f;
      font-size: 13px; color: #c8c8d4; max-width: 80ch; border-radius: 8px;
    }
    .note strong { color: #fff; }
    .cols {
      max-width: 1400px; margin: 0 auto;
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px;
    }
    @media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
    .col {
      border: 1px solid #2a2a38; background: #14141c; border-radius: 12px; overflow: hidden;
      display: flex; flex-direction: column; min-height: 100%;
    }
    .col-head { padding: 16px; border-bottom: 1px solid #2a2a38; }
    .col-head .tag {
      display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.06em;
      text-transform: uppercase; border: 1px solid #f0f0f4; padding: 3px 8px; margin-bottom: 10px;
    }
    .col-head h2 { margin: 0 0 6px; font-size: 18px; font-weight: 800; }
    .col-head p { margin: 0; font-size: 13px; color: #9a9aab; }
    .col-head ul { margin: 10px 0 0; padding: 0; list-style: none; font-size: 12px; color: #b8b8c8; }
    .col-head li { padding: 3px 0; border-top: 1px solid #222230; }
    .col-head li:first-child { border-top: 0; }
    .col-head strong { color: #e8e8f0; }
    .frame-wrap { padding: 10px; background: #0a0a10; flex: 1; }
    iframe {
      width: 100%; height: 920px; border: 0; border-radius: 8px; background: #12141a; display: block;
    }
    .open-link {
      display: block; text-align: center; padding: 12px; font-size: 13px; font-weight: 700;
      color: #f07167; text-decoration: none; border-top: 1px solid #2a2a38;
    }
    .open-link:hover { background: #1a1a24; }
  </style>
</head>
<body>
  <header>
    <h1>Pet Sitter Finder - three design options</h1>
    <p>
      Each column is a different architecture and visual direction. Every option includes home + sitter detail
      at 375 and 1280, light and dark. Brand mark is the approved <strong>mark-01</strong> (coral house with dog and cat).
      Real seed sitters only. Mix freely: "layout of B, colour of C."
    </p>
    <div class="note">
      <strong>Choice is open.</strong> See <code>DECISION.md</code> for one-line architecture + visual direction per option.
      Do not treat prior "Option A chosen" notes as binding - this pass replaces them for owner review.
    </div>
  </header>
  <div class="cols">
    <article class="col">
      <div class="col-head">
        <div class="tag">Option A</div>
        <h2>Photo-card marketplace</h2>
        <p>Warm coral · soft depth · face-led cards</p>
        <ul>
          <li><strong>Primary surface:</strong> photo card grid</li>
          <li><strong>Search:</strong> floating multi-field capsule</li>
          <li><strong>Distinct element:</strong> price-on-photo badges + capsule search</li>
        </ul>
      </div>
      <div class="frame-wrap"><iframe src="option-a.html" title="Option A full frames"></iframe></div>
      <a class="open-link" href="option-a.html" target="_blank" rel="noopener">Open Option A full page</a>
    </article>
    <article class="col">
      <div class="col-head">
        <div class="tag">Option B</div>
        <h2>Map stage + sheet rail</h2>
        <p>Sage trust green · map-first · pin faces</p>
        <ul>
          <li><strong>Primary surface:</strong> map with avatar pins</li>
          <li><strong>Results:</strong> bottom sheet / side rail</li>
          <li><strong>Distinct element:</strong> face pins + distance rail</li>
        </ul>
      </div>
      <div class="frame-wrap"><iframe src="option-b.html" title="Option B full frames"></iframe></div>
      <a class="open-link" href="option-b.html" target="_blank" rel="noopener">Open Option B full page</a>
    </article>
    <article class="col">
      <div class="col-head">
        <div class="tag">Option C</div>
        <h2>Date-first calendar funnel</h2>
        <p>Honey amber · editorial type · timeline bars</p>
        <ul>
          <li><strong>Primary surface:</strong> check-in calendar hero</li>
          <li><strong>Results:</strong> timeline rows with week bars</li>
          <li><strong>Distinct element:</strong> half-month grid + availability strips</li>
        </ul>
      </div>
      <div class="frame-wrap"><iframe src="option-c.html" title="Option C full frames"></iframe></div>
      <a class="open-link" href="option-c.html" target="_blank" rel="noopener">Open Option C full page</a>
    </article>
  </div>
</body>
</html>`;
}

function decisionMd() {
  return `# Design options - Pet Sitter Finder

**Date:** 2026-08-05  
**Status:** Choice open - owner has not picked.  
**Artifacts:** \`option-a.html\`, \`option-b.html\`, \`option-c.html\`, \`gallery.html\`  
**Brand mark:** \`mark-01.png\` (approved coral house with dog + cat) in every option. Favicon should derive from the same mark when implementing.

## One-line per option

| Option | Architecture | Visual direction |
|--------|--------------|------------------|
| **A** | Floating multi-field search capsule Go full-bleed photo cards with faces Go sticky booking bar on detail | Warm coral on cream, soft 20px radii, Airbnb-class depth; price-on-photo badges |
| **B** | Map stage owns the canvas; results in a bottom sheet (phone) or side rail (desktop) with avatar pins | Sage trust green, soft map wash; face pins and distance-sorted rail rows |
| **C** | Date-first funnel: check-in/out + half-month calendar hero, then timeline rows with week availability bars | Honey amber + charcoal editorial type (Fraunces + Source Sans); availability strips |

## Shared requirements (all three)

- mark-01 logo only - never invent a new mark
- Real seed sitters (8 rows from \`0003_rebuild.sql\`): names, neighbourhoods, rates, pet types, availability, review counts
- Pet types as pills; ratings as score + stars when a review row exists (else Verified + count); availability on every card
- Light and dark via semantic tokens; 44px targets; 16px body; no RedAnvil shell (no plain white sticky header + bordered 2-col white cards)
- Home + sitter detail at 375 and 1280 in both themes

## Structural differences (not palette swaps)

| | A | B | C |
|--|---|---|---|
| What owns the fold | Search capsule + first photo cards | Map | Calendar + date range |
| Result unit | Large photo card | Compact rail row | Timeline row + week bar |
| Spatial model | Vertical page flow | Split map + sheet/rail | Calendar column + list |
| Absent in that option | No map, no calendar hero | No photo grid page, no calendar hero | No map, no photo card grid |

## Choice

**Leave open.** Owner may pick one option, or mix (e.g. "layout of B, colour of C").  
Do not implement into production until a choice is recorded here.
`;
}

writeFileSync(join(__dir, 'option-a.html'), optionA(), 'utf8');
writeFileSync(join(__dir, 'option-b.html'), optionB(), 'utf8');
writeFileSync(join(__dir, 'option-c.html'), optionC(), 'utf8');
writeFileSync(join(__dir, 'gallery.html'), gallery(), 'utf8');
// DECISION.md is owner-owned — do not overwrite it from this builder.
console.log('Wrote option-a/b/c.html, gallery.html');

