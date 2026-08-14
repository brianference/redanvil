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
            column-gap: ${m.space.xl}px;
          }
          .ra-prose-cols > section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* Column count follows the CONTENT, not the viewport alone. A fixed
             column-count: 3 left Contact — which has two sections — with an
             empty right third, so its content ended at 60% of a 1920 viewport
             while Terms reached 91%. These quantity queries only add a column
             once there is something to put in it. */
          .ra-prose-cols:has(> section:nth-child(2)) {
            column-count: 2;
          }
          .ra-prose-cols:has(> section:nth-child(2)) > section {
            max-width: none;
          }
        }
        /* A third column past 1600 so a 94%-wide container does not turn each
           column into an over-long line. Width is used; measure is protected. */
        @media (min-width: 1600px) {
          .ra-prose-lead {
            max-width: 76rem;
          }
          .ra-prose-cols:has(> section:nth-child(3)) {
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
        /* The footer's brand blurb sits in one column of a multi-column footer
           and is meant to stay a short measure — but the cap still belongs
           here, not inline, so a wider footer can lift it rather than leaving
           a ragged 18rem block in a 400px column. */
        .ra-footer-tagline {
          max-width: 18rem;
        }
        @media (min-width: 1600px) {
          .ra-footer-tagline {
            max-width: 24rem;
          }
        }

        /* Saved-page surfaces. These were three inline 40rem maxWidth caps
           in the page's own style objects, which held the content to 33% of a
           1920 viewport — two thirds of the screen empty — while the width
           check reported 93% because it was measuring the container rather
           than what is painted inside it. Width and column count belong here,
           where a media query can reach them (R14, R15). */
        .ra-saved-col {
          width: 100%;
          max-width: 40rem;
        }
        /* Two-up until there is room for three. A rigid three-up left each tile
           a 57px content box at 320, so every KPI label ellipsised (measured on
           production; at 375 the same page renders "THIS WE…" and "IN LIBRA…").
           The scheduled re-gate reported this on an Ubuntu runner while the
           identical script on Windows found one clip of the six: the app loads
           no Inter webfont, so the Inter/system-ui/sans-serif stack resolves to
           a different face per platform and the layout was tuned to one of them.
           Column count is the fix; a narrower label would only move the
           breakpoint. */
        .ra-saved-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (min-width: 480px) {
          .ra-saved-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        /* A card is a grid item, so its automatic minimum is its min-content
           width — 290px of icon, badges and date that cannot shrink. That
           forced a 306px track inside a 253px container and pushed the
           overflow all the way up to <main>. */
        .ra-saved-list > li {
          min-width: 0;
        }
        @media (min-width: 1024px) {
          .ra-saved-col {
            max-width: none;
          }
          /* More cards per row rather than three stretched ones: a KPI tile
             that spans 500px reads as a mistake, not as a use of the width. */
          .ra-saved-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .ra-saved-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1600px) {
          .ra-saved-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
          .ra-saved-list {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        /* Wizard form column. Same reasoning as .ra-content-col: this was an
           inline maxWidth of 40rem, which reads fine at 375 and then strands
           the form in a third of a 1600px desktop with no way for a media
           query to reach it. An independent judge found it surviving the
           desktop-width pass precisely because it was inline (rule R14). */
        .ra-form-col {
          width: 100%;
          max-width: 40rem;
        }
        @media (min-width: 1024px) {
          .ra-content-col {
            max-width: none;
          }
          /* The wizard steps are the longest screens in the product and they
             were held to 58rem — 48% of a 1920 viewport. The width check never
             saw it, because it measures ROUTES and every wizard step is a state
             inside "/". Reported from a live run, not by a rule. */
          .ra-form-col {
            max-width: none;
          }
          /* Fields stay a readable measure inside the wider form: the point is
             to use the width for layout, not to stretch a single input across
             the screen. */
          .ra-form-col .ra-field {
            max-width: 44rem;
          }
          /* Choice grids are what should actually consume the extra width. */
          .ra-choice-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
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
