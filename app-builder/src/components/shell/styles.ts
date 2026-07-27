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

        /* Examples. The prompt and the PRD sit side by side from 900 up; below
           that they stack. Width lives here rather than inline so the media
           query can lift it (R14) and so the page still paints across the
           viewport at 1440 and 1920 (R22). */
        .ex-story {
          display: flex;
          flex-direction: column;
          gap: ${theme.space.xl}px;
          padding-bottom: ${theme.space.xl}px;
        }
        .ex-story + .ex-story {
          border-top: 1px solid ${theme.color.border};
          padding-top: ${theme.space.xl}px;
        }
        .ex-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: ${theme.space.lg}px;
        }
        @media (min-width: 900px) {
          .ex-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }
        }
        /* Three panels once there is room for them: prompt, brand, PRD. */
        @media (min-width: 1280px) {
          .ex-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1.15fr);
          }
        }
        .ex-logo {
          display: block;
          width: 100%;
          max-width: 220px;
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
        /* Store-style strip: captioned phones in a row that scrolls on its own
           rather than making the page scroll sideways (fe-responsive-375). */
        .ex-screens {
          list-style: none;
          margin: 0;
          padding: 0 0 ${theme.space.sm}px;
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(240px, 1fr);
          gap: ${theme.space.lg}px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
        }
        .ex-screen {
          min-width: 0;
          scroll-snap-align: start;
        }
        .ex-phone {
          display: block;
          width: 100%;
          height: auto;
          border: 1px solid ${theme.color.border};
          border-radius: ${theme.radius.md}px;
          background: ${theme.color.surface};
        }
        @media (min-width: 900px) {
          .ex-screens {
            grid-auto-flow: row;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            overflow-x: visible;
          }
        }
      `;
}
