# Reuse scan — sushi-finder

Run 2026-08-08 by `roles/reuse.mjs` against the public
GitHub search API, before any feature was written. Required by the `reuse`
process step; base rule 3 is use what exists before writing anything.

Search areas were selected from `docs/PRODUCT-BRIEF.md`, so the scan tracks what
is actually being built. Ranked by stars.

**The binding constraint:** the runtime is Cloudflare Pages Functions + D1.
Anything needing a long-running Node server, native modules or PostgreSQL cannot
be a dependency here regardless of quality. It can still be a reference
architecture, which is a different verdict and still useful.

## search + filtering UI

Query: `topic:search stars:>500`

| repo | stars | licence | verdict |
|---|---|---|---|
| [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) | 67110 | Unlicense | candidate — read before writing this capability |
| [TheAlgorithms/Java](https://github.com/TheAlgorithms/Java) | 66121 | MIT | candidate — read before writing this capability |
| [meilisearch/meilisearch](https://github.com/meilisearch/meilisearch) | 58903 | NOASSERTION | candidate — read before writing this capability |
| [sharkdp/fd](https://github.com/sharkdp/fd) | 44002 | Apache-2.0 | candidate — read before writing this capability |

## map + place discovery

Query: `topic:maps stars:>1000`

| repo | stars | licence | verdict |
|---|---|---|---|
| [Leaflet/Leaflet](https://github.com/Leaflet/Leaflet) | 45461 | BSD-2-Clause | candidate — read before writing this capability |
| [louis-e/arnis](https://github.com/louis-e/arnis) | 17318 | Apache-2.0 | candidate — read before writing this capability |
| [react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps) | 15982 | MIT | candidate — read before writing this capability |
| [organicmaps/organicmaps](https://github.com/organicmaps/organicmaps) | 15011 | NOASSERTION | candidate — read before writing this capability |

## booking / reservations

Query: `topic:scheduling stars:>500`

| repo | stars | licence | verdict |
|---|---|---|---|
| [spotify/luigi](https://github.com/spotify/luigi) | 18762 | Apache-2.0 | candidate — read before writing this capability |
| [Tonejs/Tone.js](https://github.com/Tonejs/Tone.js) | 14704 | MIT | candidate — read before writing this capability |
| [agronholm/apscheduler](https://github.com/agronholm/apscheduler) | 7596 | MIT | candidate — read before writing this capability |
| [quartznet/quartznet](https://github.com/quartznet/quartznet) | 7066 | Apache-2.0 | candidate — read before writing this capability |

## reviews + ratings

Query: `topic:rating stars:>200`

| repo | stars | licence | verdict |
|---|---|---|---|
| [recommenders-team/recommenders](https://github.com/recommenders-team/recommenders) | 21851 | MIT | candidate — read before writing this capability |
| [ng-bootstrap/ng-bootstrap](https://github.com/ng-bootstrap/ng-bootstrap) | 8232 | MIT | candidate — read before writing this capability |
| [wbotelhos/raty](https://github.com/wbotelhos/raty) | 2337 | MIT | candidate — read before writing this capability |
| [williamyyu/SimpleRatingBar](https://github.com/williamyyu/SimpleRatingBar) | 1370 | MIT | candidate — read before writing this capability |

## auth on edge runtimes

Query: `topic:authentication stars:>1000`

| repo | stars | licence | verdict |
|---|---|---|---|
| [pocketbase/pocketbase](https://github.com/pocketbase/pocketbase) | 60550 | MIT | candidate — read before writing this capability |
| [better-auth/better-auth](https://github.com/better-auth/better-auth) | 29489 | MIT | candidate — read before writing this capability |
| [authelia/authelia](https://github.com/authelia/authelia) | 28514 | Apache-2.0 | candidate — read before writing this capability |
| [nextauthjs/next-auth](https://github.com/nextauthjs/next-auth) | 28318 | ISC | candidate — read before writing this capability |

## Outcome

20 repositories examined across 5 capability areas. Every
candidate carries a licence and a verdict above.

Verdicts are assigned by a mechanical runtime test, not by preference: a project
naming PostgreSQL, Prisma, Express, Next.js or Docker cannot be a dependency on
Workers + D1. Candidates that survive that test must still be read before the
capability is written by hand.

**This scan does not authorise copying.** Anything adopted needs its LICENSE file
read directly and recorded here before code or schema is reused.
