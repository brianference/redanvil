# RedAnvil app-builder — merged premium mobile redesign (implement in real code)

Rebuild the app-builder's UI to a unified, premium, mobile-first experience by
MERGING the approved mockups. Grok's design language is the DEFAULT (it's stronger);
fold in the specific Claude elements the reviewer liked. This is a UI redesign — keep
all existing business logic (src/lib/prd.ts, estimate.ts, job.ts, savePrd.ts) intact.

Reference mockups (read them):

- Grok team (default look): mockups/grok-v1.html … grok-v5.html
- Claude variations: mockups/claude-variations.html

## Per-screen merge directions (reviewer's exact calls)

- **Prompt/composer + chat flow:** use Grok's conversational design (grok-v1) as the
  base — it's better — and fold in the chat feel from Claude variation 2. The home
  should let the user describe the app in a warm, chat-like composer.
- **Wizard:** use Grok's wizard (grok-v2) as the base — it's better — and add the nice
  pill-box option chips and clear step indicators from Claude variation 3.
- **Templates:** MERGE Grok's template gallery (grok-v3) with Claude variation 4 — a
  card grid of app archetypes (SaaS, marketplace, internal tool, mobile app, API) plus
  an "or describe your own" path.
- **PRD result:** use Grok's PRD/hero design (grok-v4) — it's better.
- **Saved / current builds:** use Grok's dashboard (grok-v5) — it's better — and keep
  the "recent builds" glanceable list idea from Claude variation 5.

## HARD constraints

- **KEEP THE CURRENT APPROVED LOGOS. Do NOT introduce any new logo or brand mark.**
  The header/footer logo stays exactly the existing asset (`/logo-sm.png`, and
  `/banner.webp` where used). Do not draw a new SVG anvil, do not restyle the logo,
  do not swap it. The reviewer approved the current logos; keep them as-is.
- Keep the existing premium Page.tsx shell (sticky header, theme toggle, breadcrumbs,
  footer), light/dark themes, and i18n bundle. Extend, don't replace, these.
- Follow EVERY scored design rule (design-system/mobile-design-rules.md R1–R13):
  light AND dark intentional; touch targets >=44px; body >=16px; state never by color
  alone; safe-area padding on sticky bars; ONE h1 per screen; loading, empty, AND error
  states on the generate/save flows; no horizontal overflow or clipped text at 375px;
  premium nav with hover+active; breadcrumbs on inner pages; no "made with" text.
- TypeScript strict, no `any`, JSDoc on every function, all copy in the i18n bundle,
  theme tokens only (no raw hex/px in components), Human Writing Guidelines for copy.
- Do NOT deploy, push, or run git. Do NOT touch .env, wrangler config, or functions/
  secrets. Code only.

## Definition of done (self-check with --check)

`npx tsc --noEmit` clean, `npx eslint . --max-warnings 0` clean, `npx vitest run` green.
The home, wizard, templates, PRD result, and saved-builds screens all reflect the merged
premium design, the current logo is unchanged, and every screen has loading/empty/error
states. Report files changed and the final tsc/eslint/test results.
