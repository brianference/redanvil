import type { CSSProperties } from 'react';
import { theme } from '../../theme';

/** Full-page shell background and type base. */
export const shellStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: `radial-gradient(1200px 600px at 50% -200px, ${theme.color.surface}, ${theme.color.bg})`,
  color: theme.color.text,
  fontFamily: theme.type.family
};

/** Sticky header bar chrome. */
export const barStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 30,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  background: `color-mix(in srgb, ${theme.color.surface} 80%, transparent)`,
  borderBottom: `1px solid ${theme.color.border}`,
  paddingTop: 'env(safe-area-inset-top, 0px)'
};

/** Shared max-width column for main and footer so left/right edges align. */
export const shellContainer: CSSProperties = {
  width: '100%',
  maxWidth: theme.layout.contentMaxWidth,
  margin: '0 auto',
  padding: `0 ${theme.space.lg}px`,
  boxSizing: 'border-box'
};

// Note: no `display` here on purpose — the `.ra-menu-btn` class owns
// visibility (hidden on desktop, inline-flex below 1024px).
/** Icon button chrome for menu open/close controls. */
export const iconButtonStyle: CSSProperties = {
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: theme.touch,
  minHeight: theme.touch,
  padding: theme.space.sm,
  margin: 0,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.sm,
  background: theme.color.surface,
  color: theme.color.text,
  cursor: 'pointer',
  fontSize: theme.type.scale[2],
  lineHeight: 1,
  fontFamily: theme.type.family
};

/**
 * Global shell CSS injected once by Page (nav, drawer, footer grid, h1).
 * Theme tokens only — no raw hex.
 */
export function shellCss(): string {
  return `
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; font-size: 16px; }

        /* Nav links echo the brand lockup: brushed-metal surface with a lit top
           edge, and the crimson glow the anvil carries. The TEXT keeps a solid
           token colour on purpose — gradient-clipped text renders as
           color:transparent, which axe cannot evaluate for contrast, and
           fe-a11y-contrast is a blocker. The metal is in the surface and the
           bevel, not in the letterforms. */
        .ra-nav-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: ${theme.touch}px;
          min-width: ${theme.touch}px;
          padding: ${theme.space.sm}px ${theme.space.md}px;
          border-radius: ${theme.radius.md}px;
          color: ${theme.color.muted};
          text-decoration: none;
          font-size: ${theme.type.scale[2]}px;
          font-weight: 550;
          letter-spacing: 0.01em;
          font-family: ${theme.type.family};
          border: 1px solid transparent;
          background: transparent;
          transition:
            color 0.18s ease,
            background 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            text-shadow 0.18s ease;
          box-sizing: border-box;
          white-space: nowrap;
        }
        .ra-nav-link:hover {
          color: ${theme.color.text};
          /* Vertical gradient = light catching the top face, like the anvil. */
          background: linear-gradient(
            180deg,
            color-mix(in srgb, ${theme.color.surface2} 92%, ${theme.color.text}) 0%,
            ${theme.color.surface} 100%
          );
          border-color: color-mix(in srgb, ${theme.color.border} 85%, ${theme.color.text});
          /* Lit top edge over a soft drop, the bevel the mark has. */
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, ${theme.color.text} 22%, transparent),
            inset 0 -1px 0 color-mix(in srgb, ${theme.color.bg} 45%, transparent),
            0 1px 6px color-mix(in srgb, ${theme.color.bg} 55%, transparent);
        }
        .ra-nav-link:focus-visible {
          outline: 2px solid ${theme.color.accent};
          outline-offset: 2px;
        }
        .ra-nav-link.is-active {
          color: ${theme.color.accentFg};
          font-weight: 650;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, ${theme.color.accent} 14%, ${theme.color.surface}) 0%,
            color-mix(in srgb, ${theme.color.accent} 9%, ${theme.color.surface}) 100%
          );
          border-color: color-mix(in srgb, ${theme.color.accent} 45%, ${theme.color.border});
          /* The crimson bloom off the anvil's top, at nav scale. */
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, ${theme.color.text} 18%, transparent),
            0 0 12px color-mix(in srgb, ${theme.color.accent} 28%, transparent);
          text-shadow: 0 0 10px color-mix(in srgb, ${theme.color.accent} 45%, transparent);
        }
        .ra-nav-link.is-active:hover {
          color: ${theme.color.accentFg};
          border-color: color-mix(in srgb, ${theme.color.accent} 60%, ${theme.color.border});
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, ${theme.color.text} 22%, transparent),
            0 0 16px color-mix(in srgb, ${theme.color.accent} 38%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          .ra-nav-link { transition: none; }
        }

        /* Desktop: primary links live in the sticky header (fe-premium-nav). */
        .ra-top-nav {
          display: none;
        }
        .ra-menu-btn { display: none; }
        .ra-drawer-backdrop { display: none; }
        .ra-drawer { display: none; }

        .ra-body {
          display: flex;
          flex: 1;
          min-width: 0;
          width: 100%;
          align-items: stretch;
        }
        .ra-main-col {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        @media (min-width: 1024px) {
          .ra-top-nav {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            flex: 1;
            min-width: 0;
            gap: ${theme.space.xs}px;
            margin: 0 ${theme.space.md}px;
          }
          .ra-menu-btn { display: none !important; }
        }

        @media (max-width: 1023px) {
          .ra-top-nav { display: none !important; }
          .ra-menu-btn { display: inline-flex !important; }
          .ra-drawer-backdrop[data-open="true"] {
            display: block !important;
            position: fixed;
            inset: 0;
            z-index: 40;
            background: ${theme.color.scrim};
          }
          .ra-drawer[data-open="true"] {
            display: flex !important;
            flex-direction: column;
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 50;
            width: min(18rem, 86vw);
            padding: calc(env(safe-area-inset-top, 0px) + ${theme.space.md}px) ${theme.space.md}px env(safe-area-inset-bottom, 0px);
            background: ${theme.color.surface};
            border-right: 1px solid ${theme.color.border};
            box-shadow: ${theme.color.shadow};
            gap: ${theme.space.sm}px;
            overflow-y: auto;
          }
          .ra-drawer nav {
            display: flex;
            flex-direction: column;
            gap: ${theme.space.xs}px;
          }
          .ra-drawer .ra-nav-link {
            width: 100%;
            justify-content: flex-start;
          }
          .ra-drawer-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: ${theme.space.sm}px;
            margin-bottom: ${theme.space.sm}px;
            min-height: ${theme.touch}px;
          }
          .ra-header-controls[data-drawer-open="true"] {
            visibility: hidden;
            pointer-events: none;
          }
        }

        /* Footer. Mobile is TWO columns, not one: measured at 375 the single
           column made the footer 828px tall — 35% of the whole page — for nine
           short links. The brand block spans both so the link columns sit side
           by side underneath it. Targets stay >=44px (fe-touch-targets); the
           height comes out of the column count, not out of the tap area. */
        .ra-footer-grid {
          display: grid;
          gap: ${theme.space.lg}px ${theme.space.md}px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
        }
        .ra-footer-brand {
          grid-column: 1 / -1;
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .ra-footer-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1024px) {
          .ra-footer-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .ra-footer-brand {
            grid-column: auto;
          }
        }

        @media (max-width: 560px) {
          .ra-h1 { font-size: 1.9rem !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ra-nav-link { transition: none; }
        }
      `;
}
