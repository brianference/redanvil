# Spec — app-builder's own legal pages, and the examples page

Scope: **only** `app-builder/`. Do **not** touch `az-planting-calendar/` —
another run owns it. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Use theme tokens for colour. Never hardcode a hex value in a component.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Write `--`. Never a unicode em dash.

## 1. RedAnvil must meet the standard it now sets

`app-builder/src/lib/prd/sections/design.ts` now tells every generated app that
Terms and Privacy need **>= 1400 words across >= 14 headed sections** with
required topic coverage, and `fe-legal-substance` enforces it. app-builder's own
pages still satisfy only the old floor: `src/i18n/en.test.ts:92` asserts
`>= 150 words` and `>= 3 sections`.

A standard its author does not meet is a standard nobody will meet.

Rewrite app-builder's own Terms and Privacy in `src/i18n/en.ts` to the new floor,
then raise that test from `>=150/>=3` to `>=1400/>=14`.

Required topics — the same lists `fe-legal-substance` scores:

- **Terms:** acceptance and eligibility, what the service is, the central
  disclaimer, acceptable use, intellectual property in generated output,
  third-party services, disclaimer of warranties, limitation of liability,
  indemnity, availability and changes, termination, changes to the terms,
  governing law, contact.
- **Privacy:** who we are and how to reach us, accounts, what is collected, what
  is NOT collected, why it is processed, third-party processors, cookies and
  local storage, where data lives and transfers, retention and deletion, what a
  visitor can request, children, security practices, changes, privacy contact.

**Every statement must be true of app-builder specifically.** Verify each claim
against the code and the live app before writing it -- do not carry any
assertion over from this spec on trust.

One boundary is already verified and must be disclosed accurately:
`GET /api/prds` on https://redanvil.pages.dev returned **HTTP 200 with no
authentication** (checked 2026-08-02), so saved PRDs are readable by anyone.
Write the "what is public by design" and "your content" sections against that
measured result, and state the exposure plainly rather than softening it.

Re-verify every other boundary the same way: read the handler, or call the
endpoint, before writing a sentence about who can see what. Never claim a cookie
you do not set or a right you do not honour. The existing pages already carry the
central disclaimer about a PRD being a starting specification; `en.test.ts`
asserts that wording, so it must survive the rewrite.

Run `fe-legal-substance` against app-builder afterwards and paste the output.

## 2. The examples page

Add **az-planting-calendar** to the examples page with real screenshots.

Screenshots already exist and are current — use them, do not re-capture:
`evidence/screenshots/final-375-light.png`, `final-1280-light.png`,
`final-375-dark.png`, `final-1280-dark.png` (repo root `evidence/`). Copy what
you need into app-builder's public assets, optimised to WebP, sized to their
render slot, with explicit width/height and `loading="lazy"`.

Entry content, all verifiable from the app itself — do not invent metrics:

- What it is: an Arizona low-desert planting calendar for Maricopa County.
- Real numbers: 45 crops, 83 planting windows, 8 zones, every window citing
  UA Cooperative Extension az1005. Query D1 or read SOURCES.md rather than
  copying these from this spec.
- Live URL: https://az-planting-calendar.pages.dev

## 3. Three options for the examples page — a gallery, not a decision

`docs/plan-source-taketheprdandjoyfulprism.md` §7.3a makes "three structurally
distinct options presented for a pick" a blocker, and `proc-design-options` now
enforces it. So: build the options, do **not** pick.

Three **structurally distinct** treatments for the examples page and its cards.
If recolouring one produces another, it is one option. Vary the card
architecture, how screenshots are presented, and what leads.

Each renders **dark and light** at **375 and 1280**. Assemble into
`design-refs/design-options/gallery.html` — multi-column, one column per option,
dark and light frames stacked, numbered labels, dark page background. Write
`design-refs/design-options/DECISION.md` stating in one line how the three
differ structurally, with the chosen option left blank.

`proc-design-options` requires at least three option artifacts plus a
`DECISION.md` with no unwritten marker, so this both satisfies the rule and
gives the user something to pick from.

**Do not implement any option.** Stop after the gallery.

## Definition of done

Report each with real output:

- Word and section counts for the rewritten Terms and Privacy.
- `fe-legal-substance` run against app-builder, exit code and output.
- `npx tsc --noEmit`, `npx eslint . --max-warnings 0`, `npx vitest run` in
  app-builder — real tails, including the raised `en.test.ts` assertion.
- The three option artifacts exist and the gallery opens.
- Total KB added by the screenshots.

If any legal claim cannot be made truthfully about app-builder, say so and leave
that topic out rather than writing something false to clear a topic check.
