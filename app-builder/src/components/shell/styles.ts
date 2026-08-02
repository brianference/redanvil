/**
 * App-builder shell chrome: shared style objects + CSS, plus the home chat grid
 * that only this product needs.
 */
import type { CSSProperties } from 'react';
import { shellChromeCss } from '../../../../design-system/shellChromeCss';
import { shellCss as sharedShellCss } from '../../../../design-system/shellCss';
import {
  makeBarStyle,
  makeIconButtonStyle,
  makeShellContainer,
  makeShellStyle,
  type ShellStyleTokens
} from '../../../../design-system/shellStyles';
import { theme } from '../../theme';

const styleTokens: ShellStyleTokens = {
  bg: theme.color.bg,
  surface: theme.color.surface,
  text: theme.color.text,
  fontFamily: theme.type.family,
  border: theme.color.border,
  contentMaxWidth: theme.layout.contentMaxWidth,
  spaceLg: theme.space.lg,
  spaceSm: theme.space.sm,
  touch: theme.touch,
  radiusSm: theme.radius.sm,
  fontSize: theme.type.scale[2] ?? 16
};

/** Full-page shell background and type base. */
export const shellStyle: CSSProperties = makeShellStyle(styleTokens);

/** Sticky header bar chrome. */
export const barStyle: CSSProperties = makeBarStyle(styleTokens);

/** Shared max-width column for main and footer so left/right edges align. */
export const shellContainer: CSSProperties = makeShellContainer(styleTokens);

// Note: no `display` here on purpose — the `.ra-menu-btn` class owns
// visibility (hidden on desktop, inline-flex below 1024px).
/** Icon button chrome for menu open/close controls. */
export const iconButtonStyle: CSSProperties = makeIconButtonStyle(styleTokens);

/**
 * Nav, prose and footer CSS shared with every other RedAnvil app.
 */
const SHARED_SHELL_CSS = sharedShellCss(
  {
    bg: theme.color.bg,
    surface: theme.color.surface,
    surfaceRaised: theme.color.surfaceElevated,
    text: theme.color.text,
    muted: theme.color.muted,
    accent: theme.color.accent,
    accentFg: theme.color.accentFg,
    border: theme.color.border,
    borderStrong: theme.color.borderStrong
  },
  {
    touch: theme.touch,
    space: {
      sm: theme.space.sm,
      md: theme.space.md,
      lg: theme.space.lg,
      xl: theme.space.xl
    },
    radiusMd: theme.radius.md,
    // ?? 16 satisfies noUncheckedIndexedAccess; 16 is also the fe-type-floor
    // body minimum, so the fallback is the rule's own value, not a guess.
    fontBody: theme.type.scale[2] ?? 16,
    fontFamily: theme.type.family
  }
);

const CHROME_CSS = shellChromeCss({
  text: theme.color.text,
  surface: theme.color.surface,
  border: theme.color.border,
  drawerBackdrop: `color-mix(in srgb, ${theme.color.text} 55%, transparent)`,
  drawerShadow: `8px 0 32px color-mix(in srgb, ${theme.color.text} 25%, transparent)`,
  spaceXs: theme.space.xs,
  spaceSm: theme.space.sm,
  spaceMd: theme.space.md,
  touch: theme.touch
});

/**
 * Global shell CSS injected once by Page (nav, drawer, footer grid, h1).
 * Theme tokens only — no raw hex. Includes the home composer grid unique to
 * this app.
 */
export function shellCss(): string {
  return `
${CHROME_CSS}

${SHARED_SHELL_CSS}

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
            /* Even columns. 1.1fr / 0.9fr made the side you TYPE INTO the
               smaller of the two, which is backwards — the instructions are
               read once and the composer is used every time. */
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
            /* The composer column ended ~300px short of the instructions,
               leaving the right half of the fold empty. Growing the panel to a
               share of the viewport balances the two without a fixed height
               that would break on a short screen. */
            display: flex;
            flex-direction: column;
            min-height: 60vh;
          }
          .ra-chat-composer > div {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .ra-chat-composer form {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .ra-chat-composer textarea {
            flex: 1;
          }

        }

        /* Examples -- card catalog (option 3). Filter chips + equal magazine cards.
           Width lives in CSS so media queries can lift it (no JS maxWidth). */
        .ex-catalog {
          display: flex;
          flex-direction: column;
          gap: ${theme.space.lg}px;
          width: 100%;
        }
        .ex-catalog__bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: ${theme.space.md}px;
        }
        .ex-catalog__filters {
          display: flex;
          flex-wrap: wrap;
          gap: ${theme.space.sm}px;
        }
        .ex-chip {
          min-height: 36px;
          padding: 0 ${theme.space.md}px;
          border-radius: ${theme.radius.pill}px;
          border: 1px solid ${theme.color.border};
          background: ${theme.color.chipBg};
          color: ${theme.color.text};
          font-size: ${theme.type.scale[1]}px;
          font-weight: 600;
          cursor: pointer;
        }
        .ex-chip--on {
          border-color: ${theme.color.accent};
          color: ${theme.color.accentFg};
          font-weight: 700;
        }
        .ex-chip:focus-visible {
          outline: none;
          box-shadow: ${theme.shadow.focus};
        }
        .ex-catalog__grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: ${theme.space.lg}px;
          width: 100%;
        }
        @media (min-width: 900px) {
          .ex-catalog__grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .ex-card {
          display: flex;
          flex-direction: column;
          gap: ${theme.space.lg}px;
          min-width: 0;
        }
        .ex-card__face {
          background: ${theme.color.surface};
          border: 1px solid ${theme.color.border};
          border-radius: ${theme.radius.lg ?? 16}px;
          overflow: hidden;
          min-width: 0;
        }
        .ex-card__stack {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: ${theme.space.sm}px;
          padding: ${theme.space.md}px ${theme.space.md}px 0;
          align-items: end;
        }
        .ex-card__device {
          width: 100%;
          height: auto;
          border-radius: ${theme.radius.md}px ${theme.radius.md}px 0 0;
          border: 1px solid ${theme.color.border};
          border-bottom: 0;
          display: block;
          background: ${theme.color.bg};
        }
        .ex-card__device--back {
          opacity: 0.88;
          transform: translateY(12px);
        }
        .ex-card__meta {
          padding: ${theme.space.lg}px;
          border-top: 1px solid ${theme.color.border};
        }
        .ex-card__stats {
          list-style: none;
          margin: ${theme.space.md}px 0 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: ${theme.space.sm}px;
        }
        .ex-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: ${theme.space.sm}px;
          margin-top: ${theme.space.md}px;
        }
        .ex-card__does,
        .ex-card__shipped,
        .ex-card__built {
          display: flex;
          flex-direction: column;
          gap: ${theme.space.md}px;
          min-width: 0;
        }
        .ex-features {
          display: flex;
          flex-direction: column;
          gap: ${theme.space.md}px;
        }
        .ex-feature-group {
          min-width: 0;
        }
        .ex-card__built-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: ${theme.space.lg}px;
        }
        @media (min-width: 900px) {
          .ex-card__built-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1280px) {
          .ex-card__built-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .ex-logo {
          display: block;
          width: 100%;
          max-width: 180px;
          height: auto;
          margin: 0 auto;
        }
        .ex-shot {
          display: block;
          width: 100%;
          height: auto;
          border: 1px solid ${theme.color.border};
          border-radius: ${theme.radius.sm}px;
        }
      `;
}
