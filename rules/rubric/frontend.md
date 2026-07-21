# Frontend lane (v1.0.0)

- fe-theme-tokens-only (blocker, det): every value from theme tokens; no hardcoded hex or px; overlays via alpha() against an existing token.
- fe-a11y-contrast (blocker, det): WCAG AA contrast — 4.5:1 normal text, 3:1 large text and UI boundaries.
- fe-i18n-central-copy (blocker, det): all user-facing copy in the central locale bundle, namespaced by feature; never hardcoded inline.
- fe-no-unsanitized-html (blocker, det): no dangerouslySetInnerHTML without a sanitizer.
- fe-pages-compose (major, judge): a page's return reads as a short list of named components; the page owns state and passes it down.
- fe-fail-closed-states (major, det+judge): every screen defines explicit loading, error, empty, and partial states; a failure never renders as a clean empty success.
