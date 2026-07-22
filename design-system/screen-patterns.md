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

| Date | Pattern | Why added |
|------|---------|-----------|
| 2026-07-21 | Bootstrap skeletons | Initial skill |
| 2026-07-21 | Agent companion home | OpenClaw real pass |
