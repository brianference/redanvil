/** App Builder production origin. */
export const APP_URL = 'https://redanvil.pages.dev';

/** Dashboard production origin. */
export const DASHBOARD_URL = 'https://redanvil-dashboard.pages.dev';

/** Public GitHub repository URL. */
export const GITHUB_URL = 'https://github.com/brianference/redanvil';

/** Default logo lockup height in the sticky header (px). */
export const LOGO_HEIGHT = 112;

/** Logo lockup height in the mobile drawer head (px). */
export const DRAWER_LOGO_HEIGHT = 48;

/**
 * Footer lockup height, px.
 *
 * The lockup is a 440x149 raster with the tagline baked into the pixels, so it
 * does not degrade gracefully: at 48px the tagline rendered about five pixels
 * tall and read as a grey smear, which a measured check cannot see and a visual
 * review can. 80px keeps it legible without competing with the 112px header.
 */
export const FOOTER_LOGO_HEIGHT = 80;
