# Brand mark note — pet-sitter

Logo / brand-mark **PNG generation is owned by a separate role** (Grok Imagine / brand-logo skill). This design-options pass does **not** produce the production mark.

## Expected production path

| Asset | Path | Notes |
|---|---|---|
| Primary brand mark | `public/brand-mark.png` | Required for shell header and `fe-brand-mark` |
| Optional candidates during design | `design-refs/logos/` | Review before promote to `public/` |
| Favicon / OG | `public/` (e.g. favicon, `og` image) | Real raster or reviewed SVG; not emoji |

## Rules for the logo role

- Real generated mark — never emoji, never a text-only initials span as the logo.
- Visually review every candidate before shipping.
- Wire the chosen file into the sticky nav and footer; keep file weight above trivial stub sizes that fail `fe-brand-mark`.

## Layout dependency

Home / search layout is decided in `design-refs/design-options/DECISION.md` (**Option A**). The mark must read clearly on light and dark sticky headers with strong borders (brutal-utility direction).
