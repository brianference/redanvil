/**
 * Shared with every RedAnvil app.
 *
 * Drawer, top-nav, and body column CSS was duplicated in each app's shellCss()
 * after the shared nav/footer block. Backdrop and shadow tokens differ by app
 * (color-mix vs named scrim/shadow), so those arrive as parameters.
 */

/** Palette and metrics for shell chrome CSS (nav bar, drawer, body). */
export interface ShellChromeTokens {
  /** Primary text (used for scrim mix when no dedicated scrim token). */
  text: string;
  /** Drawer panel surface. */
  surface: string;
  /** Hairline colour. */
  border: string;
  /** Drawer backdrop fill (token or color-mix). */
  drawerBackdrop: string;
  /** Drawer panel box-shadow. */
  drawerShadow: string;
  /** Small spacing step, px. */
  spaceXs: number;
  /** Small spacing step, px. */
  spaceSm: number;
  /** Medium spacing step, px. */
  spaceMd: number;
  /** Minimum touch edge, px. */
  touch: number;
}

/**
 * Top-nav, menu button, drawer, and body-column CSS shared by every shell.
 *
 * @param t - App chrome tokens.
 * @returns CSS string (no surrounding &lt;style&gt;).
 */
export function shellChromeCss(t: ShellChromeTokens): string {
  return `
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; font-size: 16px; }

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
            gap: ${t.spaceXs}px;
            margin: 0 ${t.spaceMd}px;
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
            background: ${t.drawerBackdrop};
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
            padding: calc(env(safe-area-inset-top, 0px) + ${t.spaceMd}px) ${t.spaceMd}px env(safe-area-inset-bottom, 0px);
            background: ${t.surface};
            border-right: 1px solid ${t.border};
            box-shadow: ${t.drawerShadow};
            gap: ${t.spaceSm}px;
            overflow-y: auto;
          }
          .ra-drawer nav {
            display: flex;
            flex-direction: column;
            gap: ${t.spaceXs}px;
          }
          .ra-drawer .ra-nav-link {
            width: 100%;
            justify-content: flex-start;
          }
          .ra-drawer-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: ${t.spaceSm}px;
            margin-bottom: ${t.spaceSm}px;
            min-height: ${t.touch}px;
          }
          /* Hide header chrome while drawer is open — only the drawer close remains. */
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
