# Simulation: prompt → PRD → scaffold → build → gate

Run on 2026-07-25 against production, end to end, because nobody had ever done it.
Every prior check exercised one link in the chain. This walked the whole thing with a real
prompt and tried to actually build the result.

**Prompt used:** _"a shift scheduling app for small teams with swap requests and coverage
alerts"_ — dashboard, auth, 2 entities.

## What worked

| step                                                                       | result                                                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /api/submit` on production                                           | 200, slug `a-shift-scheduling-app-for-small-teams-with-swap`                                             |
| PRD generation                                                             | §7.3a chose **Split workbench + Editorial** — a shell and visual language RedAnvil's own apps do not use |
| `scaffold` from the job file                                               | 29 files                                                                                                 |
| `npm install` / `tsc` / `eslint` / `vitest` / `build` in the generated app | all clean, first try                                                                                     |
| Static rules (`u-typing-*`, `u-sec-*`, `hyg-*`, `fe-no-inline-width`, …)   | 25 evaluated, all pass                                                                                   |

The generated app compiles, lints, tests and builds without a single edit. That part of the
promise holds.

## Bugs found

### 1. The scaffold cited design guidance it did not ship — FIXED

`CLAUDE.md` told the builder to follow `design-system/mobile-design-rules.md` and
`screen-patterns.md`. The scaffold contained neither — only `tokens.json`. Every generated app
pointed at two paths that did not exist, so the design rules were simultaneously mandatory and
unavailable.

Both files are copied in now, and a test parses the paths `CLAUDE.md` actually cites and asserts
each one exists, so the assertion tracks the rule pack instead of a hard-coded list.

### 2. A scaffolded app was not a git repository — FIXED

`hyg-env-ignored` is a **security blocker**, implemented as `git check-ignore .env`. Outside a
repository that exits 128, so the rule failed. The scaffold's `.gitignore` was correct the whole
time; the app just wasn't a repo yet.

Every generated app therefore failed a security blocker on day one, for a reason that had
nothing to do with its security. The scaffold now runs `git init` plus one commit (best effort,
and it reports whether that succeeded).

### 3. The desktop-width rules reached only half the builders — FIXED

The 80%-of-viewport requirement, the `maxWidth` ban and the §7.3a design-direction pointer were
added to the **PRD**. They were never added to `rules/per-app-pack.md`, which is what becomes
each app's `CLAUDE.md`.

So an agent given the downloaded PRD saw them and an agent starting from the scaffold did not.
Two guidance channels, silently diverged. The pack carries them now.

## Learnings

**A scaffolded app cannot pass the gate until it is deployed.** 11 of the remaining blockers are
`visual` rules — contrast, light/dark, premium nav, required pages, responsive-375, desktop
width, product completeness. They need a rendered page and a recorded verdict, by design. A
fresh scaffold scoring 0/100 is the gate working, not the scaffold failing: the score is about a
shipped product, and nothing has shipped yet.

Expect this shape on a live run:

```
scaffold          -> 25/48 rules measurable, all static rules pass, score 0
deploy            -> visual rules become measurable
measure + record  -> score climbs to the real number
```

**Checking one link never finds a chain break.** `gate_scaffold.mjs` already ran the static
rules against a scaffold in CI and was green throughout — because it never installed the app,
never read `CLAUDE.md`, and never ran a git-backed rule. All three bugs sat in the gaps between
checks that were individually passing.

**Two channels for the same guidance will diverge.** The PRD and the rule pack both tell a
builder how to build. Anything added to one and not the other reaches half the builds. Adding a
rule now means asking which channel carries it — and preferably making one derive from the
other.

## Still true after the fixes

A generated app is a _correct skeleton_, not a finished product: it has the required pages, the
theme, Web Crypto auth, a D1 config and a health endpoint. The features in the PRD — shift
swaps, coverage alerts — are the build work the PRD describes; the scaffold does not attempt
them. The gate's visual blockers are what stop a skeleton being mistaken for a product.
