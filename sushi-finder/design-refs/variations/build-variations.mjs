/**
 * Build six full-app design variations for sushi-finder.
 * Each pairs a NAMED skeleton with its own palette + type voice.
 * Output: var-0N-*.html, gallery.html
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, 'renders'), { recursive: true });

/** Shared restaurant data — real seed restaurants */
const RESTAURANTS = [
  {
    id: 'nakazawa',
    name: 'Sushi Nakazawa',
    style: 'Counter',
    price: '$$$$',
    dist: '0.8 km',
    status: 'Walk-ins limited',
    rating: '4.9',
    reviews: '412',
    photo: 'food/plate-omakase.jpg',
    open17: 0,
    open18: 2,
    open19: 1,
    open20: 0,
    city: 'New York',
    blurb: 'Omakase counter inspired by Edomae technique. Fixed tasting menus; premium reserved seating.',
  },
  {
    id: 'kura',
    name: 'Kura Revolving',
    style: 'Conveyor',
    price: '$$',
    dist: '1.1 km',
    status: 'Walk-in open',
    rating: '4.4',
    reviews: '2.1k',
    photo: 'food/plate-conveyor.jpg',
    open17: 12,
    open18: 8,
    open19: 6,
    open20: 10,
    city: 'Multiple',
    blurb: 'Conveyor-belt sushi with touchscreen ordering. Broad price band and walk-in friendly.',
  },
  {
    id: 'yasuda',
    name: 'Sushi Yasuda',
    style: 'Counter',
    price: '$$$',
    dist: '1.6 km',
    status: 'Seats from 18:30',
    rating: '4.7',
    reviews: '890',
    photo: 'food/plate-counter.jpg',
    open17: 0,
    open18: 4,
    open19: 3,
    open20: 2,
    city: 'New York',
    blurb: 'Traditional Edomae-leaning counter on East 43rd. Long hinoki bar; focused nigiri menu.',
  },
  {
    id: 'sugarfish',
    name: 'Sugarfish',
    style: 'Counter',
    price: '$$$',
    dist: '2.0 km',
    status: 'Walk-in open',
    rating: '4.5',
    reviews: '3.4k',
    photo: 'food/plate-modern.jpg',
    open17: 6,
    open18: 5,
    open19: 4,
    open20: 3,
    city: 'Los Angeles',
    blurb: 'Set menus and no tipping at many locations. Walk-in lines are common; mid price band.',
  },
  {
    id: 'jiro',
    name: 'Sukiyabashi Jiro',
    style: 'Omakase',
    price: '$$$$$',
    dist: '0.4 km',
    status: 'Reservation only',
    rating: '4.9',
    reviews: '1.2k',
    photo: 'food/plate-omakase.jpg',
    open17: 0,
    open18: 0,
    open19: 0,
    open20: 0,
    city: 'Tokyo',
    blurb: 'Legendary Ginza omakase. Meticulously paced nigiri; tiny seating room. Reservation-only.',
  },
  {
    id: 'masa',
    name: 'Masa',
    style: 'Omakase',
    price: '$$$$$',
    dist: '2.8 km',
    status: 'Reservation only',
    rating: '4.8',
    reviews: '640',
    photo: 'food/plate-counter.jpg',
    open17: 0,
    open18: 0,
    open19: 1,
    open20: 0,
    city: 'New York',
    blurb: 'High-end single-seating omakase. Top-of-market price band; reservation required.',
  },
];

const VARIATIONS = [
  {
    id: 'var-01',
    file: 'var-01-photo-grid.html',
    skeleton: 'Photo grid',
    name: 'Night Counter Grid',
    role: 'Dark-first',
    temperature: 'Cool-neutral charcoal with warm coral heat on actions',
    contrast: 'High — near-black lacquer surfaces, bright coral CTAs',
    typeVoice: 'Geometric display (Syne) + product sans (DM Sans)',
    display: 'Syne',
    body: 'DM Sans',
    fonts:
      'family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700',
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
    fold: 'Dense square tile grid with name on image',
    chipStyle: 'filled',
    notes: 'Dark-first photo hunting. Tiles own the fold; labels sit on the plate.',
  },
  {
    id: 'var-02',
    file: 'var-02-map-canvas.html',
    skeleton: 'Map canvas',
    name: 'Harbor Map',
    role: 'Cool low-chroma',
    temperature: 'Cool slate teal, mist greys, desaturated sea air',
    contrast: 'Low-chroma separation — value hierarchy does the work',
    typeVoice: 'Quiet technical (IBM Plex Sans)',
    display: 'IBM Plex Sans',
    body: 'IBM Plex Sans',
    fonts: 'family=IBM+Plex+Sans:wght@400;500;600;700',
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
    fold: 'Full-bleed map with pin cluster and bottom-sheet rows',
    chipStyle: 'outline',
    notes: 'Map owns the fold. Sheet peels up with nearest counters.',
  },
  {
    id: 'var-03',
    file: 'var-03-timeline-board.html',
    skeleton: 'Timeline board',
    name: 'Lantern Board',
    role: 'Dark-first',
    temperature: 'Warm amber lantern on deep espresso lacquer',
    contrast: 'High — gold open-counts on near-black columns',
    typeVoice: 'Condensed display (Barlow Condensed) + readable body (Barlow)',
    display: 'Barlow Condensed',
    body: 'Barlow',
    fonts: 'family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700',
    light: {
      bg: '#f6f1e8',
      surface: '#fffdf8',
      text: '#1c1410',
      muted: '#6b5648',
      border: '#e0d2c2',
      primary: '#b45309',
      primaryContrast: '#fffdf8',
      success: '#166534',
    },
    dark: {
      bg: '#100e0c',
      surface: '#1c1814',
      text: '#f5ebe0',
      muted: '#b8a090',
      border: '#3a322a',
      primary: '#f0b429',
      primaryContrast: '#100e0c',
      success: '#4ade80',
    },
    fold: "Tonight's seating columns with open seat counts",
    chipStyle: 'filled',
    notes: 'Dark-first seating board. Time columns are the product, not a filter.',
  },
  {
    id: 'var-04',
    file: 'var-04-editorial-stack.html',
    skeleton: 'Editorial stack',
    name: 'Omakase Paper',
    role: 'Warm editorial serif',
    temperature: 'Warm cream paper, toasted browns, brick primary',
    contrast: 'Soft magazine contrast — ink on paper',
    typeVoice: 'Serif display (Fraunces) + Source Serif 4 body',
    display: 'Fraunces',
    body: 'Source Serif 4',
    fonts:
      'family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700',
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
    fold: 'Full-bleed hero, magazine cards, generous air',
    chipStyle: 'underline',
    notes: 'Serif display required. Reads as a printed guide, not a delivery grid.',
  },
  {
    id: 'var-05',
    file: 'var-05-utility-list.html',
    skeleton: 'Utility list',
    name: 'Ink Line',
    role: 'Near-monochrome + single accent',
    temperature: 'Neutral greys only — one vermillion accent',
    contrast: 'Hard ink-on-paper — accent reserved for primary actions',
    typeVoice: 'Single utilitarian face (Inter) at all sizes',
    display: 'Inter',
    body: 'Inter',
    fonts: 'family=Inter:wght@400;500;600;700;800',
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
    fold: 'Dense rows, 40px thumbs, segmented control',
    chipStyle: 'segmented',
    notes: 'Photos carry all colour. UI is graphite so the plates are the chroma.',
  },
  {
    id: 'var-06',
    file: 'var-06-split-rail.html',
    skeleton: 'Split rail',
    name: 'Mon Crest',
    role: "Owner's chosen palette",
    temperature: 'Cool indigo ink with warm coral action heat',
    contrast: 'Ceremonial high contrast — deep indigo, coral as hot signal',
    typeVoice: 'Cormorant Garamond display + Manrope body',
    display: 'Cormorant Garamond',
    body: 'Manrope',
    fonts:
      'family=Cormorant+Garamond:wght@600;700&family=Manrope:wght@400;500;600;700;800',
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
    fold: 'List left, persistent restaurant detail right',
    chipStyle: 'filled-ceremonial',
    notes:
      "Owner pick: indigo mon + coral. Mon-ring photo insets, Cormorant over Manrope.",
  },
];

const PAGE_CSS = `
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 28px 20px 64px;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0b0d12;
  color: #e8eaef;
  line-height: 1.45;
}
h1 { font-size: 1.35rem; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.02em; }
.meta { color: #9aa3b2; font-size: 0.95rem; max-width: 54rem; margin: 0 0 16px; }
.meta strong { color: #e8eaef; }
.axes { display: grid; gap: 6px; margin: 0 0 20px; max-width: 54rem; font-size: 0.9rem; }
.axes dt { color: #7d8799; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
.axes dd { margin: 0 0 6px; }
.phones { display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start; }
.phone-wrap { margin: 0; }
.phone-cap {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: #8b93a3; margin: 0 0 6px; font-family: ui-monospace, Consolas, monospace;
}
.phone {
  width: 375px;
  border-radius: 28px;
  padding: 10px;
  background: #0a0a0c;
  border: 1px solid #3a3f4a;
  box-shadow: 0 16px 36px rgba(0,0,0,0.45);
}
.phone-inner {
  border-radius: 20px;
  overflow: hidden;
  height: 720px;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  font-family: var(--body);
  font-size: 16px;
  line-height: 1.35;
  position: relative;
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
.brand-mark {
  width: 32px; height: 32px; object-fit: contain; flex-shrink: 0;
  display: block;
}
.app-name { margin: 0; font-family: var(--display); font-weight: 700; color: var(--text); }
.app-loc { margin: 0; font-size: 0.72rem; color: var(--muted); }
.icon-btn {
  min-width: 44px; min-height: 44px; border: 1px solid var(--border);
  border-radius: 10px; background: var(--bg); color: var(--text);
  font-size: 1rem; cursor: default; display: grid; place-items: center;
}
.tabbar {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  border-top: 1px solid var(--border); background: var(--surface);
  margin-top: auto; flex-shrink: 0;
}
.tab {
  min-height: 52px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 2px; text-decoration: none;
  color: var(--muted); font-size: 0.72rem; font-weight: 600;
  padding: 6px 4px;
}
.tab--on { color: var(--primary); }
.tab svg { width: 20px; height: 20px; }
.badge-ok { font-weight: 600; color: var(--success); }
.rating { color: var(--muted); }
.photo {
  background-size: cover; background-position: center; background-repeat: no-repeat;
  flex-shrink: 0;
}

/* ——— Chip scroller: never clip labels; deliberate overflow with affordance ——— */
.chips-scroller {
  position: relative;
  flex-shrink: 0;
}
.chips {
  display: flex;
  gap: 8px;
  padding: 10px 36px 10px 14px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  flex-wrap: nowrap;
}
.chips::-webkit-scrollbar { height: 4px; }
.chips::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
.chip {
  flex: 0 0 auto;
  min-height: 44px;
  min-width: 44px;
  padding: 0 14px;
  white-space: nowrap;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: default;
  scroll-snap-align: start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.chips-fade {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 40px;
  pointer-events: none;
  background: linear-gradient(to right, transparent, var(--bg) 70%);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
}
.chips-fade::after {
  content: "›";
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--muted);
  line-height: 1;
}
/* filled chips — actual pills, not bare text */
.chips--filled .chip {
  border-radius: 999px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.chips--filled .chip--on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-contrast);
  box-shadow: none;
}
.chips--filled-ceremonial .chip {
  border-radius: 999px;
  border: 1.5px solid var(--border);
  background: transparent;
  color: var(--muted);
}
.chips--filled-ceremonial .chip--on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-contrast);
}
.chips--outline .chip {
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.chips--outline .chip--on {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--primary);
}
.chips--underline {
  gap: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
  padding-right: 14px;
}
.chips--underline .chip {
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: 0;
  padding: 10px 12px 12px;
  min-height: 44px;
  font-weight: 500;
}
.chips--underline .chip--on {
  color: var(--text);
  font-weight: 700;
  box-shadow: inset 0 -3px 0 var(--primary);
}
/* segmented — full-width equal segments, no scroll needed */
.chips-scroller--segmented .chips-fade { display: none; }
.chips--segmented {
  gap: 0;
  padding: 10px 14px;
  overflow: visible;
}
.chips--segmented .chip {
  flex: 1 1 0;
  min-width: 0;
  border-radius: 0;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  text-align: center;
  padding: 0 6px;
  font-size: 0.78rem;
}
.chips--segmented .chip:first-child { border-radius: 10px 0 0 10px; }
.chips--segmented .chip:last-child { border-radius: 0 10px 10px 0; }
.chips--segmented .chip + .chip { border-left: none; }
.chips--segmented .chip--on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-contrast);
  z-index: 1;
}
.axe-note {
  margin-top: 28px; max-width: 54rem; font-size: 0.85rem; color: #9aa3b2;
  border-top: 1px solid #2a2f3a; padding-top: 16px;
}
`;

function tokenVars(v) {
  return `
    --display: "${v.display}", system-ui, serif;
    --body: "${v.body}", system-ui, sans-serif;
    --light-bg: ${v.light.bg};
    --light-surface: ${v.light.surface};
    --light-text: ${v.light.text};
    --light-muted: ${v.light.muted};
    --light-border: ${v.light.border};
    --light-primary: ${v.light.primary};
    --light-primary-contrast: ${v.light.primaryContrast};
    --light-success: ${v.light.success};
    --dark-bg: ${v.dark.bg};
    --dark-surface: ${v.dark.surface};
    --dark-text: ${v.dark.text};
    --dark-muted: ${v.dark.muted};
    --dark-border: ${v.dark.border};
    --dark-primary: ${v.dark.primary};
    --dark-primary-contrast: ${v.dark.primaryContrast};
    --dark-success: ${v.dark.success};
  `;
}

function brandHeader(loc = 'Near you · 2.4 km') {
  return `
    <header class="app-header">
      <div class="brand">
        <img class="brand-mark" src="mark-06.png" width="32" height="32" alt="" />
        <div>
          <p class="app-name">Sushi Finder</p>
          <p class="app-loc">${loc}</p>
        </div>
      </div>
      <button type="button" class="icon-btn" aria-label="Open filters">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
      </button>
    </header>`;
}

function tabbar(active = 'photos') {
  const tabs = [
    { id: 'photos', label: 'Photos', d: 'M4 5h6v6H4zM14 5h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
    { id: 'map', label: 'Map', d: 'M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
    { id: 'seating', label: 'Seating', d: 'M4 7h16v2H4zm0 5h10v2H4zm0 5h14v2H4z' },
  ];
  return `
    <nav class="tabbar" aria-label="Primary">
      ${tabs
        .map(
          (t) => `
        <a class="tab${t.id === active ? ' tab--on' : ''}" href="#" ${t.id === active ? 'aria-current="page"' : ''}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${t.d}"/></svg>
          <span>${t.label}</span>
        </a>`,
        )
        .join('')}
    </nav>`;
}

function chips(style, labels, activeIdx = 0) {
  const scrollerClass =
    style === 'segmented' ? 'chips-scroller chips-scroller--segmented' : 'chips-scroller';
  const fade = style === 'segmented' ? '' : '<div class="chips-fade" aria-hidden="true"></div>';
  return `
    <div class="${scrollerClass}">
      <div class="chips chips--${style}" role="list" aria-label="Browse mode and style filters">
        ${labels
          .map(
            (lab, i) =>
              `<button type="button" class="chip${i === activeIdx ? ' chip--on' : ''}" role="listitem">${lab}</button>`,
          )
          .join('')}
      </div>
      ${fade}
    </div>`;
}

/** ——— Skeleton-specific CSS + body ——— */

function skeletonCss_photoGrid() {
  return `
    .sk-photo .app-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px; background: var(--surface);
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .sk-photo .brand { display: flex; gap: 8px; align-items: center; }
    .sk-photo .app-name { font-size: 1.05rem; letter-spacing: -0.02em; }
    .sk-photo .search-row { padding: 8px 14px 0; flex-shrink: 0; }
    .sk-photo .search input {
      width: 100%; min-height: 44px; border: 1.5px solid var(--border);
      border-radius: 12px; padding: 8px 12px; background: var(--surface);
      color: var(--text); font: inherit; font-size: 0.95rem;
    }
    .sk-photo .results-meta {
      margin: 4px 14px 6px; font-size: 0.75rem; color: var(--muted); flex-shrink: 0;
    }
    .sk-photo .results-count { color: var(--text); font-weight: 600; }
    .sk-photo .tile-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 3px;
      padding: 0 3px 3px; flex: 1; overflow: auto; min-height: 0;
    }
    .sk-photo .tile {
      position: relative; aspect-ratio: 1 / 1; overflow: hidden;
      border: none; padding: 0; cursor: default; background: var(--border);
    }
    .sk-photo .tile .photo { position: absolute; inset: 0; width: 100%; height: 100%; }
    .sk-photo .tile-scrim {
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 28px 8px 8px;
      background: linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 55%, transparent 100%);
      color: #fff; text-align: left;
    }
    .sk-photo .tile-name {
      margin: 0; font-family: var(--display); font-weight: 800;
      font-size: 0.88rem; line-height: 1.15; letter-spacing: -0.02em;
      color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.4);
    }
    .sk-photo .tile-meta {
      margin: 2px 0 0; font-size: 0.65rem; color: rgba(255,255,255,0.88);
      font-weight: 500;
    }
    .sk-photo .tile-status {
      position: absolute; top: 6px; left: 6px;
      background: var(--success); color: #fff;
      font-size: 0.62rem; font-weight: 700; padding: 3px 6px;
      border-radius: 4px; line-height: 1.2;
    }
    .phone-wrap[data-theme="dark"] .sk-photo .tile-status { color: #0c0e12; }
  `;
}

function body_photoGrid(theme) {
  const r = RESTAURANTS;
  return `
    <div class="phone-inner sk-photo" aria-label="Sushi Finder — ${theme} theme, Photo grid">
      ${brandHeader()}
      <div class="search-row">
        <label class="search">
          <span class="sr-only">Search sushi restaurants</span>
          <input type="search" value="omakase walk-in" readonly aria-readonly="true" />
        </label>
      </div>
      ${chips('filled', ['Photos', 'Map', 'Seating', 'Counter', 'Walk-in', 'Omakase'], 0)}
      <p class="results-meta"><span class="results-count">12 open now</span> · sorted by distance</p>
      <div class="tile-grid" role="list" aria-label="Restaurant photo grid">
        ${r
          .map(
            (x) => `
          <button type="button" class="tile" role="listitem" aria-label="${x.name}, ${x.style}, ${x.dist}">
            <div class="photo" style="background-image:url('${x.photo}')"></div>
            ${x.status.includes('open') ? `<span class="tile-status">Open</span>` : ''}
            <div class="tile-scrim">
              <p class="tile-name">${x.name}</p>
              <p class="tile-meta">${x.style} · ${x.price} · ${x.dist}</p>
            </div>
          </button>`,
          )
          .join('')}
      </div>
      ${tabbar('photos')}
    </div>`;
}

function skeletonCss_mapCanvas() {
  return `
    .sk-map .app-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px; background: var(--surface);
      border-bottom: 1px solid var(--border); flex-shrink: 0; z-index: 2;
    }
    .sk-map .brand { display: flex; gap: 8px; align-items: center; }
    .sk-map .app-name { font-size: 0.95rem; font-weight: 600; letter-spacing: 0; }
    .sk-map .map-stage {
      position: relative; flex: 1; min-height: 0;
      background: var(--bg); overflow: hidden;
    }
    .sk-map .map-svg { width: 100%; height: 100%; display: block; }
    .sk-map .pin {
      position: absolute; transform: translate(-50%, -100%);
      width: 28px; height: 36px; display: grid; place-items: start center;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
    }
    .sk-map .pin-dot {
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: var(--primary); border: 2px solid var(--primary-contrast);
      display: grid; place-items: center;
    }
    .sk-map .pin-dot span {
      transform: rotate(45deg); font-size: 0.65rem; font-weight: 700;
      color: var(--primary-contrast);
    }
    .sk-map .pin--active .pin-dot {
      width: 34px; height: 34px; background: var(--primary);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 35%, transparent);
    }
    .sk-map .sheet {
      position: absolute; left: 0; right: 0; bottom: 0;
      background: var(--surface);
      border-radius: 16px 16px 0 0;
      border-top: 1px solid var(--border);
      box-shadow: 0 -8px 28px rgba(0,0,0,0.18);
      padding: 8px 0 0;
      max-height: 42%;
      display: flex; flex-direction: column;
    }
    .sk-map .sheet-handle {
      width: 36px; height: 4px; border-radius: 2px;
      background: var(--border); margin: 0 auto 8px;
    }
    .sk-map .sheet-head {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 0 14px 8px;
    }
    .sk-map .sheet-title {
      margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--text);
    }
    .sk-map .sheet-meta { margin: 0; font-size: 0.72rem; color: var(--muted); }
    .sk-map .sheet-rows {
      overflow-y: auto; flex: 1; padding: 0 10px 10px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .sk-map .sheet-row {
      display: grid; grid-template-columns: 48px 1fr auto; gap: 10px;
      align-items: center; min-height: 56px;
      padding: 8px; border-radius: 10px;
      background: var(--bg); border: 1px solid var(--border);
      text-align: left; font: inherit; color: inherit; cursor: default;
    }
    .sk-map .sheet-row--on {
      border-color: var(--primary);
      box-shadow: inset 0 0 0 1px var(--primary);
    }
    .sk-map .sheet-thumb {
      width: 48px; height: 48px; border-radius: 8px; border: 1px solid var(--border);
    }
    .sk-map .sheet-name {
      margin: 0; font-size: 0.84rem; font-weight: 600; line-height: 1.2;
    }
    .sk-map .sheet-sub {
      margin: 2px 0 0; font-size: 0.7rem; color: var(--muted);
    }
    .sk-map .sheet-dist {
      font-size: 0.72rem; font-weight: 600; color: var(--primary); white-space: nowrap;
    }
    .sk-map .locate-fab {
      position: absolute; right: 12px; bottom: calc(42% + 12px);
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--surface); border: 1px solid var(--border);
      color: var(--text); display: grid; place-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: default;
    }
  `;
}

function body_mapCanvas(theme) {
  const pins = [
    { top: '22%', left: '38%', label: 'N', active: true },
    { top: '34%', left: '62%', label: 'K', active: false },
    { top: '48%', left: '28%', label: 'Y', active: false },
    { top: '30%', left: '72%', label: 'S', active: false },
  ];
  const rows = RESTAURANTS.slice(0, 4);
  return `
    <div class="phone-inner sk-map" aria-label="Sushi Finder — ${theme} theme, Map canvas">
      ${brandHeader()}
      ${chips('outline', ['Map', 'Photos', 'Seating', 'Open now', 'Counter'], 0)}
      <div class="map-stage" role="img" aria-label="Map of nearby sushi restaurants">
        <svg class="map-svg" viewBox="0 0 360 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="360" height="400" fill="var(--bg)"/>
          <g stroke="var(--border)" stroke-width="1.5" fill="none" opacity="0.9">
            <path d="M0 80 H360 M0 160 H360 M0 240 H360 M0 320 H360"/>
            <path d="M60 0 V400 M140 0 V400 M220 0 V400 M300 0 V400"/>
            <path d="M0 120 Q90 100 180 130 T360 110" stroke="var(--primary)" stroke-opacity="0.25" stroke-width="8"/>
            <path d="M40 0 V400" stroke="var(--muted)" stroke-opacity="0.2" stroke-width="10"/>
            <path d="M0 200 H360" stroke="var(--muted)" stroke-opacity="0.15" stroke-width="14"/>
          </g>
          <g fill="var(--muted)" fill-opacity="0.35" font-size="9" font-family="var(--body)">
            <text x="70" y="70">Ginza</text>
            <text x="230" y="150">East</text>
            <text x="100" y="280">Harbor</text>
          </g>
        </svg>
        ${pins
          .map(
            (p) => `
          <div class="pin${p.active ? ' pin--active' : ''}" style="top:${p.top};left:${p.left}" aria-hidden="true">
            <div class="pin-dot"><span>${p.label}</span></div>
          </div>`,
          )
          .join('')}
        <button type="button" class="locate-fab" aria-label="Recenter map on me">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        </button>
        <div class="sheet" role="region" aria-label="Nearby restaurants">
          <div class="sheet-handle" aria-hidden="true"></div>
          <div class="sheet-head">
            <p class="sheet-title">4 places nearby</p>
            <p class="sheet-meta">Sorted by distance</p>
          </div>
          <div class="sheet-rows">
            ${rows
              .map(
                (x, i) => `
              <button type="button" class="sheet-row${i === 0 ? ' sheet-row--on' : ''}" aria-label="${x.name}, ${x.dist}">
                <div class="photo sheet-thumb" style="background-image:url('${x.photo}')"></div>
                <div>
                  <p class="sheet-name">${x.name}</p>
                  <p class="sheet-sub"><span class="badge-ok">${x.status}</span> · ${x.style}</p>
                </div>
                <span class="sheet-dist">${x.dist}</span>
              </button>`,
              )
              .join('')}
          </div>
        </div>
      </div>
      ${tabbar('map')}
    </div>`;
}

function skeletonCss_timeline() {
  return `
    .sk-time .app-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 6px; background: var(--surface);
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .sk-time .brand { display: flex; gap: 8px; align-items: center; }
    .sk-time .app-name { font-size: 1.15rem; letter-spacing: 0.02em; text-transform: uppercase; }
    .sk-time .tonight {
      padding: 10px 14px 4px; flex-shrink: 0;
    }
    .sk-time .tonight-label {
      margin: 0; font-size: 0.72rem; font-weight: 600; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    .sk-time .tonight-title {
      margin: 2px 0 0; font-family: var(--display); font-size: 1.45rem;
      font-weight: 700; letter-spacing: 0.01em; color: var(--text); line-height: 1.1;
    }
    .sk-time .board {
      display: flex; gap: 10px; padding: 10px 14px 12px;
      overflow-x: auto; flex: 1; min-height: 0;
      scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
    }
    .sk-time .col {
      flex: 0 0 148px; scroll-snap-align: start;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; display: flex; flex-direction: column;
      min-height: 0; overflow: hidden;
    }
    .sk-time .col-head {
      padding: 10px 10px 8px; border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--primary) 12%, var(--surface));
    }
    .sk-time .col-time {
      margin: 0; font-family: var(--display); font-size: 1.25rem;
      font-weight: 700; color: var(--text); line-height: 1;
    }
    .sk-time .col-open {
      margin: 4px 0 0; font-size: 0.72rem; font-weight: 700;
      color: var(--primary);
    }
    .sk-time .col-cards {
      padding: 8px; display: flex; flex-direction: column; gap: 8px;
      overflow-y: auto; flex: 1;
    }
    .sk-time .seat-card {
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 8px; overflow: hidden; text-align: left;
      padding: 0; font: inherit; color: inherit; cursor: default;
      min-height: 44px;
    }
    .sk-time .seat-photo {
      width: 100%; aspect-ratio: 16/10;
    }
    .sk-time .seat-body { padding: 6px 8px 8px; }
    .sk-time .seat-name {
      margin: 0; font-size: 0.78rem; font-weight: 700; line-height: 1.2;
    }
    .sk-time .seat-meta {
      margin: 2px 0 0; font-size: 0.65rem; color: var(--muted);
    }
    .sk-time .seat-count {
      display: inline-block; margin-top: 4px;
      font-size: 0.68rem; font-weight: 700; color: var(--success);
    }
    .sk-time .seat-count--zero { color: var(--muted); font-weight: 500; }
    .sk-time .board-hint {
      position: absolute; right: 8px; top: 50%;
      width: 28px; height: 44px; border-radius: 8px;
      background: color-mix(in srgb, var(--surface) 90%, transparent);
      border: 1px solid var(--border); color: var(--muted);
      display: grid; place-items: center; pointer-events: none;
      font-weight: 700; font-size: 1rem;
    }
  `;
}

function body_timeline(theme) {
  const slots = [
    { time: '17:00', key: 'open17' },
    { time: '18:00', key: 'open18' },
    { time: '19:00', key: 'open19' },
    { time: '20:00', key: 'open20' },
  ];
  return `
    <div class="phone-inner sk-time" aria-label="Sushi Finder — ${theme} theme, Timeline board">
      ${brandHeader('Tonight · Fri 8 Aug')}
      ${chips('filled', ['Seating', 'Photos', 'Map', 'Counter', 'Walk-in'], 0)}
      <div class="tonight">
        <p class="tonight-label">Open seats</p>
        <p class="tonight-title">Tonight’s board</p>
      </div>
      <div class="board" role="list" aria-label="Seating columns by time">
        ${slots
          .map((slot) => {
            const total = RESTAURANTS.reduce((s, r) => s + r[slot.key], 0);
            const cards = RESTAURANTS.filter((r) => r[slot.key] > 0 || slot.time === '19:00').slice(
              0,
              3,
            );
            // show closed too for empty times
            const shown =
              cards.length > 0
                ? cards
                : RESTAURANTS.filter((r) => r[slot.key] === 0).slice(0, 2);
            return `
            <div class="col" role="listitem" aria-label="${slot.time}, ${total} open seats">
              <div class="col-head">
                <p class="col-time">${slot.time}</p>
                <p class="col-open">${total} open</p>
              </div>
              <div class="col-cards">
                ${shown
                  .map((x) => {
                    const n = x[slot.key];
                    return `
                  <button type="button" class="seat-card" aria-label="${x.name}, ${n} seats at ${slot.time}">
                    <div class="photo seat-photo" style="background-image:url('${x.photo}')"></div>
                    <div class="seat-body">
                      <p class="seat-name">${x.name}</p>
                      <p class="seat-meta">${x.style} · ${x.price}</p>
                      <span class="seat-count${n === 0 ? ' seat-count--zero' : ''}">${n === 0 ? 'Full' : n + ' open'}</span>
                    </div>
                  </button>`;
                  })
                  .join('')}
              </div>
            </div>`;
          })
          .join('')}
      </div>
      ${tabbar('seating')}
    </div>`;
}

function skeletonCss_editorial() {
  return `
    .sk-ed .app-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px 10px; background: transparent;
      flex-shrink: 0; position: absolute; left: 0; right: 0; top: 0; z-index: 3;
    }
    .sk-ed .brand { display: flex; gap: 8px; align-items: center; }
    .sk-ed .app-name {
      font-size: 1.25rem; font-weight: 700; letter-spacing: -0.03em;
      color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.45);
    }
    .sk-ed .app-loc { color: rgba(255,255,255,0.85); }
    .sk-ed .icon-btn {
      background: rgba(0,0,0,0.35); border-color: rgba(255,255,255,0.25); color: #fff;
    }
    .sk-ed .hero {
      position: relative; flex: 0 0 48%; min-height: 280px;
      display: flex; flex-direction: column; justify-content: flex-end;
    }
    .sk-ed .hero-photo {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
    }
    .sk-ed .hero-scrim {
      position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.35) 100%);
    }
    .sk-ed .hero-body {
      position: relative; z-index: 1; padding: 16px 18px 18px; color: #fff;
    }
    .sk-ed .hero-kicker {
      margin: 0 0 4px; font-size: 0.72rem; font-weight: 600;
      letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.9;
    }
    .sk-ed .hero-title {
      margin: 0; font-family: var(--display); font-size: 1.85rem;
      font-weight: 700; line-height: 1.1; letter-spacing: -0.03em;
    }
    .sk-ed .hero-blurb {
      margin: 8px 0 0; font-size: 0.88rem; line-height: 1.45;
      opacity: 0.92; max-width: 34ch;
    }
    .sk-ed .hero-cta {
      margin-top: 12px; min-height: 44px; padding: 0 18px;
      border: none; border-radius: 999px;
      background: var(--primary); color: var(--primary-contrast);
      font: inherit; font-weight: 700; font-size: 0.88rem; cursor: default;
    }
    .sk-ed .stack-wrap {
      flex: 1; min-height: 0; overflow: auto;
      background: var(--bg);
      border-radius: 20px 20px 0 0;
      margin-top: -14px; position: relative; z-index: 2;
      box-shadow: 0 -8px 24px rgba(0,0,0,0.12);
    }
    .sk-ed .stack-inner { padding: 8px 0 0; }
    .sk-ed .mag-list {
      display: flex; flex-direction: column; gap: 18px;
      padding: 8px 18px 20px;
    }
    .sk-ed .mag-card {
      background: var(--surface); border: none; border-radius: 20px;
      overflow: hidden; text-align: left; padding: 0;
      font: inherit; color: inherit; cursor: default;
      box-shadow: 0 8px 24px rgba(42,33,24,0.1);
    }
    .phone-wrap[data-theme="dark"] .sk-ed .mag-card {
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }
    .sk-ed .mag-photo {
      width: 100%; aspect-ratio: 16 / 9;
    }
    .sk-ed .mag-body { padding: 14px 16px 16px; }
    .sk-ed .mag-title {
      margin: 0; font-family: var(--display); font-size: 1.2rem;
      font-weight: 700; line-height: 1.2; letter-spacing: -0.02em;
    }
    .sk-ed .mag-meta {
      margin: 6px 0 0; font-size: 0.82rem; color: var(--muted); line-height: 1.4;
    }
    .sk-ed .mag-row {
      margin: 10px 0 0; display: flex; gap: 12px; flex-wrap: wrap;
      font-size: 0.78rem;
    }
  `;
}

function body_editorial(theme) {
  const hero = RESTAURANTS[0];
  const rest = RESTAURANTS.slice(1, 4);
  return `
    <div class="phone-inner sk-ed" aria-label="Sushi Finder — ${theme} theme, Editorial stack">
      <div class="hero">
        <div class="hero-photo" style="background-image:url('${hero.photo}')" role="img" aria-label="Photo of ${hero.name}"></div>
        <div class="hero-scrim" aria-hidden="true"></div>
        ${brandHeader()}
        <div class="hero-body">
          <p class="hero-kicker">Tonight’s find</p>
          <h2 class="hero-title">${hero.name}</h2>
          <p class="hero-blurb">${hero.blurb}</p>
          <button type="button" class="hero-cta">View seating</button>
        </div>
      </div>
      <div class="stack-wrap">
        <div class="stack-inner">
          ${chips('underline', ['Guide', 'Photos', 'Map', 'Seating', 'Counter'], 0)}
          <div class="mag-list" role="list" aria-label="More restaurants">
            ${rest
              .map(
                (x) => `
              <article class="mag-card" role="listitem">
                <div class="photo mag-photo" style="background-image:url('${x.photo}')" role="img" aria-label="Photo of ${x.name}"></div>
                <div class="mag-body">
                  <h3 class="mag-title">${x.name}</h3>
                  <p class="mag-meta">${x.style} · ${x.price} · ${x.dist}<br/>${x.blurb.slice(0, 72)}…</p>
                  <p class="mag-row">
                    <span class="badge-ok">${x.status}</span>
                    <span class="rating">${x.rating} · ${x.reviews} reviews</span>
                  </p>
                </div>
              </article>`,
              )
              .join('')}
          </div>
        </div>
      </div>
      ${tabbar('photos')}
    </div>`;
}

function skeletonCss_utility() {
  return `
    .sk-util .app-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; background: var(--surface);
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .sk-util .brand { display: flex; gap: 8px; align-items: center; }
    .sk-util .app-name { font-size: 0.92rem; font-weight: 700; letter-spacing: -0.01em; }
    .sk-util .search-row { padding: 8px 12px 0; flex-shrink: 0; }
    .sk-util .search input {
      width: 100%; min-height: 44px; border: 1px solid var(--border);
      border-radius: 4px; padding: 8px 10px; background: var(--surface);
      color: var(--text); font: inherit; font-size: 0.95rem;
    }
    .sk-util .results-meta {
      margin: 6px 12px 4px; font-size: 0.72rem; color: var(--muted);
      display: flex; justify-content: space-between; flex-shrink: 0;
    }
    .sk-util .results-count { color: var(--text); font-weight: 600; }
    .sk-util .list {
      flex: 1; overflow: auto; min-height: 0;
      border-top: 1px solid var(--border);
    }
    .sk-util .row {
      display: grid; grid-template-columns: 40px 1fr auto;
      gap: 10px; align-items: center;
      min-height: 56px; padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--surface); text-align: left;
      font: inherit; color: inherit; width: 100%;
      border-left: none; border-right: none; border-top: none;
      cursor: default;
    }
    .sk-util .row:active, .sk-util .row:focus-visible {
      background: var(--bg);
    }
    .sk-util .row-thumb {
      width: 40px; height: 40px; border-radius: 4px;
      border: 1px solid var(--border);
    }
    .sk-util .row-title {
      margin: 0; font-size: 0.88rem; font-weight: 600; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sk-util .row-meta {
      margin: 2px 0 0; font-size: 0.7rem; color: var(--muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sk-util .row-right {
      text-align: right; flex-shrink: 0;
    }
    .sk-util .row-price {
      margin: 0; font-size: 0.78rem; font-weight: 700; color: var(--primary);
    }
    .sk-util .row-dist {
      margin: 2px 0 0; font-size: 0.68rem; color: var(--muted);
    }
    .sk-util .icon-btn { border-radius: 4px; }
  `;
}

function body_utility(theme) {
  return `
    <div class="phone-inner sk-util" aria-label="Sushi Finder — ${theme} theme, Utility list">
      ${brandHeader()}
      <div class="search-row">
        <label class="search">
          <span class="sr-only">Search sushi restaurants</span>
          <input type="search" value="omakase walk-in" readonly aria-readonly="true" />
        </label>
      </div>
      ${chips('segmented', ['Photos', 'Map', 'Seating'], 0)}
      <p class="results-meta">
        <span><span class="results-count">6 matches</span> · distance</span>
        <span>Filter</span>
      </p>
      <div class="list" role="list" aria-label="Restaurant list">
        ${RESTAURANTS.map(
          (x) => `
          <button type="button" class="row" role="listitem" aria-label="${x.name}, ${x.dist}">
            <div class="photo row-thumb" style="background-image:url('${x.photo}')"></div>
            <div style="min-width:0">
              <p class="row-title">${x.name}</p>
              <p class="row-meta"><span class="badge-ok">${x.status}</span> · ${x.style}</p>
            </div>
            <div class="row-right">
              <p class="row-price">${x.price}</p>
              <p class="row-dist">${x.dist}</p>
            </div>
          </button>`,
        ).join('')}
      </div>
      ${tabbar('photos')}
    </div>`;
}

function skeletonCss_splitRail() {
  return `
    .sk-split .app-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px 8px; background: var(--surface);
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .sk-split .brand { display: flex; gap: 8px; align-items: center; }
    .sk-split .app-name {
      font-size: 1.2rem; font-weight: 700; letter-spacing: 0.01em; line-height: 1.1;
    }
    .sk-split .split-body {
      flex: 1; min-height: 0; display: grid;
      grid-template-columns: 118px 1fr;
      overflow: hidden;
    }
    .sk-split .rail {
      border-right: 1px solid var(--border);
      overflow-y: auto; background: var(--bg);
      display: flex; flex-direction: column;
    }
    .sk-split .rail-item {
      display: flex; flex-direction: column; align-items: center;
      gap: 6px; padding: 10px 6px;
      border: none; border-bottom: 1px solid var(--border);
      background: transparent; color: var(--text);
      font: inherit; cursor: default; min-height: 88px;
      text-align: center;
    }
    .sk-split .rail-item--on {
      background: var(--surface);
      box-shadow: inset 3px 0 0 var(--primary);
    }
    .sk-split .rail-thumb {
      width: 52px; height: 52px; border-radius: 50%;
      border: 2px solid var(--primary);
      box-shadow: 0 0 0 2px var(--border), 0 0 0 4px var(--surface);
    }
    .phone-wrap[data-theme="dark"] .sk-split .rail-thumb {
      box-shadow: 0 0 0 2px #2e2a4a, 0 0 0 4px var(--surface);
    }
    .sk-split .rail-name {
      margin: 0; font-size: 0.65rem; font-weight: 600; line-height: 1.2;
      max-width: 100%;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .sk-split .detail {
      overflow-y: auto; background: var(--surface);
      padding: 14px 14px 18px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .sk-split .detail-ring {
      align-self: center; padding: 6px;
    }
    .sk-split .detail-photo {
      width: 160px; height: 160px; border-radius: 50%;
      border: 3px solid var(--primary);
      box-shadow: 0 0 0 3px var(--border), 0 0 0 6px var(--surface);
    }
    .phone-wrap[data-theme="dark"] .sk-split .detail-photo {
      box-shadow: 0 0 0 3px #2e2a4a, 0 0 0 6px var(--surface);
    }
    .sk-split .detail-title {
      margin: 4px 0 0; font-family: var(--display); font-size: 1.45rem;
      font-weight: 700; text-align: center; line-height: 1.15;
      letter-spacing: 0.01em;
    }
    .sk-split .detail-meta {
      margin: 0; text-align: center; font-size: 0.78rem; color: var(--muted);
    }
    .sk-split .detail-blurb {
      margin: 4px 0 0; font-size: 0.84rem; line-height: 1.45; color: var(--text);
    }
    .sk-split .detail-stats {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      margin-top: 4px;
    }
    .sk-split .stat {
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px; text-align: center;
    }
    .sk-split .stat-val {
      margin: 0; font-weight: 700; font-size: 0.95rem; color: var(--text);
    }
    .sk-split .stat-lab {
      margin: 2px 0 0; font-size: 0.68rem; color: var(--muted);
    }
    .sk-split .detail-cta {
      margin-top: 6px; min-height: 48px; width: 100%;
      border: none; border-radius: 999px;
      background: var(--primary); color: var(--primary-contrast);
      font: inherit; font-weight: 700; font-size: 0.9rem; cursor: default;
    }
    .sk-split .detail-status {
      text-align: center; font-size: 0.8rem; font-weight: 600; color: var(--success);
    }
  `;
}

function body_splitRail(theme) {
  const selected = RESTAURANTS[0];
  return `
    <div class="phone-inner sk-split" aria-label="Sushi Finder — ${theme} theme, Split rail Mon Crest">
      ${brandHeader()}
      ${chips('filled-ceremonial', ['Photos', 'Map', 'Seating', 'Counter', 'Walk-in'], 0)}
      <div class="split-body">
        <div class="rail" role="list" aria-label="Restaurant list">
          ${RESTAURANTS.map(
            (x, i) => `
            <button type="button" class="rail-item${i === 0 ? ' rail-item--on' : ''}" role="listitem" aria-label="${x.name}" ${i === 0 ? 'aria-current="true"' : ''}>
              <div class="photo rail-thumb" style="background-image:url('${x.photo}')"></div>
              <p class="rail-name">${x.name}</p>
            </button>`,
          ).join('')}
        </div>
        <div class="detail" role="region" aria-label="Selected restaurant detail">
          <div class="detail-ring">
            <div class="photo detail-photo" style="background-image:url('${selected.photo}')" role="img" aria-label="Photo of ${selected.name}"></div>
          </div>
          <h2 class="detail-title">${selected.name}</h2>
          <p class="detail-meta">${selected.style} · ${selected.price} · ${selected.dist}</p>
          <p class="detail-status">${selected.status}</p>
          <p class="detail-blurb">${selected.blurb}</p>
          <div class="detail-stats">
            <div class="stat">
              <p class="stat-val">${selected.rating}</p>
              <p class="stat-lab">Rating</p>
            </div>
            <div class="stat">
              <p class="stat-val">${selected.reviews}</p>
              <p class="stat-lab">Reviews</p>
            </div>
          </div>
          <button type="button" class="detail-cta">View seating</button>
        </div>
      </div>
      ${tabbar('photos')}
    </div>`;
}

const SKELETONS = {
  'Photo grid': { css: skeletonCss_photoGrid, body: body_photoGrid },
  'Map canvas': { css: skeletonCss_mapCanvas, body: body_mapCanvas },
  'Timeline board': { css: skeletonCss_timeline, body: body_timeline },
  'Editorial stack': { css: skeletonCss_editorial, body: body_editorial },
  'Utility list': { css: skeletonCss_utility, body: body_utility },
  'Split rail': { css: skeletonCss_splitRail, body: body_splitRail },
};

function phoneFigure(v, theme) {
  const sk = SKELETONS[v.skeleton];
  return `
    <figure class="phone-wrap" data-theme="${theme}" data-id="${v.id}">
      <figcaption class="phone-cap">${theme === 'light' ? 'Light' : 'Dark'}</figcaption>
      <div class="phone">
        ${sk.body(theme)}
      </div>
    </figure>`;
}

function buildVariationPage(v) {
  const sk = SKELETONS[v.skeleton];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${v.id} — ${v.skeleton} · ${v.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?${v.fonts}&display=swap" rel="stylesheet" />
  <style>
    :root { ${tokenVars(v)} }
    ${PAGE_CSS}
    ${sk.css()}
  </style>
</head>
<body>
  <h1>${v.id}: ${v.skeleton}</h1>
  <p class="meta">
    <strong>${v.name}</strong> · ${v.role}.
    ${v.notes}
  </p>
  <dl class="axes">
    <dt>Skeleton (owns the fold)</dt>
    <dd>${v.fold}</dd>
    <dt>Temperature</dt>
    <dd>${v.temperature}</dd>
    <dt>Contrast</dt>
    <dd>${v.contrast}</dd>
    <dt>Type voice</dt>
    <dd>${v.typeVoice}</dd>
    <dt>Chip treatment</dt>
    <dd>${v.chipStyle} — rendered as real controls (not bare text); overflow scrolls with › affordance when needed</dd>
  </dl>
  <div class="phones">
    ${phoneFigure(v, 'light')}
    ${phoneFigure(v, 'dark')}
  </div>
  <p class="axe-note">
    WCAG AA measured with <strong>axe-core</strong> (not hand-computed) via
    <code>measure-a11y.mjs</code> against both phone themes. Brand mark:
    <code>mark-06.png</code> (Maki finder lens). Shared food photos under
    <code>food/</code>. Phone content width <strong>375px</strong>.
  </p>
</body>
</html>`;
}

function buildGallery() {
  const fontLinks = [
    ...new Set(VARIATIONS.map((v) => v.fonts)),
  ]
    .map(
      (f) =>
        `<link href="https://fonts.googleapis.com/css2?${f}&display=swap" rel="stylesheet" />`,
    )
    .join('\n  ');

  const skeletonCssAll = Object.values(SKELETONS)
    .map((s) => s.css())
    .join('\n');

  const cols = VARIATIONS.map((v) => {
    const sk = SKELETONS[v.skeleton];
    return `
    <section class="col" data-id="${v.id}" style="${tokenVars(v).replace(/\n/g, ' ')}">
      <div class="col-head">
        <p class="id">${v.id}</p>
        <h2>${v.skeleton}</h2>
        <p class="role">${v.name} · ${v.role}</p>
        <p class="axis"><span>Fold</span> ${v.fold}</p>
        <p class="axis"><span>Temp</span> ${v.temperature}</p>
        <p class="axis"><span>Type</span> ${v.display} / ${v.body}</p>
        <p class="axis treat-line"><span>Chips</span> ${v.chipStyle}</p>
        <div class="swatches" aria-hidden="true">
          <i style="background:${v.dark.bg}"></i>
          <i style="background:${v.dark.surface}"></i>
          <i style="background:${v.dark.primary}"></i>
          <i style="background:${v.light.bg}"></i>
          <i style="background:${v.light.primary}"></i>
        </div>
        <p class="link"><a href="${v.file}">Open full page</a></p>
      </div>
      <div class="phones">
        ${phoneFigure(v, 'light')}
        ${phoneFigure(v, 'dark')}
      </div>
    </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sushi Finder — full-app design variations 1–6</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  ${fontLinks}
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 28px 16px 80px;
      background: #0b0d12; color: #e8eaef;
      font-family: system-ui, -apple-system, sans-serif; line-height: 1.45;
    }
    h1 { font-size: 1.45rem; margin: 0 0 8px; letter-spacing: -0.02em; }
    .lede {
      color: #9aa3b2; max-width: 88ch; margin: 0 0 24px; font-size: 0.95rem;
    }
    .lede strong { color: #e8eaef; }
    .cols {
      display: grid;
      grid-template-columns: repeat(6, minmax(400px, 1fr));
      gap: 18px; overflow-x: auto; padding-bottom: 12px; align-items: start;
    }
    .col {
      background: #151820; border: 1px solid #2a2f3a;
      border-radius: 16px; overflow: hidden; min-width: 0;
    }
    .col-head {
      padding: 14px 14px 12px; border-bottom: 1px solid #2a2f3a;
    }
    .id {
      margin: 0; font-family: ui-monospace, Consolas, monospace;
      font-size: 0.75rem; color: #7d8799;
    }
    .col-head h2 { margin: 4px 0 2px; font-size: 1.2rem; }
    .role {
      margin: 0 0 10px; font-size: 0.85rem; color: #c4cad6; font-weight: 600;
    }
    .axis {
      margin: 0 0 4px; font-size: 0.78rem; color: #9aa3b2;
    }
    .axis span {
      display: inline-block; min-width: 3.2rem; color: #6b7385;
      text-transform: uppercase; letter-spacing: 0.04em;
      font-size: 0.68rem; font-weight: 600;
    }
    .treat-line { line-height: 1.35; }
    .swatches { display: flex; gap: 6px; margin: 10px 0 0; }
    .swatches i {
      width: 22px; height: 22px; border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.18); display: block;
    }
    .link { margin: 10px 0 0; font-size: 0.85rem; }
    .link a { color: #8eb6ff; }
    .phones {
      display: flex; flex-direction: column; gap: 16px;
      padding: 14px; background: #0c0e12; align-items: center;
    }
    ${PAGE_CSS}
    .phone { width: 375px; }
    ${skeletonCssAll}
  </style>
</head>
<body>
  <h1>Sushi Finder — six full-app directions</h1>
  <p class="lede">
    Each column is a <strong>complete home screen</strong> with a named skeleton,
    its own palette, and its own type voice — not a hex swap on one card grid.
    Brand mark is fixed: <strong>mark-06</strong> (Maki finder lens). Same real
    restaurants and food photography. Light <strong>and</strong> dark for every
    direction. Variation 6 carries the owner-chosen <strong>Mon Crest</strong>
    palette (indigo ink, coral heat, Cormorant / Manrope, mon-ring insets).
    Choice left <strong>OPEN</strong> in <code>DECISION.md</code>.
  </p>
  <div class="cols">
    ${cols}
  </div>
</body>
</html>`;
}

// Write files
for (const v of VARIATIONS) {
  const html = buildVariationPage(v);
  writeFileSync(join(__dirname, v.file), html, 'utf8');
  console.log('wrote', v.file);
}
writeFileSync(join(__dirname, 'gallery.html'), buildGallery(), 'utf8');
console.log('wrote gallery.html');

// metadata for DECISION
writeFileSync(
  join(__dirname, 'variations.json'),
  JSON.stringify(
    VARIATIONS.map((v) => ({
      id: v.id,
      skeleton: v.skeleton,
      name: v.name,
      role: v.role,
      fold: v.fold,
      display: v.display,
      body: v.body,
      chipStyle: v.chipStyle,
      light: v.light,
      dark: v.dark,
    })),
    null,
    2,
  ),
  'utf8',
);
console.log('wrote variations.json');
console.log('done', VARIATIONS.length, 'variations');
