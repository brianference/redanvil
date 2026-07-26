/**
 * Dashboard shell chrome: shared style objects + CSS (no app-builder chat grid).
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
    surfaceRaised: theme.color.surface2,
    text: theme.color.text,
    muted: theme.color.muted,
    accent: theme.color.accent,
    accentFg: theme.color.accentFg,
    border: theme.color.border,
    borderStrong: theme.color.border
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
  drawerBackdrop: theme.color.scrim,
  drawerShadow: theme.color.shadow,
  spaceXs: theme.space.xs,
  spaceSm: theme.space.sm,
  spaceMd: theme.space.md,
  touch: theme.touch
});

/**
 * Global shell CSS injected once by Page (nav, drawer, footer grid, h1).
 * Theme tokens only — no raw hex.
 */
export function shellCss(): string {
  return `
${CHROME_CSS}

${SHARED_SHELL_CSS}
      `;
}
