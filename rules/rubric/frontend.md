# Frontend lane (v1.1.0)

- fe-theme-tokens-only (blocker, det): every value from theme tokens; no hardcoded hex or px; overlays via alpha() against an existing token.
- fe-a11y-contrast (blocker, det): WCAG AA contrast — 4.5:1 normal text, 3:1 large text and UI boundaries.
- fe-i18n-central-copy (blocker, det): all user-facing copy in the central locale bundle, namespaced by feature; never hardcoded inline.
- fe-no-unsanitized-html (blocker, det): no dangerouslySetInnerHTML without a sanitizer.
- fe-pages-compose (major, judge): a page's return reads as a short list of named components; the page owns state and passes it down.
- fe-fail-closed-states (major, det+judge): every screen defines explicit loading, error, empty, and partial states; a failure never renders as a clean empty success.

## Premium/design rules (method `visual`, fail-closed)

These are scored from a recorded visual review of the rendered page, never from code.
Method `visual` is **fail-closed**: with no recorded verdict the rule FAILS, so a run
cannot score above zero until a real visual review at 375 / 768 / 1280 is recorded.
This is the root-cause fix for premium requirements that used to auto-pass because
nothing in the scored rubric decided them.

- fe-light-dark (blocker, visual): light AND dark mode with a visible toggle; every color resolves from a semantic token per theme; default follows the system, the choice persists, both themes pass WCAG AA.
- fe-premium-nav (blocker, visual): a polished sticky top nav with the brand mark and primary links that have clear hover AND active states (not bare text links); overflow in a menu; breadcrumbs on inner/detail pages.
- fe-required-pages (blocker, visual): Home, About, Terms, Privacy, and Contact all present and reachable from the shared nav/footer.
- fe-no-attribution (blocker, visual): no "made with" / "built with" attribution text anywhere in the UI.
- fe-responsive-375 (blocker, visual): no overlapping or clipped text at 375px; verified at 375 / 768 / 1280.
- fe-product-completeness (blocker, visual): the app delivers its stated core feature end-to-end with usable output; a flow that collects input but produces nothing fails.
- fe-visual-review-recorded (blocker, visual): a visual review was actually performed and recorded — screenshots at all three breakpoints in both themes, zero console errors. The meta-rule that cannot auto-pass.
- fe-seo-og (major, visual): per-route title/description, Open Graph tags, a real OG image, sitemap, robots.txt, JSON-LD, semantic headings.
- fe-cross-link (major, visual): sibling apps in one system cross-link in a shared header/footer so the product is navigable, not orphan pages.

## Measurable mobile-ux rules (method `visual`, from mobile-design-rules R1–R12)

Promoted from prose/checklist to scored rules so the mobile design system is measured, not just documented.

- fe-touch-targets (blocker, visual): primary tap targets >= 44x44 pt / 48x48 dp; >= 8pt between adjacent controls (R1.1/R1.2).
- fe-type-floor (blocker, visual): body text >= 16px on mobile for primary content (R3.1).
- fe-noncolor-state (major, visual): state is never signalled by color alone; pair with icon/text/weight (R4.2).
- fe-safe-areas (major, visual): respect top/bottom/landscape safe areas; content never trapped under fixed header/tab bar (R2.1/R2.2).
