/**
 * Theme bootstrap. MUST run before first paint, otherwise the page flashes the
 * wrong theme.
 *
 * This lives in a FILE rather than an inline <script> because public/_headers
 * sets `script-src 'self'` with no unsafe-inline. Inline, the browser blocked it,
 * data-theme was never set, and the body rendered with no background at all --
 * the theme simply did not work in production. A CSP hash would also work but
 * silently breaks again the moment this file is edited.
 */
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var choice =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.setAttribute('data-theme', choice);
  } catch (e) {
    try {
      document.documentElement.setAttribute(
        'data-theme',
        window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      );
    } catch (e2) {
      /* ignore */
    }
  }
})();
