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
| R13.1 | Light AND dark mode with a visible toggle; every color from a semantic token per theme; default follows system; choice persists; both pass AA | must | fe-light-dark |
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
