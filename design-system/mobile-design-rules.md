# Mobile design rules (living)

Version: 1.6 · Last improved: 2026-07-22  
Source of truth for Grok Build mobile UX. Update via continuous improvement protocol after each design run.

---

## R0 — How to use these rules

1. Load this file before implementing any mobile screen.
2. Treat **must** rules as blocking; **should** as strong default; **prefer** as taste.
3. When a rule fails in practice, log it in `IMPROVEMENTS.md` and patch this file in the same session if the user accepted the design.

---

## R1 — Touch and targets

| ID | Rule | Level |
|----|------|-------|
| R1.1 | Primary tap targets **≥ 44×44 pt** (iOS) / **48×48 dp** (Material) | must |
| R1.2 | Spacing between adjacent tappable controls **≥ 8 pt** | must |
| R1.3 | Destructive actions require confirmation or undo; never single-tap permanent delete in primary path | must |
| R1.4 | Prefer thumb-zone primary CTAs (bottom or sticky bottom) for one-handed flows | should |
| R1.5 | Icon-only buttons need `aria-label` / accessibilityLabel | must |

## R2 — Layout and safe areas

| ID | Rule | Level |
|----|------|-------|
| R2.1 | Respect safe areas: top notch/status, bottom home indicator, landscape insets | must |
| R2.2 | Content not trapped under fixed header/tab bar; use padding/scroll inset | must |
| R2.3 | Single primary column on phone; multi-column only at tablet breakpoints | must |
| R2.4 | Horizontal scroll regions must show affordance (peek of next card, page dots) | should |
| R2.5 | Avoid nested vertical scroll without clear ownership (one main scroller) | should |
| R2.6 | Max content width for readable text ~ **65–75 ch** on large phones/tablets | prefer |
| R2.7 | Zero horizontal overflow at 375px (body has no h-scroll; content fits) | must |

## R3 — Typography and hierarchy

| ID | Rule | Level |
|----|------|-------|
| R3.1 | Body text **≥ 16 px** on mobile for primary content | must |
| R3.2 | One clear H1 equivalent per screen; don’t compete titles | must |
| R3.3 | Line height ~ **1.35–1.5** for body; tighter for large display titles | should |
| R3.4 | Truncate secondary metadata; never truncate primary action labels | should |
| R3.5 | Support Dynamic Type / system font scaling without clipping | should |

## R4 — Color, contrast, state

| ID | Rule | Level |
|----|------|-------|
| R4.1 | Text/icon contrast **≥ 4.5:1** (AA) for body; large text ≥ 3:1 | must |
| R4.2 | Never use color as the only state signal (pair with icon/text/weight) | must |
| R4.3 | Disabled controls look disabled and are not focus-trapping | must |
| R4.4 | Error, success, warning share consistent semantic tokens | should |
| R4.5 | Dark mode: don’t invert blindly; use elevation surfaces | should |
| R4.6 | Light AND dark mode with a visible theme toggle; colors from per-theme semantic tokens; persist choice | must |

## R5 — Navigation and structure

| ID | Rule | Level |
|----|------|-------|
| R5.1 | Max **5** primary tab destinations; more belongs in “More” or IA restructure | should |
| R5.2 | Back always returns to previous logical place; no dead-end traps | must |
| R5.3 | Deep screens show context (title, breadcrumb, or parent name) | should |
| R5.4 | Tab bar labels short (1–2 words); icons recognizable at 24–28 pt | should |
| R5.5 | Modal vs full-screen push: modals for short tasks; push for hierarchical content | prefer |
| R5.6 | Premium sticky nav: brand + primary links with hover/active states (not bare text links); overflow in a menu | must |
| R5.7 | Breadcrumbs on inner/detail pages | should |

## R6 — Forms and input

| ID | Rule | Level |
|----|------|-------|
| R6.1 | Correct keyboard type (email, numeric, tel) and autofill tokens | must |
| R6.2 | Labels visible (not placeholder-only) | must |
| R6.3 | Inline validation after blur or submit; don’t yell mid-keystroke unless format-help | should |
| R6.4 | Submit sticky or always reachable without losing field focus awkwardly | should |
| R6.5 | Password: show/hide toggle; never SMS OTP as only recovery if avoidable | prefer |

## R7 — Feedback and loading

| ID | Rule | Level |
|----|------|-------|
| R7.1 | Every primary action has a loading or progress state within **100 ms** of tap | must |
| R7.2 | Skeletons or purposeful placeholders for content &gt; ~300 ms | should |
| R7.3 | Empty states: explain + one clear next action | must |
| R7.4 | Errors: human message + recovery action; log codes separately | must |
| R7.5 | Success: brief confirmation; don’t block with modal unless irreversible | should |

## R8 — Performance and motion

| ID | Rule | Level |
|----|------|-------|
| R8.1 | Prefer list virtualization for long feeds | should |
| R8.2 | Images: sized containers, lazy load offscreen, avoid layout shift | must |
| R8.3 | Motion optional: respect `prefers-reduced-motion` | must |
| R8.4 | Transitions &lt; ~300 ms for nav; no decorative delay on critical path | should |

## R9 — Content and trust

| ID | Rule | Level |
|----|------|-------|
| R9.1 | Primary CTA verb matches outcome (“Save”, “Send”, “Continue”) | must |
| R9.2 | No dark patterns: fake urgency, hidden costs, disguised ads | must |
| R9.3 | Permissions asked in context with reason, not on cold launch dump | should |
| R9.4 | Fail-closed copy for blocked/unknown states (no fake “all good”) | must |

## R10 — Component structure defaults

| ID | Rule | Level |
|----|------|-------|
| R10.1 | Screen = shell (safe area + chrome) + regions + feature components | must |
| R10.2 | Shared tokens: spacing scale (4/8), radius, type steps, semantic colors | must |
| R10.3 | Variants share props/API; differ in layout density and emphasis | should |
| R10.4 | Sticky bottom CTA bar includes safe-area padding | must |
| R10.5 | Lists: row min height for touch; swipe actions secondary, not only path | should |
| R10.6 | Brand mark in header/nav is a small optimized asset (WebP/SVG, ~<=60KB), never the hero/banner image | must |
| R10.7 | Favicon and app icon derive from the same mark as the header logo | should |
| R10.8 | Decide the target **before** structure: responsive web-mobile (React + TS + Tailwind) or true native (**Expo / React Native**). These rules apply to both, but the implementation differs and the choice is not reversible cheaply | must |

### R10.8a — Expo / React Native translations

The rules are written in web terms by default. On Expo/RN they still hold, but the
mechanism changes. Do not skip a rule because its web mechanism is absent.

| Rule | Web mechanism | Expo / React Native mechanism |
|------|---------------|-------------------------------|
| R2.1 safe areas | `env(safe-area-inset-*)` | `react-native-safe-area-context` (`useSafeAreaInsets`) — not a fixed 44px guess |
| R2.2 chrome collision | scroll padding | `contentInset` / `contentContainerStyle` padding |
| R3.1 16px body | CSS `px` | RN unitless density-independent points; still >= 16 |
| R3.5 dynamic type | `rem` + browser zoom | `allowFontScaling` (default true) — never disable it to protect a layout |
| R4.1 contrast AA | CSS color tokens | same tokens via a theme object; verify against the rendered screen |
| R4.6 light/dark | `prefers-color-scheme` + `data-theme` | `useColorScheme()` + Appearance API; persist the override |
| R8.1 virtualization | windowing lib | `FlatList`/`FlashList` — never `.map()` a long feed into a `ScrollView` |
| R8.3 reduced motion | `prefers-reduced-motion` | `AccessibilityInfo.isReduceMotionEnabled()` |
| R1.5 icon labels | `aria-label` | `accessibilityLabel` + `accessibilityRole` |
| R7.x states | DOM conditional render | same, but loading needs an explicit `ActivityIndicator`, not a blank frame |

Web-only rules that do **not** apply natively: R10.7 favicon, R2.7 horizontal
overflow at 375 (RN has no document scroll), and the SEO rules in R13.8. Mark them
`notApplicable` explicitly rather than quietly passing them.

## R11 — Inspiration hygiene

| ID | Rule | Level |
|----|------|-------|
| R11.1 | Use refs for structure/density/tone; never clone brand or 1:1 layout | must |
| R11.2 | Prefer real product UI for structure; concept art only for mood | should |
| R11.3 | Cite sources in `design-refs/.../SOURCES.md` when inspo was used | must |
| R11.4 | Do not scrape paywalled design libraries | must |
| R11.5 | Treat Mobbin `/discover/*` as **login-gated** unless session exists; use **@mobbin X posts** for public app-name drops and collages, not bulk site harvest | must |
| R11.6 | In a multi-repo/multi-app portfolio, pick the **primary mobile product and its one primary screen** before gathering refs (or ask once); map other products in as content/context cards, not separate homes. A vague "all products" home yields refs that match nothing and a screen no repo can adopt | must |

## R12 — Variant checklist (A/B/C)

Before shipping variants, each must answer:

- [ ] Primary task completable in ≤ 3 taps from this screen’s entry
- [ ] One primary CTA visual weight
- [ ] Empty + loading + error considered (even if stubbed)
- [ ] Thumb reach for primary action
- [ ] Visually distinct from other variants (not only recolor)

## R13 — Premium web-app shell (must; scored fail-closed)

For any web app RedAnvil ships. Each maps to a `visual`-method rubric rule that is
**fail-closed** — with no recorded visual-review verdict it FAILS, so these can
never silently auto-pass from a code-clean diff (the exact hole that shipped a
barebones site). Verified on the rendered page at 375 / 768 / 1280 in both themes.

| ID | Rule | Level | Rubric rule |
|----|------|-------|-------------|
| R13.1 | Light AND dark mode with a visible toggle; every color from a semantic token per theme; a **stated brand default** (system-follow is one option, not the only one); a saved choice always wins and persists; both pass AA | must | fe-light-dark |
| R13.2 | Polished sticky top nav with brand mark and primary links that have clear hover AND active states (not bare text); overflow in a menu; breadcrumbs on inner/detail pages | must | fe-premium-nav |
| R13.3 | Home, About, Terms, Privacy, Contact all present and reachable from the shared nav/footer | must | fe-required-pages |
| R13.4 | No "made with" / "built with" attribution text anywhere in the UI | must | fe-no-attribution |
| R13.5 | No overlapping or clipped text at 375px; verified at 375 / 768 / 1280 | must | fe-responsive-375 |
| R13.6 | The stated core feature works end-to-end and produces usable output; input-only dead-ends fail | must | fe-product-completeness |
| R13.7 | A visual review was actually performed and recorded — screenshots at all three breakpoints in both themes, zero console errors | must | fe-visual-review-recorded |
| R13.8 | Per-route title/description, OG tags, real OG image, sitemap, robots.txt, JSON-LD, semantic headings | should | fe-seo-og |
| R13.9 | Sibling apps in one system cross-link in a shared header/footer | should | fe-cross-link |

CSS-specificity trap (recurring): a React inline `style={{ display: ... }}` beats a
class rule, so a `.menu-btn { display: none }` hide-on-desktop toggle leaks unless
the class (not inline style) owns `display` with a matching `!important` media query.
Only a real visual review catches it — it renders fine in code review and passes tests.

---

## Screen-type quick rules

### Home / feed
- Pull-to-refresh if remote data
- First contentful row above fold without hunting
- Filters accessible without burying in overflow only

### Agent / AI companion home
- **Default direction = B+C:** warm greeting (consumer B) + composer-first activity home (hybrid C). Do not default to pure dense ops (A) unless user asks for power-user density.
- Composer or primary “ask” action reachable without hunting (thumb zone)
- Greeting before composer (one short value line); avoid cold “metrics only” homes for companion apps
- Show **security/vault** status as text + icon, not color alone (R4.2)
- Surface open tasks/unread as glanceable counts, not only buried lists
- Grounded product contexts (other apps/tools) appear as activity rows, not a second tab bar
- Incomplete vault/security setup gets a dedicated card with a verb CTA

### Onboarding
- Progress indicator if multi-step
- Skip only if product allows incomplete setup
- Permission screens: benefit first, then system dialog

### Auth
- Social vs email: don’t force both; offer clear path
- Error on wrong password: don’t reveal which field if security requires, but be consistent

### Paywall
- Price, period, cancel path visible before purchase CTA
- Restore purchases where store requires

### Settings
- Group by task; destructive zone separated
- Toggles immediate effect or explicit Save — pick one pattern per app

---

## Anti-patterns (reject in review)

- Tiny gray links as only destructive or legal path
- Infinite carousel with no pause/control
- Full-screen takeover ads mid-task
- Placeholder-only forms
- Bottom sheets that cover CTA with no drag handle / dismiss
- Horizontal pager without index
- Status communicated only by red/green color

## R14 — Layout belongs in CSS, never in an inline style (blocker)

An inline `style` beats a class rule, so any layout property set inline is
invisible to every media query. This cost four rounds of rework in one session:

- `ComposerChat` had `display: flex` inline. The desktop two-column grid was
  declared, deployed, and did nothing — the composer stayed stacked under the
  thread.
- `contentColumnStyle` had `maxWidth: '46rem'` inline. The template gallery and
  PRD result sat in ~55% of a 1920 desktop while the shell around them was 94%.
- Earlier, an inline `display` silently broke a responsive logo swap.

**Rule:** `display`, `maxWidth`, `gridTemplateColumns`, `flexDirection` and
`position` go in a CSS class. Inline style is for values that genuinely vary per
instance (a computed height, a per-item colour). If an element has a className
AND a layout property inline, that is the bug.

## R15 — A width promise must be a percentage, not a rem cap (blocker)

`min(90rem, 100%)` measured 90% of a 1600 viewport and **75%** of a 1920 one. A
fixed cap does not hold a percentage promise; it just stops scaling. State the
requirement as the outcome ("at least 80% of the viewport") and use a percentage
on the container.

Protect the line measure with **column counts**, never by starving the
container: prose goes 1 → 2 columns at 1024 and 3 at 1600; the builder chat
splits into conversation + sticky composer at 1024; archetype cards go 2 → 3 →
4. Enforced by `fe-desktop-width`, measured at two widths because one width
cannot distinguish a percentage from a cap.

## R16 — Nav and brand must share one material (major)

Primary nav links carry the same treatment as the brand lockup: a brushed-metal
vertical gradient with a lit top edge on hover, and the brand's accent glow on
the active item.

The link **text** keeps a solid token colour. Gradient-clipped text renders as
`color: transparent`, which axe cannot evaluate, and `fe-a11y-contrast` is a
blocker — so the metal lives in the surface and the bevel, not the letterforms.

## R17 — A logo is two assets, and neither is a JPEG (blocker)

Dark-designed brand art (silver wordmark, accent glow) reads on near-black and
washes out on white. Ship `logo-lockup.png` and `logo-lockup-dark.png`, swapped
by a CSS class keyed off `data-theme` — never an inline `display`, per R13. Mark
one image `aria-hidden` and put the accessible name on the wrapping link, or axe
reports a serious link-name violation when only the hidden image is visible.

A JPEG cannot carry alpha. Grok Imagine renders its transparency checkerboard
into the pixels, so a "transparent" JPEG export ships a grey grid. Recover real
alpha by asking for the SAME artwork over two backgrounds (checkerboard and
solid black) and solving `a = 1 - delta/B`; see the `grok-imagine-logo` skill.
Verify with invariants before trusting the result, then render it on both themes
at real size and at 32px and 24px.

## R18 — Footer height comes out of the column count (major)

Measured at 375, a single-column footer was 828px — **35% of the whole page** —
for nine short links. Touch targets must stay ≥44px, so the height cannot come
out of the tap area: flow the link groups into balanced columns instead. Three
groups in a 2-column grid orphans the third beside dead space; use multi-column
so the heights balance.

## R19 — A raster lockup has a minimum legible size (major)

A lockup with the tagline baked into the pixels does not degrade gracefully. The
440x149 brand lockup at a 48px footer height renders its tagline about five
pixels tall — a grey smear, not type. Measured checks do not see this: contrast
passes, no rule names a minimum image size, and the DOM is correct.

Set the footer height from the asset's own proportions, not from a round number
that looks reasonable in code. Here that is 80px against a 112px header. If a
mark needs to go smaller than its tagline can survive, it needs a separate
mark-only asset — do not scale the lockup and hope.

Corollary: any rule that can only be judged from a rendered page needs a
screenshot artifact, produced by a script rather than ad hoc, or "the visual
review passed" is an unverifiable claim.

## R20 — Every router needs a catch-all route (blocker)

Without one, an unmatched URL renders an **empty document** — no header, no
heading, no way back — and it is invisible in testing because nothing links to a
bad URL. It surfaced here only when a design audit was pointed at a route that
turned out not to exist.

Ship a `NotFound` page inside the normal shell (header, footer, an h1, a link
home) and point the route audit at a deliberately bad path so the empty-document
failure cannot come back.

A 404's "back to home" control is a standalone CTA, not a link inside a
sentence, so the WCAG 2.5.8 inline-text exemption does not apply to it: it needs
a real 44px target. The reverse error matters too — enforcing 44px on inline
prose links produces a confident FAIL against correct markup.

## R21 — Constraints are not a design (blocker for generated apps)

A rule pack that says "tokens only, AA contrast, 16px body floor, 44px targets,
sticky header, five required routes" is necessary and **identical for every
app**. An agent handed only constraints satisfies all of them and ships the same
centred column under a sticky header every single time. The rules are working;
nothing is asking for a different product.

Every generated app must therefore carry a **layout archetype** and a **visual
direction** alongside the constraints:

- The archetype must differ **structurally** — where navigation lives, how the
  primary surface is divided, what the eye lands on first. Recolouring one
  archetype must not produce another. Split workbench, command canvas, timeline
  chronicle, metric board, guided flow, focus hero, kanban lanes, map + list.
- State what the app must **not** default to, by name. "Be creative" is not a
  specification; "do not build a card grid" is.
- Specify how the archetype resolves at 375. If the mobile answer is "the same
  thing but narrower", the archetype has not been applied.
- Pick the direction from the app's own inputs, deterministically. A spec that
  changes when you regenerate it is not a spec.
- Build the token set first, then the shell, then screens. Choosing colours
  while writing components is how everything drifts back to default.
- Source **three** real references before writing components, and take one idea
  from each rather than copying a layout wholesale.

A reference implementation of the rules is not a template. Reusing its shell,
palette or component structure is the specific failure this rule prevents.

## R22 — Desktop width is measured on painted content, never on a container (blocker)

Every route's painted content must occupy **at least 80% of the viewport at 1440
and 1920**, on every web app, generated or not.

Measure what is **drawn**: text via its own client rects, plus anything painting
a background, border or shadow. Exclude header and footer — they legitimately
span full width and will mask a narrow body beneath them.

Never measure a container box. A `<div>` or an `<h1>` is 100% of its parent by
default, so `main.getBoundingClientRect().width` reported **93%** for a page
whose content sat in the left third of a 1920 screen. Four pages across two apps
were narrow for weeks behind that number, and only a user looking at the site
caught it.

Causes, in the order they actually occur:

1. **An inline `maxWidth` in a JS style object.** An inline style beats a class,
   so no media query can lift it. This shipped four times here — template
   gallery, saved PRD, wizard form, saved page — and once more in each app's
   footer and page subtitle. Enforced statically by `fe-no-inline-width`.
   (`100%` caps nothing. A fixed `width` on an icon, badge or 1px divider is
   fine. `minWidth: 0` is the flex/grid shrink idiom and is fine.)
2. **A rem cap where a percentage was promised.** `min(90rem, 100%)` measures
   90% at 1600 and 75% at 1920. A rem cap cannot hold a percentage promise.
3. **A column count that ignores the content.** A fixed `column-count: 3` on a
   page with two sections leaves an empty third column — 60% of the screen. Use
   a `:has()` quantity query so a column is only added once there is something
   to put in it.

Protect the line measure with column counts, never by starving the container.

## R23 — Look at what shipped in this category before designing (blocker for a new app UI)

R21 says constraints are not a design. R23 says where the design comes from:
**the real App Store, searched by the app's own domain keywords, before a single
component is written.**

An agent that designs from the rule pack alone converges on the same centred
column every time, because the rule pack is identical for every app. An agent
that has first looked at sixteen shipping products in the same category has seen
sixteen answers to the same problem, and can take one idea from each.

### The step (mandatory, and it produces an artifact)

```bash
node ~/.claude/skills/design-inspo-x/scripts/appstore_refs.mjs \
  --terms "<domain keywords, comma separated>" \
  --out design-refs/<slug> --limit 6 --shots 4
```

- Terms come from the PRD's own domain nouns and verbs — a flight app searches
  `flights, airline, flight tracker, cheap flights`, not `travel app`.
- The script hits the public iTunes Search API (no key, documented, and Apple
  already serves these screenshots publicly on every store page). It ranks by
  **rating count**, because a design that survived millions of users is evidence
  and a concept shot is not, and it drops Games.
- It writes `SOURCES.md` with the app names, genres, rating counts and store
  URLs. **A run with no `SOURCES.md` did not do this step**, and the design work
  that follows is unevidenced.
- It exits non-zero when nothing matched, so a build step can depend on it and
  fail closed instead of quietly skipping the research.

### What to do with the refs

- **Name the component you are borrowing, per reference.** "KAYAK: a colour-coded
  fare calendar so the cheapest date is visible before you pick one." "Flighty:
  the duration as an oversized numeral in the left gutter." "Singapore Airlines:
  the cabin-window mask as the photo frame." Vague admiration is not an input.
- **Take ONE idea from each, and change it.** Borrow the *mechanism*, not the
  execution: the same idea in a different shape, density, or position. If a
  reviewer can name the app you copied, you copied.
- **Never take** a brand mark, wordmark, palette, mascot, or an entire screen
  layout. Those are the parts that belong to someone else.
- Feed the refs into the exploration, not the polish. Choosing a component after
  the shell is built means it gets bolted on.

### Failure this rule exists to prevent

QuickFlight shipped a correct, accessible, gate-passing flight search that the
user rejected on sight: *"the site design isn't unique enough, it looks like all
the other sites."* Every measurable rule passed. Nothing had asked what a flight
app is supposed to feel like, and no shipping flight app had been looked at.

## R24 — The design is chosen by the user from options, never by the builder (blocker)

R21 says constraints are not a design. R23 says where design ideas come from.
R24 says **who decides**, because getting that wrong wasted an entire build.

QuickFlight was specified with one archetype and one visual direction, built
faithfully, gated to 100/100, and deployed. The user's first reaction was *"the
site design isn't unique enough."* Nothing was wrong with the execution. The
error was that a single direction went straight to implementation without anyone
choosing it.

### The gate

For a new app UI, **no implementation begins until the user has picked from a
rendered gallery.** In order:

1. **R23 App Store intake** — real refs, `SOURCES.md` on disk.
2. **Generate options** — minimum 3, target 5–10 for a new product. Claude and
   Grok both produce sets; Grok's are the default starting point.
3. **Every option is structurally distinct.** Different archetype, not a recolour.
   If option B can be turned into option C by editing a palette, it is one option.
4. **Every option renders dark AND light** in the same file, at 375.
5. **Build a gallery, open the folder AND the gallery.** Never describe options in
   prose and never ship one to production to "show" it.
6. **The user picks — including a mix** ("stack of 4, calendar of 1, colours of
   2"). Expect the answer to be a blend and design the options so blending works.
7. Only then implement.

### What is the user's call, not the builder's

Do not decide these silently. They are cheap to ask about inside a gallery and
expensive to unwind after a build:

- **Accent colour.** QuickFlight shipped orange; the user's response was "do not
  use orange as the colours."
- **Default theme.** Dark-by-default was assumed twice and reversed twice.
- **Which view is the landing view** when a product has more than one (map vs
  calendar vs list).
- **The logo**, chosen from a reviewed set — see R10.6.

### Generated assets belong in this phase

Logos, backgrounds, icon sets and textures are generated **before** the build,
reviewed by eye, and presented in the same gallery — never iterated live against
a deployed site (R10.6). **Say honestly which ones are bad.** In this session two
of five logos and five of sixteen icons were not usable; marking them as such is
part of the deliverable, not a failure to hide.

### Failure this rule exists to prevent

A design nobody chose, implemented perfectly, deployed, gated, and thrown away.
The rules were all green the entire time.
