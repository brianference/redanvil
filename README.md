# RedAnvil

**Forge a full app from one prompt — behind a real quality gate.**

RedAnvil is a system where Claude Code orchestrates an autonomous build loop: **Grok Build writes the code, Claude does QA and management, and a judge scores the result against a fixed rubric** until it clears a threshold (default 90) or a max-iteration cap. It also ships a public **app-builder** (turn a prompt into a downloadable PRD) and a **dashboard** (read-only view of build runs).

## Live

- App builder — https://redanvil.pages.dev
- Dashboard — https://redanvil-dashboard.pages.dev

## What it does

- **App builder** — describe an app, answer a short clarifying-questions wizard, and get a complete PRD (features with acceptance criteria, a data model, the enforced tech stack, a test plan, an effort estimate, and a ready-to-paste build prompt). Download it as markdown, save it to the site, or hand it to a coding agent.
- **Build loop** — a local orchestrator drives Grok Build to implement a spec, scores the result against the rubric, feeds failures back, and repeats. The score is the only signal that counts; Grok's self-report is never trusted.
- **Dashboard** — shows each run's slug, score, pass/fail, iterations, and deploy URL, read live from the results feed.

## How the loop works

1. **Claude** writes the spec and delegates it to **Grok Build** (bounded, isolated, no deploy authority).
2. **Grok** codes it.
3. **Claude** reviews the diff, runs the gate — `tsc` / eslint / tests / build, a runtime-parity check (`wrangler pages dev` + a live endpoint), plus a real visual review at 375 / 768 / 1280 — and computes a 0-100 score.
4. Below threshold → feed the failures back and iterate. At or above → deploy and verify by asset-hash.

Everything runs inline with a no-stall protocol: every Grok call and gate check goes through a bounded, killable runner, so a wedged subprocess can never hang the loop.

## The quality gate

- **Tier-1 deterministic (blockers):** strict typing, no `any`, tests present + passing, build succeeds, secret scan, no committed binaries, env ignored.
- **Tier-2 capped judge (≤ 30% of tier-2 weight):** concision, single-purpose modules, componentization, fail-closed UI, safe copy — scored with evidence, never rubber-stamped.
- **Rule applicability:** lanes that don't apply to an app (e.g. CI for an app with no workflows) are excluded from the score.
- **Design gate:** a global hook fires on every deploy and requires a real rendered-page visual review before anything is called done — design rules are verified from screenshots, not code.

`redanvil gate <app> --threshold 90` runs it and exits non-zero below the bar.

## Tech stack

Generated apps and the two web surfaces run on **Cloudflare Pages + Pages Functions + D1**, with **Web Crypto** (PBKDF2 + HMAC-SHA256) for auth — no Express, bcrypt, jsonwebtoken, better-sqlite3, or Node-only globals. The orchestrator is a strict-TypeScript CLI (Node 20+, Zod, Vitest).

## Repo layout

```
orchestrator/     the loop, scoring gate, bounded runner, Grok harness, CLI  (redanvil)
rules/            the enforced corpus: base-15, rubric lanes, per-app pack, loop-gate
prompts/          orchestrator / Grok-coder / judge system prompts
design-system/    tokens, mobile-design-rules, screen-patterns, checklist
app-builder/      the prompt-to-PRD app (Cloudflare Pages + D1)
dashboard/        read-only run viewer (Cloudflare Pages)
results/          per-run scores + the dashboard feed
docs/superpowers/ design specs, plans, and simulation notes
```

## Develop

```bash
npm install          # orchestrator workspace
npm run typecheck && npm run lint && npm test
npm -w @redanvil/orchestrator run dev -- rubric      # print the rubric
npm -w @redanvil/orchestrator run dev -- gate <dir>  # run the gate on an app
```

Each app builds and deploys on its own:

```bash
cd app-builder && npm ci && npm run build
npx wrangler pages deploy ./dist --project-name=redanvil
```

CI (GitHub Actions) typechecks, tests, and builds everything on every push.

## Status

v1.0.0 — the orchestrator engine, scoring gate, scaffolder, and both live apps are shipped and verified. Ongoing: an automated visual/UAT judge subagent, and driving the app-builder to a full 90 on the complete rubric.

Built with Claude Code + Grok Build.
