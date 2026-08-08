/**
 * Build five palette directions for sushi-finder.
 * Colour is one axis; component treatment is another — each direction gets its
 * own card shape, image ratio, chip style, type scale and density so the
 * gallery is not five hex swaps of the same skeleton.
 *
 * Food imagery is shared across columns (honest comparison); treatment varies.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Shared product photography — same four plates in every column. */
const FOOD = {
  a: 'food/plate-omakase.jpg',
  b: 'food/plate-conveyor.jpg',
  c: 'food/plate-counter.jpg',
  d: 'food/plate-modern.jpg',
};

/**
 * @typedef {{ bg: string, surface: string, text: string, muted: string, border: string, primary: string, primaryContrast: string, success: string }} ThemeTokens
 */

/**
 * Component treatment axes (must differ across the five):
 * - layout: grid2 | list | stack | rows | mon-grid
 * - cardShape: elevated | hard-border | paper | flat-list | mon-ring
 * - imageRatio: square | four-three | full-bleed | thumb | square-ring
 * - chipStyle: filled | outline | underline | segmented | filled-ceremonial
 * - density: compact | tight | generous | dense-list | airy
 */

/**
 * @typedef {object} Palette
 * @property {string} id
 * @property {string} file
 * @property {string} name
 * @property {string} role
 * @property {string} temperature
 * @property {string} contrast
 * @property {string} typeVoice
 * @property {string} display
 * @property {string} body
 * @property {string} fontsUrl
 * @property {string} displayStack
 * @property {string} bodyStack
 * @property {ThemeTokens} light
 * @property {ThemeTokens} dark
 * @property {string} notes
 * @property {string} layout
 * @property {string} cardShape
 * @property {string} imageRatio
 * @property {string} chipStyle
 * @property {string} density
 * @property {string} treatmentSummary
 * @property {string} inspoSource
 */

/** @type {Palette[]} */
const PALETTES = [
  {
    id: 'palette-01',
    file: 'palette-01.html',
    name: 'Night Counter',
    role: 'Dark-first',
    temperature: 'Cool-neutral charcoal with warm coral heat on actions',
    contrast: 'High — near-black lacquer surfaces, bright coral CTAs, strong type',
    typeVoice: 'Geometric display (Syne) + clean product sans (DM Sans)',
    display: 'Syne',
    body: 'DM Sans',
    fontsUrl:
      'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@600;700;800&display=swap',
    displayStack: '"Syne", system-ui, sans-serif',
    bodyStack: '"DM Sans", system-ui, sans-serif',
    light: {
      bg: '#f3f4f7',
      surface: '#ffffff',
      text: '#12151c',
      muted: '#5a6478',
      border: '#d0d5e0',
      primary: '#c23b2e',
      primaryContrast: '#ffffff',
      success: '#0b6b45',
    },
    dark: {
      bg: '#0c0e12',
      surface: '#161a22',
      text: '#eef0f4',
      muted: '#a0a8b8',
      border: '#2e3545',
      primary: '#ff6b5b',
      primaryContrast: '#0c0e12',
      success: '#3dd68c',
    },
    notes:
      'Designed dark-first for late-night restaurant hunting. Light theme is a derived companion, not the default voice.',
    layout: 'grid2',
    cardShape: 'elevated',
    imageRatio: 'square',
    chipStyle: 'filled',
    density: 'compact',
    treatmentSummary:
      '2-col elevated cards (16px radius, soft shadow, no border), square photos, filled chips, compact gaps, bold Syne titles.',
    inspoSource:
      'Kura Sushi Rewards — availability / walk-in status as a first-class signal on the result unit (not buried).',
  },
  {
    id: 'palette-02',
    file: 'palette-02.html',
    name: 'Ink Line',
    role: 'Near-monochrome + single accent',
    temperature: 'Neutral greys only — no hue in surfaces; one vermillion accent',
    contrast: 'Hard ink-on-paper — pure structure, accent reserved for primary actions and focus',
    typeVoice: 'Single utilitarian face (Inter) at all sizes — no display flourish',
    display: 'Inter',
    body: 'Inter',
    fontsUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    displayStack: '"Inter", system-ui, sans-serif',
    bodyStack: '"Inter", system-ui, sans-serif',
    light: {
      bg: '#fafafa',
      surface: '#ffffff',
      text: '#171717',
      muted: '#525252',
      border: '#e5e5e5',
      primary: '#b91c1c',
      primaryContrast: '#ffffff',
      success: '#15803d',
    },
    dark: {
      bg: '#0a0a0a',
      surface: '#171717',
      text: '#f5f5f5',
      muted: '#a3a3a3',
      border: '#2e2e2e',
      primary: '#f87171',
      primaryContrast: '#0a0a0a',
      success: '#4ade80',
    },
    notes:
      'Photos and food carry all colour. UI is graphite so the grid of plates is the chroma.',
    layout: 'list',
    cardShape: 'hard-border',
    imageRatio: 'four-three',
    chipStyle: 'outline',
    density: 'tight',
    treatmentSummary:
      'Single-column list rows, 4px radius, 1px hard border, no shadow, 4:3 thumbs left, outline chips, Inter only, tight density.',
    inspoSource:
      'Sushi Score — sparse utilitarian chrome; data (count/status) carries weight, not decoration.',
  },
  {
    id: 'palette-03',
    file: 'palette-03.html',
    name: 'Omakase Paper',
    role: 'Warm editorial serif',
    temperature: 'Warm — cream paper, toasted browns, brick primary',
    contrast: 'Soft magazine contrast — ink on paper, never pure black on pure white',
    typeVoice: 'Editorial serif pair (Fraunces display + Source Serif 4 body)',
    display: 'Fraunces',
    body: 'Source Serif 4',
    fontsUrl:
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&display=swap',
    displayStack: '"Fraunces", "Times New Roman", serif',
    bodyStack: '"Source Serif 4", Georgia, serif',
    light: {
      bg: '#f7f0e6',
      surface: '#fffaf3',
      text: '#2a2118',
      muted: '#6b5d4d',
      border: '#e0d4c4',
      primary: '#9a3412',
      primaryContrast: '#fffaf3',
      success: '#3f6212',
    },
    dark: {
      bg: '#1a1510',
      surface: '#26201a',
      text: '#f7efe4',
      muted: '#b8a894',
      border: '#3f352b',
      primary: '#f0a060',
      primaryContrast: '#1a1510',
      success: '#9fd35a',
    },
    notes:
      'Reads like a printed guide to counters, not a delivery app. Warm paper in light; low amber room light in dark.',
    layout: 'stack',
    cardShape: 'paper',
    imageRatio: 'full-bleed',
    chipStyle: 'underline',
    density: 'generous',
    treatmentSummary:
      'Stacked full-width magazine cards, 20px radius, no border, soft paper shadow, full-bleed heroes, underline chips, large Fraunces, generous air.',
    inspoSource:
      'Amberjack — Rare Sushi Finds — editorial rare-find framing; search/browse feels like a guide, not a delivery grid.',
  },
  {
    id: 'palette-04',
    file: 'palette-04.html',
    name: 'Harbor Mist',
    role: 'Cool low-chroma',
    temperature: 'Cool — slate teal, mist greys, desaturated sea air',
    contrast: 'Low-chroma separation — hue shifts small; value hierarchy does the work',
    typeVoice: 'Quiet technical (IBM Plex Sans) — map-and-list competence',
    display: 'IBM Plex Sans',
    body: 'IBM Plex Sans',
    fontsUrl:
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
    displayStack: '"IBM Plex Sans", system-ui, sans-serif',
    bodyStack: '"IBM Plex Sans", system-ui, sans-serif',
    light: {
      bg: '#f0f4f7',
      surface: '#ffffff',
      text: '#1e2a32',
      muted: '#556874',
      border: '#d0dbe3',
      primary: '#2f5f6d',
      primaryContrast: '#ffffff',
      success: '#1b5e45',
    },
    dark: {
      bg: '#0f1418',
      surface: '#1a2228',
      text: '#e4ebf0',
      muted: '#92a2ad',
      border: '#2c3842',
      primary: '#7eb8c9',
      primaryContrast: '#0f1418',
      success: '#6bcb8e',
    },
    notes:
      'For map-heavy browsing and city hops. No warm food hues in chrome — keep plates vivid against cool UI.',
    layout: 'rows',
    cardShape: 'flat-list',
    imageRatio: 'thumb',
    chipStyle: 'segmented',
    density: 'dense-list',
    treatmentSummary:
      'Dense list rows, 8px flat cards, hairline border, no shadow, 40px thumbs, segmented control chips, compact Plex type.',
    inspoSource:
      'Sushi Shop (livraison) — list/order competence; filters as a segmented control, not pill soup.',
  },
  {
    id: 'palette-05',
    file: 'palette-05.html',
    name: 'Mon Crest',
    role: 'Strongest idea — indigo mon + koi coral',
    temperature: 'Cool indigo ink with warm coral action heat (dual-temperature brand)',
    contrast: 'Ceremonial high contrast — deep indigo fields, coral as the single hot signal',
    typeVoice: 'Premium dual: Cormorant Garamond display + Manrope body',
    display: 'Cormorant Garamond',
    body: 'Manrope',
    fontsUrl:
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Manrope:wght@400;500;600;700;800&display=swap',
    displayStack: '"Cormorant Garamond", Georgia, serif',
    bodyStack: '"Manrope", system-ui, sans-serif',
    light: {
      bg: '#f6f5fc',
      surface: '#ffffff',
      text: '#1a1744',
      muted: '#5b5878',
      border: '#ddd9ef',
      primary: '#c02636',
      primaryContrast: '#ffffff',
      success: '#0f766e',
    },
    dark: {
      bg: '#0c0b1a',
      surface: '#16142a',
      text: '#eeeef8',
      muted: '#a8a4c4',
      border: '#2e2a4a',
      primary: '#ff6b75',
      primaryContrast: '#0c0b1a',
      success: '#2dd4bf',
    },
    notes:
      'Strongest idea: pairs with the mon-crest logo direction (indigo ring + coral koi). Dark theme is lacquer indigo night; light is rice paper with indigo ink. Not a coral-on-grey food app default.',
    layout: 'mon-grid',
    cardShape: 'mon-ring',
    imageRatio: 'square-ring',
    chipStyle: 'filled-ceremonial',
    density: 'airy',
    treatmentSummary:
      '2-col mon cards, 14px radius + indigo ring on photo, soft elevation, square images with ring inset, ceremonial filled chips, large Cormorant, airy padding.',
    inspoSource:
      'Sushi Diner / Master Chef store framing — ceremonial badge energy without cloning game chrome; mon ring as photo frame.',
  },
];

/** Restaurant rows used in every treatment (same data; different presentation). */
const PLACES = [
  {
    name: 'Sushi Nakazawa',
    meta: 'Counter · $$$$ · 0.8 km',
    badge: 'Walk-ins limited',
    rating: '4.9 · 412 reviews',
    photo: FOOD.a,
    price: '$$$$',
    kind: 'Counter',
  },
  {
    name: 'Kura Revolving',
    meta: 'Conveyor · $$ · 1.1 km',
    badge: 'Walk-in open',
    rating: '4.4 · 2.1k reviews',
    photo: FOOD.b,
    price: '$$',
    kind: 'Conveyor',
  },
  {
    name: 'Sushi Yasuda',
    meta: 'Counter · $$$ · 1.6 km',
    badge: 'Seats from 18:30',
    rating: '4.7 · 890 reviews',
    photo: FOOD.c,
    price: '$$$',
    kind: 'Counter',
  },
  {
    name: 'Sugarfish',
    meta: 'Counter · $$$ · 2.0 km',
    badge: 'Walk-in open',
    rating: '4.5 · 3.4k reviews',
    photo: FOOD.d,
    price: '$$$',
    kind: 'Counter',
  },
];

/**
 * @param {ThemeTokens} t
 * @param {string} prefix
 */
function themeVars(t, prefix) {
  return `
    --${prefix}-bg: ${t.bg};
    --${prefix}-surface: ${t.surface};
    --${prefix}-text: ${t.text};
    --${prefix}-muted: ${t.muted};
    --${prefix}-border: ${t.border};
    --${prefix}-primary: ${t.primary};
    --${prefix}-primary-contrast: ${t.primaryContrast};
    --${prefix}-success: ${t.success};`;
}

/**
 * Chip row markup — structure differs by chipStyle.
 * @param {Palette} p
 */
function chipsMarkup(p) {
  const labels = ['Photos', 'Map', 'Seating', 'Counter', 'Walk-in'];
  if (p.chipStyle === 'segmented') {
    return `
            <div class="chips chips--segmented" role="tablist" aria-label="Style filters">
              ${labels
                .slice(0, 3)
                .map(
                  (lab, i) =>
                    `<button type="button" class="chip${i === 0 ? ' chip--on' : ''}" role="tab" aria-selected="${i === 0}">${lab}</button>`,
                )
                .join('')}
            </div>`;
  }
  if (p.chipStyle === 'underline') {
    return `
            <div class="chips chips--underline" role="list" aria-label="Style filters">
              ${labels
                .map(
                  (lab, i) =>
                    `<button type="button" class="chip${i === 0 ? ' chip--on' : ''}" role="listitem">${lab}</button>`,
                )
                .join('')}
            </div>`;
  }
  return `
            <div class="chips chips--${p.chipStyle}" role="list" aria-label="Style filters">
              ${labels
                .map(
                  (lab, i) =>
                    `<button type="button" class="chip${i === 0 ? ' chip--on' : ''}" role="listitem">${lab}</button>`,
                )
                .join('')}
            </div>`;
}

/**
 * Result cards — structurally different per layout.
 * @param {Palette} p
 */
function resultsMarkup(p) {
  if (p.layout === 'list') {
    return `
            <div class="results results--list" role="list" aria-label="Restaurant photos">
              ${PLACES.map(
                (pl) => `
              <article class="card card--list" role="listitem">
                <div class="photo photo--43" style="background-image:url('${pl.photo}')" role="img" aria-label="Photo of ${pl.name}"></div>
                <div class="card-body">
                  <h2 class="card-title">${pl.name}</h2>
                  <p class="card-meta">${pl.meta}</p>
                  <p class="card-row"><span class="badge-ok">${pl.badge}</span><span class="rating">${pl.rating}</span></p>
                </div>
              </article>`,
              ).join('')}
            </div>`;
  }

  if (p.layout === 'stack') {
    return `
            <div class="results results--stack" role="list" aria-label="Restaurant photos">
              ${PLACES.map(
                (pl) => `
              <article class="card card--stack" role="listitem">
                <div class="photo photo--bleed" style="background-image:url('${pl.photo}')" role="img" aria-label="Photo of ${pl.name}"></div>
                <div class="card-body">
                  <h2 class="card-title">${pl.name}</h2>
                  <p class="card-meta">${pl.meta}</p>
                  <p class="card-row"><span class="badge-ok">${pl.badge}</span><span class="rating">${pl.rating}</span></p>
                </div>
              </article>`,
              ).join('')}
            </div>`;
  }

  if (p.layout === 'rows') {
    return `
            <div class="results results--rows" role="list" aria-label="Restaurant list">
              ${PLACES.map(
                (pl) => `
              <article class="card card--row" role="listitem">
                <div class="photo photo--thumb" style="background-image:url('${pl.photo}')" role="img" aria-label="Photo of ${pl.name}"></div>
                <div class="card-body">
                  <div class="row-top">
                    <h2 class="card-title">${pl.name}</h2>
                    <span class="price">${pl.price}</span>
                  </div>
                  <p class="card-meta">${pl.kind} · ${pl.meta.split('·').pop().trim()}</p>
                  <p class="card-row"><span class="badge-ok">${pl.badge}</span><span class="rating">${pl.rating}</span></p>
                </div>
              </article>`,
              ).join('')}
            </div>`;
  }

  if (p.layout === 'mon-grid') {
    return `
            <div class="results results--mon" role="list" aria-label="Restaurant photos">
              ${PLACES.map(
                (pl) => `
              <article class="card card--mon" role="listitem">
                <div class="photo-ring">
                  <div class="photo photo--sq" style="background-image:url('${pl.photo}')" role="img" aria-label="Photo of ${pl.name}"></div>
                </div>
                <div class="card-body">
                  <h2 class="card-title">${pl.name}</h2>
                  <p class="card-meta">${pl.meta}</p>
                  <p class="card-row"><span class="badge-ok">${pl.badge}</span><span class="rating">${pl.rating}</span></p>
                </div>
              </article>`,
              ).join('')}
            </div>`;
  }

  // grid2 — Night Counter default
  return `
            <div class="results results--grid2" role="list" aria-label="Restaurant photos">
              ${PLACES.map(
                (pl) => `
              <article class="card card--elev" role="listitem">
                <div class="photo photo--sq" style="background-image:url('${pl.photo}')" role="img" aria-label="Photo of ${pl.name}"></div>
                <div class="card-body">
                  <h2 class="card-title">${pl.name}</h2>
                  <p class="card-meta">${pl.meta}</p>
                  <p class="card-row"><span class="badge-ok">${pl.badge}</span><span class="rating">${pl.rating}</span></p>
                </div>
              </article>`,
              ).join('')}
            </div>`;
}

/**
 * Phone chrome + treatment-specific screen.
 * @param {'light' | 'dark'} theme
 * @param {Palette} p
 * @param {'full' | 'gallery'} scale
 */
function phoneMarkup(theme, p, scale = 'full') {
  const label = theme === 'light' ? 'Light' : 'Dark';
  return `
      <figure class="phone-wrap phone-wrap--${p.id} treat-${p.layout}" data-theme="${theme}" data-palette="${p.id}">
        <figcaption class="phone-cap">${label}</figcaption>
        <div class="phone phone--${scale}" data-screen="photos-grid" data-theme-label="${label}">
          <div class="phone-inner treat-${p.layout} density-${p.density} chips-${p.chipStyle}" aria-label="Sushi Finder — ${label} theme, ${p.name}">
            <header class="app-header">
              <div class="brand">
                <span class="mark" aria-hidden="true">す</span>
                <div>
                  <p class="app-name">Sushi Finder</p>
                  <p class="app-loc">Near Tokyo · 2.4 km</p>
                </div>
              </div>
              <button type="button" class="icon-btn" aria-label="Open filters">⋮</button>
            </header>

            <div class="search-row">
              <label class="search">
                <span class="sr-only">Search sushi restaurants</span>
                <input type="search" value="omakase walk-in" readonly aria-readonly="true" />
              </label>
            </div>

            ${chipsMarkup(p)}

            <p class="results-meta"><span class="results-count">12 open now</span> · sorted by distance</p>

            ${resultsMarkup(p)}

            <nav class="tabbar" aria-label="Primary">
              <a class="tab tab--on" href="#" aria-current="page">Photos</a>
              <a class="tab" href="#">Map</a>
              <a class="tab" href="#">Seating</a>
            </nav>
          </div>
        </div>
      </figure>`;
}

/**
 * Shared phone CSS for a given scale. Treatment differences are class-driven.
 * @param {'full' | 'gallery'} scale
 */
function phoneCss(scale) {
  const phoneW = scale === 'full' ? 320 : 260;
  const minH = scale === 'full' ? 640 : 560;
  const fs = scale === 'full' ? 16 : 14;
  const pad = scale === 'full' ? 14 : 12;

  return `
    .phone-wrap { margin: 0; }
    .phone-cap {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--page-muted, #8b93a3);
      margin: 0 0 6px;
      font-family: ui-monospace, Consolas, monospace;
    }
    .phone {
      width: ${phoneW}px;
      border-radius: 24px;
      padding: 8px;
      background: #0a0a0c;
      border: 1px solid #3a3f4a;
      box-shadow: 0 12px 28px rgba(0,0,0,0.4);
    }
    .phone-inner {
      border-radius: 18px;
      overflow: hidden;
      min-height: ${minH}px;
      max-height: ${minH + 40}px;
      display: flex;
      flex-direction: column;
      background: var(--bg);
      color: var(--text);
      font-family: var(--body);
      font-size: ${fs}px;
      line-height: 1.35;
    }
    .phone-wrap[data-theme="light"] .phone-inner {
      --bg: var(--light-bg);
      --surface: var(--light-surface);
      --text: var(--light-text);
      --muted: var(--light-muted);
      --border: var(--light-border);
      --primary: var(--light-primary);
      --primary-contrast: var(--light-primary-contrast);
      --success: var(--light-success);
    }
    .phone-wrap[data-theme="dark"] .phone-inner {
      --bg: var(--dark-bg);
      --surface: var(--dark-surface);
      --text: var(--dark-text);
      --muted: var(--dark-muted);
      --border: var(--dark-border);
      --primary: var(--dark-primary);
      --primary-contrast: var(--dark-primary-contrast);
      --success: var(--dark-success);
    }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); border: 0;
    }
    .app-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: ${pad - 2}px ${pad}px 6px; background: var(--surface);
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .brand { display: flex; gap: 8px; align-items: center; }
    .mark {
      width: 32px; height: 32px; border-radius: 9px; background: var(--primary);
      color: var(--primary-contrast); display: grid; place-items: center;
      font-family: var(--display); font-weight: 700; font-size: 0.95rem;
    }
    .app-name {
      margin: 0; font-family: var(--display); font-weight: 700;
      letter-spacing: -0.02em; color: var(--text);
    }
    .app-loc { margin: 0; font-size: 0.72rem; color: var(--muted); }
    .icon-btn {
      min-width: 40px; min-height: 40px; border: 1px solid var(--border);
      border-radius: 9px; background: var(--bg); color: var(--text); font-size: 1rem; cursor: default;
    }
    .search-row { padding: 8px ${pad}px 0; flex-shrink: 0; }
    .search input {
      width: 100%; min-height: 40px; border: 1px solid var(--border); border-radius: 10px;
      padding: 8px 10px; background: var(--surface); color: var(--text); font: inherit; font-size: inherit;
    }
    .results-meta { margin: 6px ${pad}px 4px; font-size: 0.75rem; color: var(--muted); flex-shrink: 0; }
    .results-count { color: var(--text); font-weight: 600; }
    .tabbar {
      display: grid; grid-template-columns: 1fr 1fr 1fr;
      border-top: 1px solid var(--border); background: var(--surface);
      margin-top: auto; flex-shrink: 0;
    }
    .tab {
      min-height: 44px; display: grid; place-items: center; text-decoration: none;
      color: var(--muted); font-size: 0.78rem; font-weight: 600;
    }
    .tab--on { color: var(--primary); }
    .badge-ok { font-weight: 600; color: var(--success); }
    .rating { color: var(--muted); }
    .card-meta { margin: 0 0 4px; color: var(--muted); }
    .card-row { margin: 0; display: flex; flex-direction: column; gap: 2px; }
    .card-title { margin: 0 0 2px; font-family: var(--display); color: var(--text); }
    .photo {
      background-size: cover; background-position: center; background-repeat: no-repeat;
      flex-shrink: 0;
    }

    /* ——— chips ——— */
    .chips { display: flex; gap: 6px; padding: 10px ${pad}px 2px; overflow-x: auto; flex-shrink: 0; }
    .chip {
      flex: 0 0 auto; min-height: 32px; padding: 4px 10px;
      font: inherit; font-size: 0.75rem; font-weight: 600; cursor: default;
    }
    /* filled */
    .chips--filled .chip, .chips--filled-ceremonial .chip {
      border-radius: 999px; border: 1px solid var(--border);
      background: var(--surface); color: var(--text);
    }
    .chips--filled .chip--on, .chips--filled-ceremonial .chip--on {
      background: var(--primary); border-color: var(--primary); color: var(--primary-contrast);
    }
    .chips--filled-ceremonial .chip:not(.chip--on) {
      background: transparent; border-color: var(--border); color: var(--muted);
    }
    /* outline */
    .chips--outline .chip {
      border-radius: 6px; border: 1.5px solid var(--border);
      background: transparent; color: var(--text);
    }
    .chips--outline .chip--on {
      border-color: var(--primary); color: var(--primary);
      background: transparent; box-shadow: inset 0 -2px 0 var(--primary);
    }
    /* underline */
    .chips--underline {
      gap: 14px; border-bottom: 1px solid var(--border); padding-bottom: 0;
    }
    .chips--underline .chip {
      border: none; background: transparent; color: var(--muted);
      border-radius: 0; padding: 6px 2px 10px; min-height: 0;
      font-weight: 500; letter-spacing: 0.01em;
    }
    .chips--underline .chip--on {
      color: var(--text); font-weight: 700;
      box-shadow: inset 0 -2px 0 var(--primary);
    }
    /* segmented */
    .chips--segmented {
      gap: 0; padding: 10px ${pad}px 4px;
    }
    .chips--segmented .chip {
      flex: 1; border-radius: 0; border: 1px solid var(--border);
      background: var(--surface); color: var(--muted); text-align: center;
      min-height: 34px; padding: 6px 4px; font-size: 0.72rem;
    }
    .chips--segmented .chip:first-child { border-radius: 8px 0 0 8px; }
    .chips--segmented .chip:last-child { border-radius: 0 8px 8px 0; }
    .chips--segmented .chip + .chip { border-left: none; }
    .chips--segmented .chip--on {
      background: var(--primary); border-color: var(--primary); color: var(--primary-contrast);
      z-index: 1;
    }

    /* ——— layout: grid2 elevated (Night Counter) ——— */
    .treat-grid2 .app-name { font-size: 1.05rem; }
    .treat-grid2 .results--grid2 {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      padding: 2px ${pad}px 12px; flex: 1; overflow: auto;
    }
    .treat-grid2 .card--elev {
      background: var(--surface); border: none; border-radius: 16px;
      overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 4px 14px rgba(0,0,0,0.14);
    }
    .phone-wrap[data-theme="light"] .treat-grid2 .card--elev {
      box-shadow: 0 4px 16px rgba(18,21,28,0.1);
    }
    .treat-grid2 .photo--sq { aspect-ratio: 1 / 1; width: 100%; }
    .treat-grid2 .card-body { padding: 8px 9px 10px; }
    .treat-grid2 .card-title { font-size: 0.88rem; font-weight: 800; line-height: 1.15; }
    .treat-grid2 .card-meta { font-size: 0.68rem; }
    .treat-grid2 .badge-ok, .treat-grid2 .rating { font-size: 0.65rem; }
    .treat-grid2 .search input { border-radius: 12px; }

    /* ——— layout: list hard-border (Ink Line) ——— */
    .treat-list .app-name { font-size: 0.92rem; font-weight: 700; letter-spacing: -0.01em; }
    .treat-list .results--list {
      display: flex; flex-direction: column; gap: 0;
      padding: 0; flex: 1; overflow: auto;
      border-top: 1px solid var(--border);
    }
    .treat-list .card--list {
      display: grid; grid-template-columns: 88px 1fr; gap: 0;
      background: var(--surface); border: none;
      border-bottom: 1px solid var(--border); border-radius: 0;
      overflow: hidden;
    }
    .treat-list .photo--43 {
      width: 88px; height: 72px; align-self: stretch; height: 100%;
      min-height: 72px; border-right: 1px solid var(--border);
    }
    .treat-list .card-body { padding: 8px 10px; display: flex; flex-direction: column; justify-content: center; }
    .treat-list .card-title { font-size: 0.82rem; font-weight: 600; line-height: 1.2; }
    .treat-list .card-meta { font-size: 0.68rem; margin-bottom: 3px; }
    .treat-list .badge-ok, .treat-list .rating { font-size: 0.65rem; }
    .treat-list .card-row { flex-direction: row; flex-wrap: wrap; gap: 6px; align-items: center; }
    .treat-list .search input { border-radius: 4px; }
    .treat-list .icon-btn { border-radius: 4px; }
    .treat-list .mark { border-radius: 4px; }

    /* ——— layout: stack paper (Omakase Paper) ——— */
    .treat-stack .app-name { font-size: 1.2rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; }
    .treat-stack .app-loc { font-size: 0.78rem; line-height: 1.5; }
    .treat-stack .results--stack {
      display: flex; flex-direction: column; gap: 16px;
      padding: 8px ${pad + 2}px 16px; flex: 1; overflow: auto;
    }
    .treat-stack .card--stack {
      background: var(--surface); border: none; border-radius: 20px;
      overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 8px 24px rgba(42,33,24,0.1);
    }
    .phone-wrap[data-theme="dark"] .treat-stack .card--stack {
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }
    .treat-stack .photo--bleed {
      width: 100%; aspect-ratio: 16 / 10; min-height: 100px;
    }
    .treat-stack .card-body { padding: 14px 14px 16px; }
    .treat-stack .card-title {
      font-size: 1.15rem; font-weight: 700; line-height: 1.25; margin-bottom: 4px;
      letter-spacing: -0.02em;
    }
    .treat-stack .card-meta { font-size: 0.8rem; line-height: 1.45; margin-bottom: 8px; }
    .treat-stack .badge-ok, .treat-stack .rating { font-size: 0.75rem; }
    .treat-stack .card-row { flex-direction: row; gap: 12px; flex-wrap: wrap; }
    .treat-stack .search input {
      border-radius: 999px; border: none; background: var(--bg);
      box-shadow: inset 0 0 0 1px var(--border);
    }
    .treat-stack .mark { border-radius: 50%; }
    .treat-stack .icon-btn { border-radius: 50%; border: none; background: var(--bg); }
    .treat-stack .results-meta { margin-top: 10px; margin-bottom: 4px; font-size: 0.8rem; }

    /* ——— layout: rows flat-list (Harbor Mist) ——— */
    .treat-rows .app-name { font-size: 0.9rem; font-weight: 600; letter-spacing: 0; }
    .treat-rows .results--rows {
      display: flex; flex-direction: column; gap: 6px;
      padding: 4px ${pad}px 10px; flex: 1; overflow: auto;
    }
    .treat-rows .card--row {
      display: grid; grid-template-columns: 40px 1fr; gap: 10px; align-items: center;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 8px; box-shadow: none;
    }
    .treat-rows .photo--thumb {
      width: 40px; height: 40px; border-radius: 6px;
      border: 1px solid var(--border);
    }
    .treat-rows .card-body { padding: 0; min-width: 0; }
    .treat-rows .row-top {
      display: flex; justify-content: space-between; align-items: baseline; gap: 6px;
    }
    .treat-rows .card-title {
      font-size: 0.8rem; font-weight: 600; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .treat-rows .price {
      font-size: 0.72rem; font-weight: 600; color: var(--primary); flex-shrink: 0;
    }
    .treat-rows .card-meta { font-size: 0.68rem; margin-bottom: 2px; }
    .treat-rows .badge-ok, .treat-rows .rating { font-size: 0.62rem; }
    .treat-rows .card-row { flex-direction: row; gap: 8px; flex-wrap: wrap; }
    .treat-rows .search input { border-radius: 6px; min-height: 36px; }
    .treat-rows .app-header { padding-top: 10px; padding-bottom: 4px; }
    .treat-rows .mark { border-radius: 6px; width: 28px; height: 28px; font-size: 0.85rem; }

    /* ——— layout: mon-grid (Mon Crest) ——— */
    .treat-mon-grid .app-name {
      font-size: 1.15rem; font-weight: 700; letter-spacing: 0.01em; line-height: 1.1;
    }
    .treat-mon-grid .results--mon {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      padding: 6px ${pad + 2}px 14px; flex: 1; overflow: auto;
    }
    .treat-mon-grid .card--mon {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 14px; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 2px 10px rgba(26,23,68,0.08);
    }
    .phone-wrap[data-theme="dark"] .treat-mon-grid .card--mon {
      box-shadow: 0 2px 12px rgba(0,0,0,0.35);
      border-color: #2e2a4a;
    }
    .treat-mon-grid .photo-ring {
      padding: 8px 8px 0; background: var(--surface);
    }
    .treat-mon-grid .photo--sq {
      aspect-ratio: 1 / 1; width: 100%; border-radius: 50%;
      box-shadow: 0 0 0 2px var(--border), 0 0 0 4px var(--surface);
      border: 2px solid var(--primary);
    }
    .phone-wrap[data-theme="dark"] .treat-mon-grid .photo--sq {
      box-shadow: 0 0 0 2px #2e2a4a, 0 0 0 4px var(--surface);
    }
    .treat-mon-grid .card-body { padding: 10px 10px 12px; text-align: center; }
    .treat-mon-grid .card-title {
      font-size: 1rem; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em;
    }
    .treat-mon-grid .card-meta { font-size: 0.68rem; }
    .treat-mon-grid .badge-ok, .treat-mon-grid .rating { font-size: 0.65rem; }
    .treat-mon-grid .card-row { align-items: center; }
    .treat-mon-grid .mark {
      border-radius: 50%; width: 34px; height: 34px;
      box-shadow: 0 0 0 2px var(--border);
    }
    .treat-mon-grid .search input { border-radius: 12px; }
  `;
}

/**
 * @param {Palette} p
 */
function paletteHtml(p) {
  const tokenRows = (/** @type {ThemeTokens} */ t) =>
    [
      ['bg', t.bg],
      ['surface', t.surface],
      ['text', t.text],
      ['muted', t.muted],
      ['border', t.border],
      ['primary', t.primary],
      ['primary-contrast', t.primaryContrast],
      ['success', t.success],
    ]
      .map(
        ([k, v]) =>
          `<tr><td>${k}</td><td><span class="swatch" style="background:${v}"></span><code>${v}</code></td></tr>`,
      )
      .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${p.id} — ${p.name} · sushi-finder palette</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${p.fontsUrl}" rel="stylesheet" />
  <style>
    :root {
      --page-bg: #101218;
      --page-text: #e8eaef;
      --page-muted: #9aa3b2;
      --page-border: #2a2f3a;
      --page-card: #181b22;
      --display: ${p.displayStack};
      --body: ${p.bodyStack};
      ${themeVars(p.light, 'light')}
      ${themeVars(p.dark, 'dark')}
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px 20px 64px;
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--page-bg);
      color: var(--page-text);
      line-height: 1.45;
    }
    h1 {
      font-size: 1.4rem;
      font-weight: 700;
      margin: 0 0 6px;
      letter-spacing: -0.02em;
    }
    .meta {
      color: var(--page-muted);
      font-size: 0.95rem;
      max-width: 52rem;
      margin: 0 0 20px;
    }
    .meta strong { color: var(--page-text); font-weight: 600; }
    .axes {
      display: grid;
      gap: 8px;
      margin: 0 0 24px;
      max-width: 52rem;
      font-size: 0.9rem;
    }
    .axes dt {
      color: var(--page-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 0;
    }
    .axes dd { margin: 0 0 8px; }
    .token-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      max-width: 720px;
      margin-bottom: 28px;
    }
    @media (max-width: 640px) {
      .token-block { grid-template-columns: 1fr; }
    }
    .token-card {
      background: var(--page-card);
      border: 1px solid var(--page-border);
      border-radius: 12px;
      padding: 14px 16px;
    }
    .token-card h2 {
      margin: 0 0 10px;
      font-size: 0.95rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    td {
      padding: 4px 0;
      border-bottom: 1px solid #242830;
      vertical-align: middle;
    }
    td:first-child {
      color: var(--page-muted);
      width: 42%;
      font-family: ui-monospace, Consolas, monospace;
      font-size: 0.78rem;
    }
    code {
      font-family: ui-monospace, Consolas, monospace;
      font-size: 0.78rem;
    }
    .swatch {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1px solid rgba(255,255,255,0.15);
      margin-right: 8px;
      vertical-align: middle;
    }
    .type-row {
      margin: 0 0 24px;
      font-size: 0.9rem;
      color: var(--page-muted);
    }
    .type-row span {
      color: var(--page-text);
      font-weight: 600;
    }
    .phones {
      display: flex;
      flex-wrap: wrap;
      gap: 28px;
      align-items: flex-start;
    }
    ${phoneCss('full')}
    .axe-note {
      margin-top: 28px;
      max-width: 52rem;
      font-size: 0.85rem;
      color: var(--page-muted);
      border-top: 1px solid var(--page-border);
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <h1>${p.id}: ${p.name}</h1>
  <p class="meta">
    <strong>Role:</strong> ${p.role}.
    ${p.notes}
  </p>
  <dl class="axes">
    <dt>Temperature</dt>
    <dd>${p.temperature}</dd>
    <dt>Contrast strategy</dt>
    <dd>${p.contrast}</dd>
    <dt>Type voice</dt>
    <dd>${p.typeVoice}</dd>
    <dt>Component treatment</dt>
    <dd>${p.treatmentSummary}</dd>
    <dt>Reference insight</dt>
    <dd>${p.inspoSource}</dd>
  </dl>

  <p class="type-row">Display: <span>${p.display}</span> · Body: <span>${p.body}</span> · Body floor 16px (full board)</p>

  <div class="token-block">
    <div class="token-card">
      <h2>Light tokens</h2>
      <table>
        <tbody>
          ${tokenRows(p.light)}
        </tbody>
      </table>
    </div>
    <div class="token-card">
      <h2>Dark tokens</h2>
      <table>
        <tbody>
          ${tokenRows(p.dark)}
        </tbody>
      </table>
    </div>
  </div>

  <div class="phones">
    ${phoneMarkup('light', p, 'full')}
    ${phoneMarkup('dark', p, 'full')}
  </div>

  <p class="axe-note">
    WCAG AA measured with <strong>axe-core</strong> (not hand-computed) via
    <code>measure-a11y.mjs</code> against both phone themes on this file.
    Results written to <code>axe-results.json</code> and summarised in
    <code>DECISION.md</code>. Shared food photos under <code>food/</code>.
  </p>
</body>
</html>
`;
}

/**
 * Gallery: one column per direction, light + dark phones of the same screen.
 * Treatments differ so columns are distinguishable at a glance.
 */
function galleryHtml() {
  const fontLinks = [...new Set(PALETTES.map((p) => p.fontsUrl))]
    .map((href) => `  <link href="${href}" rel="stylesheet" />`)
    .join('\n');

  const colCss = PALETTES.map((p) => {
    const id = p.id;
    return `
    .col[data-id="${id}"] {
      --display: ${p.displayStack};
      --body: ${p.bodyStack};
      ${themeVars(p.light, 'light')}
      ${themeVars(p.dark, 'dark')}
    }`;
  }).join('\n');

  const cols = PALETTES.map(
    (p) => `
    <section class="col" data-id="${p.id}">
      <header class="col-head">
        <p class="id">${p.id}</p>
        <h2>${p.name}</h2>
        <p class="role">${p.role}</p>
        <p class="axis"><span>Temp</span> ${p.temperature}</p>
        <p class="axis"><span>Contrast</span> ${p.contrast}</p>
        <p class="axis"><span>Type</span> ${p.display} + ${p.body}</p>
        <p class="axis"><span>Layout</span> ${p.layout} · ${p.chipStyle} chips · ${p.density}</p>
        <p class="axis treat-line"><span>Treatment</span> ${p.treatmentSummary}</p>
        <p class="swatches" aria-hidden="true">
          <i style="background:${p.light.bg}"></i>
          <i style="background:${p.light.primary}"></i>
          <i style="background:${p.dark.bg}"></i>
          <i style="background:${p.dark.primary}"></i>
        </p>
        <p class="link"><a href="${p.file}">Open full board (tokens) →</a></p>
      </header>
      <div class="phones">
        ${phoneMarkup('light', p, 'gallery')}
        ${phoneMarkup('dark', p, 'gallery')}
      </div>
    </section>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sushi Finder — palette directions 1–5</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${fontLinks}
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px 20px 80px;
      background: #0b0d12;
      color: #e8eaef;
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.45;
    }
    h1 {
      font-size: 1.45rem;
      margin: 0 0 8px;
      letter-spacing: -0.02em;
    }
    .lede {
      color: #9aa3b2;
      max-width: 78ch;
      margin: 0 0 24px;
      font-size: 0.95rem;
    }
    .lede strong { color: #e8eaef; }
    .cols {
      display: grid;
      grid-template-columns: repeat(5, minmax(300px, 1fr));
      gap: 20px;
      overflow-x: auto;
      padding-bottom: 12px;
      align-items: start;
    }
    @media (max-width: 1600px) {
      .cols { grid-template-columns: repeat(3, minmax(300px, 1fr)); }
    }
    @media (max-width: 1000px) {
      .cols { grid-template-columns: repeat(2, minmax(300px, 1fr)); }
    }
    @media (max-width: 680px) {
      .cols { grid-template-columns: 1fr; }
    }
    .col {
      background: #151820;
      border: 1px solid #2a2f3a;
      border-radius: 16px;
      overflow: hidden;
      min-width: 0;
    }
    .col-head {
      padding: 14px 14px 12px;
      border-bottom: 1px solid #2a2f3a;
    }
    .id {
      margin: 0;
      font-family: ui-monospace, Consolas, monospace;
      font-size: 0.75rem;
      color: #7d8799;
    }
    .col-head h2 {
      margin: 4px 0 2px;
      font-size: 1.15rem;
    }
    .role {
      margin: 0 0 10px;
      font-size: 0.85rem;
      color: #c4cad6;
      font-weight: 600;
    }
    .axis {
      margin: 0 0 4px;
      font-size: 0.78rem;
      color: #9aa3b2;
    }
    .axis span {
      display: inline-block;
      min-width: 4.5rem;
      color: #6b7385;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 0.68rem;
      font-weight: 600;
    }
    .treat-line { line-height: 1.35; }
    .swatches {
      display: flex;
      gap: 6px;
      margin: 10px 0 0;
    }
    .swatches i {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.18);
      display: block;
    }
    .link { margin: 10px 0 0; font-size: 0.85rem; }
    .link a { color: #8eb6ff; }
    .phones {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      padding: 14px;
      background: #0c0e12;
      justify-content: center;
    }
    --page-muted: #8b93a3;
    ${colCss}
    ${phoneCss('gallery')}
    footer {
      margin-top: 28px;
      color: #7d8799;
      font-size: 0.85rem;
      max-width: 80ch;
    }
    footer a { color: #8eb6ff; }
  </style>
</head>
<body>
  <h1>Sushi Finder — five palette directions</h1>
  <p class="lede">
    Colour is its own choice axis, but a direction is <strong>not a hex swap</strong>.
    Each column is a complete direction: tokens + type + <strong>component treatment</strong>
    (card shape, image ratio, chip style, type scale, density) on the same restaurant
    screen — in <strong>light</strong> and <strong>dark</strong>. Same real food photos
    across columns so the comparison stays honest. WCAG AA measured with axe-core on
    every direction (both themes). Choice is <strong>OPEN</strong>.
  </p>
  <div class="cols">
    ${cols}
  </div>
  <footer>
    Full token boards: 01 · 02 · 03 · 04 · 05.
    Decision record: <a href="DECISION.md">DECISION.md</a> (OPEN).
    Shared plates: <code>food/</code>. Insights logged in <a href="../SOURCES.md">SOURCES.md</a>.
  </footer>
</body>
</html>
`;
}

function writeJson() {
  const slim = PALETTES.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    temperature: p.temperature,
    contrast: p.contrast,
    typeVoice: p.typeVoice,
    display: p.display,
    body: p.body,
    light: p.light,
    dark: p.dark,
    notes: p.notes,
    layout: p.layout,
    cardShape: p.cardShape,
    imageRatio: p.imageRatio,
    chipStyle: p.chipStyle,
    density: p.density,
    treatmentSummary: p.treatmentSummary,
    inspoSource: p.inspoSource,
  }));
  writeFileSync(join(__dirname, 'palettes.json'), JSON.stringify(slim, null, 2), 'utf8');
}

function main() {
  for (const p of PALETTES) {
    const path = join(__dirname, p.file);
    writeFileSync(path, paletteHtml(p), 'utf8');
    console.log('wrote', p.file);
  }
  writeFileSync(join(__dirname, 'gallery.html'), galleryHtml(), 'utf8');
  console.log('wrote gallery.html');
  writeJson();
  console.log('wrote palettes.json');

  const foodDir = join(__dirname, 'food');
  if (!existsSync(foodDir)) {
    console.warn('WARN: food/ missing — cards will show empty image areas until plates are generated.');
  } else {
    for (const rel of Object.values(FOOD)) {
      if (!existsSync(join(__dirname, rel))) {
        console.warn('WARN: missing', rel);
      }
    }
  }
}

main();
