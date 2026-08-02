# Screen patterns (living)

Concrete layout recipes that complement `mobile-design-rules.md`.  
Add a pattern when the same structure wins across 2+ projects or strong X refs.

---

## Home / feed

```
[ Safe top ]
[ Optional sticky search / context ]
[ Primary list or card stack — main scroll ]
[ Optional FAB ]
[ Tab bar + safe bottom ]
```

Notes: first useful row above fold; pull-to-refresh if remote.

## Onboarding (multi-step)

```
[ Progress ]
[ Illustration / value prop ]
[ Short copy ]
[ Primary CTA ]
[ Secondary: Skip / Sign in ]
[ Safe bottom ]
```

## Auth

```
[ Logo / title ]
[ Fields with visible labels ]
[ Primary continue ]
[ Alt method ]
[ Legal microcopy ]
```

## Paywall

```
[ Benefit list ]
[ Plan picker ]
[ Price + period + cancel path ]
[ Primary subscribe ]
[ Restore ]
```

## Settings

```
[ Grouped lists ]
[ Navigation rows ]
[ Separated danger zone ]
```

## Detail

```
[ Collapsing or compact header ]
[ Body sections ]
[ Sticky action if purchase/edit ]
```

---

## Agent / AI companion home (default = B+C)

```
[ Safe top ]
[ Trust pills: Online / Protected + Vault chip ]
[ Warm greeting (B): Hey — {agent} is ready + one value line ]
[ Glance chips: unread · tasks ]
[ Composer (C): Ask {agent} + Send ]
[ Secondary: All chats · Open tasks ]
[ Activity (C): chats + tasks + cross-product context ]
[ Security checklist card if vault incomplete ]
[ Tab bar: Home · Chat · Tasks · Vault · More ]
```

Notes:

- **Chosen:** B+C for OpenClaw (see `design-refs/openclaw-mobile-home/OPENCLAW-HOME-BC.md`)
- Pure B = marketing/first-run only
- Pure C = acceptable if space is tight
- Dense metrics grid (A) = power-user toggle only

## Pattern log

| Date       | Pattern              | Why added          |
| ---------- | -------------------- | ------------------ |
| 2026-07-21 | Bootstrap skeletons  | Initial skill      |
| 2026-07-21 | Agent companion home | OpenClaw real pass |

## Timeline rail (time-window reference tools)

Chosen for az-planting-calendar 2026-08-02 over a focus hero and an image
gallery. Use when the product's core question is *"what applies during this
period"* -- planting windows, seasons, schedules, availability.

```
[ Safe top ]
[ Zone / context bar — full width ]
[ Sticky search ]
[ ─ Horizontal period strip: one cell per window, each with its COUNT ─ ]   <- hero
[ Rows for the selected period — secondary ]
[ Assistant: right rail (desktop) / block under the list (mobile) ]
```

Why it wins: the period model becomes a visible control instead of a hidden
filter, and the per-cell counts show the shape of the whole year before the
reader opens a single row. A focus hero answers only "now"; this answers "now,
and what comes next".

Notes: the strip is a real control, not decoration -- selecting a cell changes
the list. Never hardcode period boundaries or dates into the strip; read them
from the data, or the mockup's stale values ship (ours carried superseded frost
dates into three option frames).

## Card catalog (collections that grow)

Chosen for the RedAnvil examples page 2026-08-02 over a story stack and a
full-bleed hero.

```
[ Filter chips ]
[ Equal-weight cards in a grid ]
    card face = overlapping stacked device frames (desktop + mobile in one)
    under the face = title, stat chips, actions
    expanded = grouped "What it does" prose, closing with measured numbers
```

Why it wins: a story stack buries the second item and a full-bleed hero demotes
everything after the first. Equal cards keep every entry legible at the same
weight and the chrome scales as the set grows.

Notes: stacked device frames show both breakpoints without a strip that scrolls
away. The expanded body must be behaviour, not adjectives -- each bullet a
concrete capability, and a closing paragraph citing real gate numbers with the
date they were measured.
