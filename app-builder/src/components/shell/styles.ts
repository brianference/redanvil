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
            color-mix(in srgb, ${theme.color.surfaceElevated} 92%, ${theme.color.text}) 0%,
            ${theme.color.surface} 100%
          );
          border-color: color-mix(in srgb, ${theme.color.borderStrong} 70%, transparent);
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
            color-mix(in srgb, ${theme.color.accentSoft} 85%, ${theme.color.text} 4%) 0%,
            ${theme.color.accentSoft} 100%
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
            background: color-mix(in srgb, ${theme.color.text} 55%, transparent);
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
            box-shadow: 8px 0 32px color-mix(in srgb, ${theme.color.text} 25%, transparent);
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
          /* Hide header chrome while drawer is open — only the drawer close remains. */
          .ra-header-controls[data-drawer-open="true"] {
            visibility: hidden;
            pointer-events: none;
          }
        }

        /* Prose pages (About, Contact, Terms, Privacy). A single 44rem column
           left a wide desktop mostly empty, but stretching a paragraph to the
           full width would wreck the measure. The sections flow into two
           balanced columns from 1024 up instead: the page uses the width, each
           column keeps a readable line length. */
        .ra-prose-lead {
          max-width: 44rem;
        }
        .ra-prose-cols > section {
          max-width: 44rem;
        }
        @media (min-width: 1024px) {
          .ra-prose-lead {
            max-width: 56rem;
          }
          .ra-prose-cols {
            column-count: 2;
            column-gap: ${theme.space.xl}px;
          }
          .ra-prose-cols > section {
            max-width: none;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }

        /* Home composer. Mobile keeps the single stacked column it always had.
           From 1024 up it becomes two columns — the conversation on the left,
           the composer on the right and sticky — so a wide desktop shows the
           product working instead of a narrow strip in a sea of empty page.
           The width cap lives here, NOT as an inline style, so this media query
           can actually lift it. */
        .ra-chat {
          display: flex;
          flex-direction: column;
          gap: ${theme.space.lg}px;
          max-width: 44rem;
        }
        @media (min-width: 1024px) {
          .ra-chat {
            max-width: none;
            display: grid;
            grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
            gap: ${theme.space.xl}px;
            align-items: start;
          }
          .ra-chat-thread {
            min-width: 0;
          }
          .ra-chat-composer {
            position: sticky;
            /* Clear the sticky header plus a breath of space. */
            top: ${theme.space.xl}px;
            min-width: 0;
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
          grid-template-columns: 1fr;
          align-items: start;
        }
        /* Below desktop the three link groups flow into balanced columns.
           A 2-column GRID orphaned Legal on its own row with dead space beside
           it, because Product has four links and Company two. Multi-column
           balances the heights instead, and break-inside keeps a group whole. */
        .ra-footer-cols {
          column-count: 2;
          column-gap: ${theme.space.md}px;
        }
        .ra-footer-cols > * {
          break-inside: avoid;
          page-break-inside: avoid;
          margin-bottom: ${theme.space.lg}px;
        }
        @media (min-width: 1024px) {
          .ra-footer-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          /* Desktop keeps the original four-across grid: the wrapper stops
             being a box so its children are grid items again. */
          .ra-footer-cols {
            display: contents;
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
