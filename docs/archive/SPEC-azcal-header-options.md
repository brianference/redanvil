# Spec — three integrated header options (filters and assistant raised)

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.
**Build galleries only. Do not implement any option** -- the user picks.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use theme tokens for colour. Never hardcode a hex value.
- Keep all user-facing copy in `src/i18n/en.ts` when you wire the winner later.
- Write `--`. Never a unicode em dash.

## The ask

The filters and the assistant sit too low and feel bolted on. The user wants
them raised into an **integrated, polished header and navigation** -- one piece
of chrome, not a stack of unrelated bars.

Today the top of the page is: brand + nav + theme toggle, then a zone context
line, then a zone selector, then a hero, then date + search, then method/month
filters far below, and the assistant elsewhere again. That is five separate
bands before the content.

## Design on top of the chosen base

The user chose **Timeline + rail** (`design-refs/home-options/DECISION.md`).
These are header options for that layout, not replacements for it. The
half-month timeline stays the hero.

Produce **three structurally distinct** header/nav architectures. Vary how these
five compose into the top chrome -- if recolouring one produces another, it is
one option:

1. primary nav (Home / Year grid / About / Contact)
2. zone (selector plus the context line: elevation, county, frost dates)
3. crop search (with its autocomplete popup)
4. method and month filters
5. the assistant entry point

Directions worth exploring -- pick three that genuinely differ, these are
prompts not a menu: a single command-bar row where search owns the centre and
filters collapse into it; a two-tier header with brand+nav above and a
context/filter strip below that sticks on scroll; a compact header with an
expandable filter drawer and the assistant as a persistent docked panel; a
sidebar-led shell on desktop that collapses to a top bar on mobile.

## Constraints that must survive — state the measured value per option

- Crop search **above the fold** at 375 and 1280.
- Brand mark **>= 48px** at 1280 (currently 96px).
- **Zero truncation** at 375 -- no ellipsis, wrap or shorten instead.
- Every interactive control **>= 44px**.
- **The header must not eat the hero.** State, per option, the header height at
  375 and 1280 and how much vertical space is left for the timeline above the
  fold. A beautifully integrated header that pushes the timeline off-screen has
  failed the layout it serves.
- Both themes, and the mark must carry no plate on dark.

## Output

Four frames per option -- dark and light, at 375 and 1280 -- into
`design-refs/header-options/`, assembled as
`design-refs/header-options/gallery.html`: multi-column, one column per option,
dark and light stacked, numbered, dark page background, large frames.

`design-refs/header-options/DECISION.md` with a one-line statement of how the
three differ **structurally**, the separable pieces for a mix, and the Chosen
section **left blank**.

Use real data in the frames -- Cave Creek's real frost dates are Feb 20 / Dec 6
and its elevation 2,529 ft. The previous option frames hardcoded superseded
values and nearly carried them into the build.

## Definition of done

- Twelve frames exist and the gallery opens.
- Per option: header height at 375 and 1280, search input y, brand mark height,
  truncated element count at 375.
- A one-line honest read of what each option costs, not just what it gives.
- `DECISION.md` present with the Chosen section blank.

Do not implement. Stop at the gallery.
