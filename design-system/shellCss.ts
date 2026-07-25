/**
 * Shell CSS shared by every RedAnvil app.
 *
 * The nav links, the footer grid and the prose columns are the same design in
 * every app, and keeping a copy per app is how 805 duplicated lines accumulated
 * between app-builder and dashboard in the first place. `cross_app_duplication`
 * caught the next 49 the moment they were added, which is what the ratchet is
 * for; this is the response it was asking for.
 *
 * Apps differ only in what they NAME their tokens (`surfaceElevated` vs
 * `surface2`), so the palette arrives as a parameter rather than being imported.
 */

/** Palette an app supplies to render the shared shell CSS. */
export interface ShellCssTokens {
  /** Page background. */
  bg: string;
  /** Base panel colour. */
  surface: string;
  /** Panel colour one step above `surface`, used for the lit face of a control. */
  surfaceRaised: string;
  /** Primary body colour. */
  text: string;
  /** Secondary body colour. */
  muted: string;
  /** Brand accent fill. */
  accent: string;
  /** Accent colour that meets AA as text on a surface. */
  accentFg: string;
  /** Hairline colour. */
  border: string;
  /** Hairline colour for a raised edge. */
  borderStrong: string;
}

/** Spacing and metrics the shared CSS needs. */
export interface ShellCssMetrics {
  /** Minimum touch target edge, px (R1.1). */
  touch: number;
  /** Small / medium / large / extra-large spacing steps, px. */
  space: { sm: number; md: number; lg: number; xl: number };
  /** Corner radius for a control, px. */
  radiusMd: number;
  /** Body type size, px. */
  fontBody: number;
  /** Font stack. */
  fontFamily: string;
}

/**
 * Nav links, footer layout and prose columns, as one CSS string.
 *
 * @param c - App palette.
 * @param m - App spacing and type metrics.
 * @returns CSS to inject into the shell's global style block.
 */
export function shellCss(c: ShellCssTokens, m: ShellCssMetrics): string {
  return `
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
          min-height: ${m.touch}px;
          min-width: ${m.touch}px;
          padding: ${m.space.sm}px ${m.space.md}px;
          border-radius: ${m.radiusMd}px;
          color: ${c.muted};
          text-decoration: none;
          font-size: ${m.fontBody}px;
          font-weight: 550;
          letter-spacing: 0.01em;
          font-family: ${m.fontFamily};
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
          color: ${c.text};
          background: linear-gradient(
            180deg,
            color-mix(in srgb, ${c.surfaceRaised} 92%, ${c.text}) 0%,
            ${c.surface} 100%
          );
          border-color: color-mix(in srgb, ${c.borderStrong} 70%, transparent);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, ${c.text} 22%, transparent),
            inset 0 -1px 0 color-mix(in srgb, ${c.bg} 45%, transparent),
            0 1px 6px color-mix(in srgb, ${c.bg} 55%, transparent);
        }
        .ra-nav-link:focus-visible {
          outline: 2px solid ${c.accent};
          outline-offset: 2px;
        }
        .ra-nav-link.is-active {
          color: ${c.accentFg};
          font-weight: 650;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, ${c.accent} 14%, ${c.surface}) 0%,
            color-mix(in srgb, ${c.accent} 9%, ${c.surface}) 100%
          );
          border-color: color-mix(in srgb, ${c.accent} 45%, ${c.border});
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, ${c.text} 18%, transparent),
            0 0 12px color-mix(in srgb, ${c.accent} 28%, transparent);
          text-shadow: 0 0 10px color-mix(in srgb, ${c.accent} 45%, transparent);
        }
        .ra-nav-link.is-active:hover {
          color: ${c.accentFg};
          border-color: color-mix(in srgb, ${c.accent} 60%, ${c.border});
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, ${c.text} 22%, transparent),
            0 0 16px color-mix(in srgb, ${c.accent} 38%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          .ra-nav-link { transition: none; }
        }

        /* Prose pages. A single 44rem column left a wide desktop mostly empty,
           but stretching a paragraph to full width would wreck the measure. The
           sections flow into two balanced columns from 1024 up instead. */
        .ra-prose-lead {
          max-width: 44rem;
        }
        .ra-prose-cols > section {
          max-width: 44rem;
        }
        @media (min-width: 1024px) {
          .ra-prose-lead {
            max-width: 64rem;
          }
          .ra-prose-cols {
            column-count: 2;
            column-gap: ${m.space.xl}px;
          }
          .ra-prose-cols > section {
            max-width: none;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
        /* A third column past 1600 so a 94%-wide container does not turn each
           column into an over-long line. Width is used; measure is protected. */
        @media (min-width: 1600px) {
          .ra-prose-lead {
            max-width: 76rem;
          }
          .ra-prose-cols {
            column-count: 3;
          }
        }

        /* Builder content column (template gallery, PRD result). The cap used
           to be an inline maxWidth of 46rem, which no media query could lift —
           the template screen therefore sat in ~55% of a wide desktop with the
           rest empty. Class here, lifted from 1024 up. */
        .ra-content-col {
          display: flex;
          flex-direction: column;
          gap: ${m.space.lg}px;
          width: 100%;
          max-width: 46rem;
        }
        @media (min-width: 1024px) {
          .ra-content-col {
            max-width: none;
          }
          /* Archetype cards use the width instead of stacking two-wide. */
          .ra-tpl-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }
        @media (min-width: 1600px) {
          .ra-tpl-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }

        /* Footer. Measured at 375, one column made the footer 828px tall — 35%
           of the whole page — for nine short links. The three link groups flow
           into balanced columns instead, so no group is orphaned beside dead
           space. Targets stay >=44px; the height comes out of the column count. */
        .ra-footer-grid {
          display: grid;
          gap: ${m.space.lg}px ${m.space.md}px;
          grid-template-columns: 1fr;
          align-items: start;
        }
        .ra-footer-cols {
          column-count: 2;
          column-gap: ${m.space.md}px;
        }
        .ra-footer-cols > * {
          break-inside: avoid;
          page-break-inside: avoid;
          margin-bottom: ${m.space.lg}px;
        }
        @media (min-width: 1024px) {
          .ra-footer-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          /* Desktop keeps the four-across grid: the wrapper stops being a box
             so its children become grid items again. */
          .ra-footer-cols {
            display: contents;
          }
        }
`;
}
