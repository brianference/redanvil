# Mobile + WCAG-AA checklist (v1.0.0)

Every generated app is verified against this at 375 / 768 / 1280.

- Contrast: 4.5:1 normal text, 3:1 large text (>=24px or >=18.66px bold) and UI component boundaries.
- Exactly one h1 per page; heading levels never skip.
- Visible focus indicator on every interactive control; full keyboard operability.
- Sticky header stays put on scroll; organized, professional footer.
- No overlapping or clipped text at 375px; touch targets >= 44px in the thumb zone.
- Every screen has explicit loading, error, and empty states.
- Dialogs wired via aria-labelledby / aria-describedby / aria-controls / aria-expanded.
- Confirmation before any destructive action.
- Images sized and lazy-loaded; a real OG image per route.
- Real brand logo (hand-authored SVG mark for the tiny UI logo; Grok Imagine PNG for premium/OG) — never an emoji. Every generated image is visually reviewed before shipping.
