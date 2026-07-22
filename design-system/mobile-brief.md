# RedAnvil app-builder — mobile home design brief (for design agents)

Design ONE premium mobile home screen for the RedAnvil app-builder as a single
self-contained HTML mockup file. RedAnvil forges a full-stack app from one prompt:
the user describes an app, RedAnvil asks a few questions, then generates a
downloadable PRD. Screen type: **home / prompt composer** (mobile-first, 390px).

## Must follow (from design-system/mobile-design-rules.md R1–R13)
- 16px+ body, one clear H1, WCAG AA contrast in BOTH themes.
- Touch targets >= 44px; 8px min spacing between controls.
- Light AND dark: every color from CSS variables that resolve per theme; a visible
  theme toggle. **Both themes must look intentional** — no dark card/box bleaking
  into light mode.
- Premium sticky header with a real brand mark and hover/active nav states.
- No horizontal overflow and no overlapping/clipped text at 390px.
- Explicit loading, empty, and error states for the generate action.
- One primary CTA ("Forge" / "Generate PRD") with clear visual weight.

## CRITICAL brand fix (this is the current defect)
The current logo is a RASTER PNG with a solid dark background baked in (no alpha),
so in LIGHT mode it renders as an ugly black box. Do NOT use a dark-background
raster logo. Use a **theme-aware brand mark**: an inline SVG anvil glyph that uses
`currentColor` / theme tokens + a "RedAnvil" wordmark, sitting on the page surface
with NO opaque box behind it. The mark must look clean on both light and dark.

## Deliverable
A single HTML file that renders BOTH a light-theme phone and a dark-theme phone
side by side (two 390px-wide phone frames), so the reviewer sees both at once.
Inline all CSS (use CSS variables for theming). Self-contained, no external assets
(draw the anvil as inline SVG). Realistic copy, not lorem ipsum. Show the primary
composer, example prompt chips, and at least one of loading/empty/error state.
Label the mockup with its variation name at the top.
