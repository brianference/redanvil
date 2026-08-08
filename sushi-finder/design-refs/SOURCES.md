# Design reference intake — sushi-finder

Captured 2026-08-08 by `roles/inspo.mjs` from the public
iTunes Search API, searching "sushi finder".

Ranked by rating count, because a design that survived millions of users is
evidence and a concept shot is not.

**Take ONE idea from each. Do not clone a layout, a palette, a brand mark or a
wordmark.** Screenshots stay local and gitignored; this file is the committed
record of where direction came from.

| app | genre | ratings | shots | store |
|---|---|---|---|---|
| Kura Sushi Rewards | Food & Drink | 10,633 | 4 | [store](https://apps.apple.com/us/app/kura-sushi-rewards/id1659628633?uo=4) |
| Sushi Diner – Fun Cooking Game | Games | 1,725 | 4 | [store](https://apps.apple.com/us/app/sushi-diner-fun-cooking-game/id1061528816?uo=4) |
| Sushi Shop, livraison de repas | Food & Drink | 226 | 6 | [store](https://apps.apple.com/us/app/sushi-shop-livraison-de-repas/id549837264?uo=4) |
| Sushi Master Chef | Games | 215 | 4 | [store](https://apps.apple.com/us/app/sushi-master-chef/id735753993?uo=4) |
| Sushi Sort: Yummy Puzzle | Games | 153 | 6 | [store](https://apps.apple.com/us/app/sushi-sort-yummy-puzzle/id6757820026?uo=4) |
| Sushi Land: ASMR | Games | 116 | 4 | [store](https://apps.apple.com/us/app/sushi-land-asmr/id6745321725?uo=4) |
| Sushi Score - Count your sushi | Food & Drink | 46 | 3 | [store](https://apps.apple.com/us/app/sushi-score-count-your-sushi/id6741171608?uo=4) |
| Amberjack — Rare Sushi Finds | Food & Drink | 2 | 6 | [store](https://apps.apple.com/us/app/amberjack-rare-sushi-finds/id6761350335?uo=4) |

## How to use this

Study what the top few do with the fold, the result unit, and how they show
price, availability and trust. Then build something structurally different that
borrows the *insight*, not the layout.

## Ideas taken (palette rebuild 2026-08-07)

One insight per source. Applied as component treatment, not as a clone of layout,
palette, or mark. Recorded so the gallery is accountable to real shipping apps.

| source | idea taken (insight only) | where it landed |
|---|---|---|
| **Kura Sushi Rewards** (10,633) | Availability / walk-in status is first-class on the result unit — not buried under meta | **palette-01 Night Counter**: elevated photo cards with a green walk-in badge as the primary secondary line under the plate |
| **Sushi Diner** (1,725) + **Sushi Master Chef** (215) | Ceremonial / badge energy around food (games store framing) without game chrome | **palette-05 Mon Crest**: circular mon-ring photo frame + dual-temperature indigo/coral chips |
| **Sushi Shop, livraison** (226) | Order/list competence — filters as a **segmented control**, dense rows, price visible at a glance | **palette-04 Harbor Mist**: segmented chips, 40px thumbs, price on the right of the title row |
| **Sushi Sort** (153) | Puzzle clarity: one accent, hard structure, no decorative chrome | Contributed to **palette-02 Ink Line** outline-chip + hard-border list discipline (with Sushi Score) |
| **Sushi Land: ASMR** (116) | Soft, sensory full-bleed food moments (not a utility grid) | Contributed to **palette-03 Omakase Paper** full-bleed stacked heroes |
| **Sushi Score** (46) | Sparse utilitarian chrome; count/status carries weight over decoration | **palette-02 Ink Line**: single-column list, Inter only, outline chips, hairline borders, no shadow |
| **Amberjack — Rare Sushi Finds** (2) | Editorial rare-find framing — browse feels like a guide, not a delivery grid | **palette-03 Omakase Paper**: stacked magazine cards, underline chips, large serif display, generous air |

**Not taken from any of them:** wordmarks, brand colours, exact card skeletons, or store screenshot compositions. Food plates in the mock are original Grok Imagine product photography under `palettes/food/`.
