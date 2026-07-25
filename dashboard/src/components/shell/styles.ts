import type { CSSProperties } from 'react';
import { theme } from '../../theme';
import { shellCss as sharedShellCss } from '../../../../design-system/shellCss';

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
/**
 * Nav, prose and footer CSS shared with every other RedAnvil app. Kept in
 * design-system/ so the two shells cannot drift apart, and so the cross-app
 * duplication budget stops climbing every time the shell is touched.
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

export function shellCss(): string {
  return `
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; font-size: 16px; }

${SHARED_SHELL_CSS}

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


        @media (max-width: 560px) {
          .ra-h1 { font-size: 1.9rem !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ra-nav-link { transition: none; }
        }
      `;
}
