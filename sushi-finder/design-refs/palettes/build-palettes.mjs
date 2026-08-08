/**
 * Build five palette directions for sushi-finder.
 * Colour is its own choice axis — temperature, contrast strategy, type voice.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @typedef {{ bg: string, surface: string, text: string, muted: string, border: string, primary: string, primaryContrast: string, success: string }} ThemeTokens */

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
  },
];

/**
 * Phone chrome + photos-grid screen. Identical structure across palettes.
 * @param {'light' | 'dark'} theme
 * @param {Palette} p
 */
function phoneMarkup(theme, p) {
  const label = theme === 'light' ? 'Light' : 'Dark';
  return `
      <figure class="phone-wrap" data-theme="${theme}">
        <figcaption class="phone-cap">${label}</figcaption>
        <div class="phone" data-screen="photos-grid" data-theme-label="${label}">
          <div class="phone-inner" aria-label="Sushi Finder photos grid — ${label} theme, ${p.name}">
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

            <div class="chips" role="list" aria-label="Style filters">
              <button type="button" class="chip chip--on" role="listitem">Photos</button>
              <button type="button" class="chip" role="listitem">Map</button>
              <button type="button" class="chip" role="listitem">Seating</button>
              <button type="button" class="chip" role="listitem">Counter</button>
              <button type="button" class="chip" role="listitem">Walk-in</button>
            </div>

            <p class="results-meta"><span class="results-count">12 open now</span> · sorted by distance</p>

            <div class="grid" role="list" aria-label="Restaurant photos">
              <article class="card" role="listitem">
                <div class="photo photo-a" aria-hidden="true"></div>
                <div class="card-body">
                  <h2 class="card-title">Sushi Nakazawa</h2>
                  <p class="card-meta">Counter · $$$$ · 0.8 km</p>
                  <p class="card-row"><span class="badge-ok">Walk-ins limited</span><span class="rating">4.9 · 412 reviews</span></p>
                </div>
              </article>
              <article class="card" role="listitem">
                <div class="photo photo-b" aria-hidden="true"></div>
                <div class="card-body">
                  <h2 class="card-title">Kura Revolving</h2>
                  <p class="card-meta">Conveyor · $$ · 1.1 km</p>
                  <p class="card-row"><span class="badge-ok">Walk-in open</span><span class="rating">4.4 · 2.1k reviews</span></p>
                </div>
              </article>
              <article class="card" role="listitem">
                <div class="photo photo-c" aria-hidden="true"></div>
                <div class="card-body">
                  <h2 class="card-title">Sushi Yasuda</h2>
                  <p class="card-meta">Counter · $$$ · 1.6 km</p>
                  <p class="card-row"><span class="badge-ok">Seats from 18:30</span><span class="rating">4.7 · 890 reviews</span></p>
                </div>
              </article>
              <article class="card" role="listitem">
                <div class="photo photo-d" aria-hidden="true"></div>
                <div class="card-body">
                  <h2 class="card-title">Sugarfish</h2>
                  <p class="card-meta">Counter · $$$ · 2.0 km</p>
                  <p class="card-row"><span class="badge-ok">Walk-in open</span><span class="rating">4.5 · 3.4k reviews</span></p>
                </div>
              </article>
            </div>

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
 * @param {Palette} p
 */
function paletteHtml(p) {
  const tokenRows = (theme, t) =>
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
    .phone-wrap { margin: 0; }
    .phone-cap {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--page-muted);
      margin: 0 0 8px;
      font-family: ui-monospace, Consolas, monospace;
    }
    .phone {
      width: 320px;
      border-radius: 28px;
      padding: 10px;
      background: #0a0a0c;
      border: 1px solid #3a3f4a;
      box-shadow: 0 16px 40px rgba(0,0,0,0.45);
    }
    .phone-inner {
      border-radius: 20px;
      overflow: hidden;
      min-height: 640px;
      display: flex;
      flex-direction: column;
      background: var(--bg);
      color: var(--text);
      font-family: var(--body);
      font-size: 16px;
      line-height: 1.4;
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
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      border: 0;
    }
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 14px 8px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .brand { display: flex; gap: 10px; align-items: center; }
    .mark {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--primary);
      color: var(--primary-contrast);
      display: grid;
      place-items: center;
      font-family: var(--display);
      font-weight: 700;
      font-size: 1.05rem;
    }
    .app-name {
      margin: 0;
      font-family: var(--display);
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .app-loc {
      margin: 0;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .icon-btn {
      min-width: 44px;
      min-height: 44px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
      color: var(--text);
      font-size: 1.1rem;
      cursor: default;
    }
    .search-row { padding: 10px 14px 0; }
    .search input {
      width: 100%;
      min-height: 44px;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 12px;
      background: var(--surface);
      color: var(--text);
      font: inherit;
      font-size: 16px;
    }
    .chips {
      display: flex;
      gap: 8px;
      padding: 12px 14px 4px;
      overflow-x: auto;
    }
    .chip {
      flex: 0 0 auto;
      min-height: 36px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: default;
    }
    .chip--on {
      background: var(--primary);
      border-color: var(--primary);
      color: var(--primary-contrast);
    }
    .results-meta {
      margin: 8px 14px 6px;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .results-count {
      color: var(--text);
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 4px 14px 16px;
      flex: 1;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .photo {
      height: 88px;
      border-bottom: 1px solid var(--border);
    }
    /* Decorative plate tiles — not product photos; hue only for mock structure */
    .photo-a { background: linear-gradient(145deg, #3a2a28 0%, #8b3a32 55%, #d4a574 100%); }
    .photo-b { background: linear-gradient(145deg, #1a2e28 0%, #2f6b55 50%, #c4d4c8 100%); }
    .photo-c { background: linear-gradient(145deg, #1e2438 0%, #4a5580 50%, #e8d5c4 100%); }
    .photo-d { background: linear-gradient(145deg, #2a2218 0%, #6b4a2a 50%, #f0c8a0 100%); }
    .phone-wrap[data-theme="light"] .photo-a { background: linear-gradient(145deg, #f0d0c8 0%, #c45a4a 55%, #8b2e24 100%); }
    .phone-wrap[data-theme="light"] .photo-b { background: linear-gradient(145deg, #d8ebe4 0%, #3d8f72 50%, #1a4a38 100%); }
    .phone-wrap[data-theme="light"] .photo-c { background: linear-gradient(145deg, #dde2f0 0%, #5a6aaa 50%, #2a3050 100%); }
    .phone-wrap[data-theme="light"] .photo-d { background: linear-gradient(145deg, #f5e6d4 0%, #c48a4a 50%, #5a3818 100%); }
    .card-body { padding: 8px 10px 10px; }
    .card-title {
      margin: 0 0 2px;
      font-family: var(--display);
      font-size: 0.92rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text);
      line-height: 1.25;
    }
    .card-meta {
      margin: 0 0 6px;
      font-size: 0.72rem;
      color: var(--muted);
    }
    .card-row {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .badge-ok {
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--success);
    }
    .rating {
      font-size: 0.68rem;
      color: var(--muted);
    }
    .tabbar {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      border-top: 1px solid var(--border);
      background: var(--surface);
      margin-top: auto;
    }
    .tab {
      min-height: 48px;
      display: grid;
      place-items: center;
      text-decoration: none;
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 600;
    }
    .tab--on {
      color: var(--primary);
    }
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
  </dl>

  <p class="type-row">Display: <span>${p.display}</span> · Body: <span>${p.body}</span> · Body floor 16px</p>

  <div class="token-block">
    <div class="token-card">
      <h2>Light tokens</h2>
      <table>
        <tbody>
          ${tokenRows('light', p.light)}
        </tbody>
      </table>
    </div>
    <div class="token-card">
      <h2>Dark tokens</h2>
      <table>
        <tbody>
          ${tokenRows('dark', p.dark)}
        </tbody>
      </table>
    </div>
  </div>

  <div class="phones">
    ${phoneMarkup('light', p)}
    ${phoneMarkup('dark', p)}
  </div>

  <p class="axe-note">
    WCAG AA measured with <strong>axe-core</strong> (not hand-computed) via
    <code>measure-a11y.mjs</code> against both phone themes on this file.
    Results written to <code>axe-results.json</code> and summarised in
    <code>DECISION.md</code>.
  </p>
</body>
</html>
`;
}

/**
 * Gallery: one column per direction, light + dark phones of the same screen.
 * Phones are inlined (not full-board iframes) so colour/type is the only axis visible.
 */
function galleryHtml() {
  const fontLinks = [
    ...new Set(PALETTES.map((p) => p.fontsUrl)),
  ]
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
        <p class="swatches" aria-hidden="true">
          <i style="background:${p.light.bg}"></i>
          <i style="background:${p.light.primary}"></i>
          <i style="background:${p.dark.bg}"></i>
          <i style="background:${p.dark.primary}"></i>
        </p>
        <p class="link"><a href="${p.file}">Open full board (tokens) →</a></p>
      </header>
      <div class="phones">
        ${phoneMarkup('light', p)}
        ${phoneMarkup('dark', p)}
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
    .phone-wrap { margin: 0; }
    .phone-cap {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8b93a3;
      margin: 0 0 6px;
      font-family: ui-monospace, Consolas, monospace;
    }
    .phone {
      width: 260px;
      border-radius: 24px;
      padding: 8px;
      background: #0a0a0c;
      border: 1px solid #3a3f4a;
      box-shadow: 0 12px 28px rgba(0,0,0,0.4);
    }
    .phone-inner {
      border-radius: 18px;
      overflow: hidden;
      min-height: 560px;
      display: flex;
      flex-direction: column;
      background: var(--bg);
      color: var(--text);
      font-family: var(--body);
      font-size: 14px;
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
    ${colCss}
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); border: 0;
    }
    .app-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 12px 6px; background: var(--surface); border-bottom: 1px solid var(--border);
    }
    .brand { display: flex; gap: 8px; align-items: center; }
    .mark {
      width: 32px; height: 32px; border-radius: 9px; background: var(--primary);
      color: var(--primary-contrast); display: grid; place-items: center;
      font-family: var(--display); font-weight: 700; font-size: 0.95rem;
    }
    .app-name {
      margin: 0; font-family: var(--display); font-weight: 700; font-size: 0.95rem;
      letter-spacing: -0.02em; color: var(--text);
    }
    .app-loc { margin: 0; font-size: 0.72rem; color: var(--muted); }
    .icon-btn {
      min-width: 40px; min-height: 40px; border: 1px solid var(--border);
      border-radius: 9px; background: var(--bg); color: var(--text); font-size: 1rem; cursor: default;
    }
    .search-row { padding: 8px 12px 0; }
    .search input {
      width: 100%; min-height: 40px; border: 1px solid var(--border); border-radius: 10px;
      padding: 8px 10px; background: var(--surface); color: var(--text); font: inherit; font-size: 14px;
    }
    .chips { display: flex; gap: 6px; padding: 10px 12px 2px; overflow-x: auto; }
    .chip {
      flex: 0 0 auto; min-height: 32px; padding: 4px 10px; border-radius: 999px;
      border: 1px solid var(--border); background: var(--surface); color: var(--text);
      font: inherit; font-size: 0.75rem; font-weight: 600; cursor: default;
    }
    .chip--on {
      background: var(--primary); border-color: var(--primary); color: var(--primary-contrast);
    }
    .results-meta { margin: 6px 12px 4px; font-size: 0.75rem; color: var(--muted); }
    .results-count { color: var(--text); font-weight: 600; }
    .grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 2px 12px 12px; flex: 1;
    }
    .card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      overflow: hidden; display: flex; flex-direction: column;
    }
    .photo { height: 72px; border-bottom: 1px solid var(--border); }
    .photo-a { background: linear-gradient(145deg, #3a2a28 0%, #8b3a32 55%, #d4a574 100%); }
    .photo-b { background: linear-gradient(145deg, #1a2e28 0%, #2f6b55 50%, #c4d4c8 100%); }
    .photo-c { background: linear-gradient(145deg, #1e2438 0%, #4a5580 50%, #e8d5c4 100%); }
    .photo-d { background: linear-gradient(145deg, #2a2218 0%, #6b4a2a 50%, #f0c8a0 100%); }
    .phone-wrap[data-theme="light"] .photo-a { background: linear-gradient(145deg, #f0d0c8 0%, #c45a4a 55%, #8b2e24 100%); }
    .phone-wrap[data-theme="light"] .photo-b { background: linear-gradient(145deg, #d8ebe4 0%, #3d8f72 50%, #1a4a38 100%); }
    .phone-wrap[data-theme="light"] .photo-c { background: linear-gradient(145deg, #dde2f0 0%, #5a6aaa 50%, #2a3050 100%); }
    .phone-wrap[data-theme="light"] .photo-d { background: linear-gradient(145deg, #f5e6d4 0%, #c48a4a 50%, #5a3818 100%); }
    .card-body { padding: 6px 8px 8px; }
    .card-title {
      margin: 0 0 2px; font-family: var(--display); font-size: 0.82rem; font-weight: 700;
      letter-spacing: -0.01em; color: var(--text); line-height: 1.2;
    }
    .card-meta { margin: 0 0 4px; font-size: 0.65rem; color: var(--muted); }
    .card-row { margin: 0; display: flex; flex-direction: column; gap: 1px; }
    .badge-ok { font-size: 0.62rem; font-weight: 600; color: var(--success); }
    .rating { font-size: 0.62rem; color: var(--muted); }
    .tabbar {
      display: grid; grid-template-columns: 1fr 1fr 1fr; border-top: 1px solid var(--border);
      background: var(--surface); margin-top: auto;
    }
    .tab {
      min-height: 44px; display: grid; place-items: center; text-decoration: none;
      color: var(--muted); font-size: 0.72rem; font-weight: 600;
    }
    .tab--on { color: var(--primary); }
    .foot {
      margin-top: 24px; color: #9aa3b2; font-size: 0.85rem; max-width: 70ch;
    }
  </style>
</head>
<body>
  <h1>Sushi Finder — five palette directions</h1>
  <p class="lede">
    Colour is its own choice axis. Each column is one complete direction
    (tokens + type) on the <strong>same real screen</strong> — Photos grid with
    search, filters, restaurant cards, and tab bar — in <strong>light</strong>
    and <strong>dark</strong>. Only colour and type vary.
    WCAG AA measured with axe-core on every direction × both themes
    (see <code>axe-results.json</code> and <code>DECISION.md</code>). Choice is
    <strong>OPEN</strong>.
  </p>
  <div class="cols">
    ${cols}
  </div>
  <p class="foot">
    Full token boards: <a href="palette-01.html" style="color:#8eb6ff">01</a> ·
    <a href="palette-02.html" style="color:#8eb6ff">02</a> ·
    <a href="palette-03.html" style="color:#8eb6ff">03</a> ·
    <a href="palette-04.html" style="color:#8eb6ff">04</a> ·
    <a href="palette-05.html" style="color:#8eb6ff">05</a>.
    Decision record: <a href="DECISION.md" style="color:#8eb6ff">DECISION.md</a> (OPEN).
  </p>
</body>
</html>
`;
}

mkdirSync(__dirname, { recursive: true });

for (const p of PALETTES) {
  const path = join(__dirname, p.file);
  writeFileSync(path, paletteHtml(p), 'utf8');
  console.log('wrote', p.file);
}

writeFileSync(join(__dirname, 'gallery.html'), galleryHtml(), 'utf8');
console.log('wrote gallery.html');

writeFileSync(
  join(__dirname, 'palettes.json'),
  JSON.stringify(
    PALETTES.map((p) => ({
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
    })),
    null,
    2,
  ),
  'utf8',
);
console.log('wrote palettes.json');
