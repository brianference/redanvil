# App-Forge design spec

Date: 2026-07-20
Status: approved (brainstorm), pending spec review
Owner: Brian

## 1. Purpose

Build a system where Claude Code (running on Brian's account) orchestrates an autonomous build loop: Grok Build writes code, Claude does QA and management, and a judge pass scores the result against a fixed rubric until a machine-checked score clears a threshold (default 90) or a max-iteration cap is hit.

The first app the system builds is an **app-builder**: from a simple prompt plus a short clarifying-questions wizard it emits a PRD, a token-cost estimate, a test design, an initial build prompt, and a scaffolding manifest. That output is the exact input the orchestrator loop consumes, so the app-builder feeds the loop and the system closes on itself.

Every app the system creates inherits the same coding rules, design system, and environment prompts, enforced (not advisory).

## 2. Feasibility and constraints (verified 2026-07-20)

- Grok CLI authenticates in headless mode via a cached token from `grok login` (browser, tied to Brian's Grok subscription) or `XAI_API_KEY`. Decision: use `grok login` — no API billing. Confirmed against https://docs.x.ai/build/cli/headless-scripting and https://docs.x.ai/build/overview.
- Grok CLI supports native Windows (PowerShell installer, `%USERPROFILE%\.grok\config.toml`). No WSL required.
- Claude runs on Brian's Claude Code subscription (this session is the orchestrator). No Claude API billing.
- The orchestrator is **local tooling**. Cloudflare Workers cannot spawn subprocesses, touch the filesystem, or run git, so the loop runs on Brian's machine. Cloudflare Pages + GitHub host the **apps the loop builds** and the two web surfaces (app-builder, dashboard).
- Node-native modules from the original brief (Express, better-sqlite3, bcrypt, jsonwebtoken) do not run on Workers. Generated full-stack apps use Cloudflare Pages Functions + D1 + Web Crypto (PBKDF2 + HMAC-SHA256). No Supabase, per standing rule.

## 3. Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Orchestrator layer | Reusable toolkit repo **plus** a Cloudflare dashboard |
| First target app | Full-featured app-builder (PRD + token estimate + test design + planning wizard) |
| Grok auth | `grok login` (Brian's account, no API cost) |
| Scoring gate | Deterministic tier-1 + capped Claude judge tier-2, architected to grow into the full calibrated rubric |
| App-builder intelligence | Thin client: the web app commits a job; the local Claude+Grok loop is the brain |
| Repo | One monorepo |
| First proof run | Full-featured (not a toy) |
| Threshold | 90 |

## 4. Architecture

Three layers connected by the GitHub repo as the bus.

```
app-builder (Cloudflare Pages)            dashboard (Cloudflare Pages)
  prompt -> clarifying wizard               runs, iterations, scores,
  -> commits specs/<slug>/job.json          diffs, deploy URLs (read-mostly)
        |                                            ^
        v  GitHub API                                | reads results/<slug>.json
   GitHub repo = bus  (D1 mirrors run state for the dashboard)
        ^  pick up job                               | write back score + deploy URL
        |                                            v
   orchestrator (LOCAL, Claude operates it)
     1. plan + PRD (Claude)   2. pre-flight: token estimate + code-collision + parallel plan
     3. loop: grok builds -> deterministic gate -> capped judge -> feedback -> repeat
     4. deploy target app to Cloudflare + push to GitHub
```

The web app never calls an LLM. It captures intent and commits a job. The local orchestrator writes the PRD, asks follow-ups, estimates tokens, and runs the loop. Grok builds via `grok login`. No external API anywhere.

## 5. Monorepo layout

```
/orchestrator     loop harness (PowerShell + bash), scoring gate, judge, pre-flight analyzer
/prompts          system + environment prompts (orchestrator role, grok role, judge role)
/rules            base-15, full rubric lanes, per-generated-app rule pack
/design-system    tokens, theme, typography, component patterns, mobile + WCAG-AA checklist
/app-builder      Vite + React + Tailwind; Pages Functions commit jobs to /specs via GitHub API
/dashboard        Vite + React + Tailwind; reads /results; D1-backed run state
/specs            generated PRDs + job.json (bus payloads)
/results          per-run scores, deploy URLs, judge reports (dashboard reads these)
/templates        the full-stack app template (auth, search, detail, legal pages, SEO)
```

## 6. Orchestrator loop

Two run modes:
- **Interactive** — Claude drives iteration by iteration, applies judgment, crafts feedback. This is the real management role.
- **Unattended** — `grok-loop.ps1` (and a bash twin) for hands-off runs.

Each iteration:
1. Invoke Grok headless against the target repo with spec plus prior failures: `--no-auto-update --always-approve --no-alt-screen --cwd <target> --session-id <run> -m grok-4.5 --output-format json -p <prompt>`. The fixed session id gives Grok memory of its earlier attempts.
2. Run the deterministic gate against the tree. Never trust Grok's self-report; the score is the only signal.
3. If tier-1 is clean, run the judge pass on the judgment rules.
4. Compute 0-100. If >= threshold, stop, show the diff, deploy. Else capture failing output verbatim as the next iteration's feedback.
5. Hard stop at `MAX_ITERS` (default 8; judge escalation at 5 per rubric). Each run on a scratch branch so a bad run reverts cleanly. Grok is scoped to `--cwd` only, never a home directory.

**Pre-flight** (before iterating): parse the plan into tasks, run code-collision analysis (which tasks touch overlapping files), mark non-colliding tasks parallelizable, produce a token-cost estimate (expected iterations x Grok tokens per iteration + Claude QA/judge tokens per iteration, with a confidence band). Surface all of it before spending a token.

## 7. Scoring gate and rubric mapping

- **Tier-1 deterministic (blockers):** tsc strict, eslint (`no-explicit-any`, jsx-a11y, `--max-warnings 0`), ruff/mypy for any Python, tests present and passing, coverage, `wrangler` build succeeds, secret scan, SAST (semgrep / eslint-plugin-security), no committed binaries, duplication scan. Any blocker fails the gate outright.
- **Tier-2 capped Claude judge (<= 30% of weight):** concision, single-purpose modules, why-comments, componentization, fail-closed UI states, safe copy. Judge runs only when tier-1 is clean. Results cached by hunk hash. A score that flip-flops across the threshold escalates to Brian.
- **Growth path to full calibration:** versioned rubric, pinned judge model, median-of-3 sampling, reference-repo calibration (7 references score >= 90, bad-code anchors score >= 20 points lower, injected anti-patterns drop a reference below 90). v1 ships the structure and weights; calibration is a defined phase 2, not blocking first runs.

The rubric content is the pasted standard: base-15 plus the typing, modularity, concision, naming, comments, error-handling, logging, security, testing, dependency, frontend, shell, CI-workflows, repo-hygiene, and process lanes.

## 8. Rule and design inheritance (enforced on every generated app)

`/rules`, `/prompts`, and `/design-system` are the canonical corpus. Every generated app inherits it three ways:

1. **Scaffolded at generation** — the scaffolder copies the enforced surface into the app repo: `CLAUDE.md` (base-15 + per-app rule pack), strict `tsconfig`, eslint flat config, prettier, ruff/mypy if Python, design tokens + central theme, the Cloudflare/D1/Web-Crypto constraints, and the required page skeleton (Home, About, Terms, Privacy, Contact) with SEO. The app starts compliant.
2. **Scored at build** — the gate and judge run the same corpus as their rubric. Non-compliance means below threshold, so the loop keeps iterating. This is the hard enforcement.
3. **Injected per session** — the environment prompt (the 15-line SessionStart block) and the per-app rule pack are fed to both Grok and Claude every iteration.

Supporting pieces:
- **Conformance manifest** — each generated app carries `conformance.json` recording the corpus version it was built against, so drift is visible.
- **Re-sync** — bumping the corpus can re-inject configs into existing generated apps and re-run their gate, so a rule change propagates to everything the system has made.

Design propagates identically: `/design-system` holds tokens, theme, typography, component patterns, and the mobile + WCAG-AA checklist; scaffolded in, gated against (`fe-theme-tokens-only`, `fe-a11y-contrast`, and the rest of the frontend lane), and injected. Clean modern responsive UI, sticky header, professional organized footer, no overlapping text on mobile, and full SEO become the enforced baseline for every app.

## 9. App-builder web app

Vite + React + Tailwind + React Router on Cloudflare Pages. Flow: simple prompt -> short clarifying-questions wizard (guided, since the deep planning happens locally) -> on submit a Pages Function commits `specs/<slug>/job.json` (prompt, answers, target-app type, requested threshold) to the repo via the GitHub API. It shows a deterministic first-pass token estimate in-browser immediately, refined later by the local pre-flight. It follows the template's own rules: Web Crypto auth if needed, D1 for state, centralized copy, WCAG AA, legal pages, SEO.

## 10. Dashboard

Vite + React + Tailwind on Cloudflare Pages + Functions + D1. Read-mostly view of `/results`: run list, iteration and score history, per-iteration diff stat, judge findings (top by severity, tail collapsed), final deploy URL, and token actual-vs-estimate. D1 mirrors run state so the UI is fast.

## 11. Prompts and rules corpus (deliverable)

- **System prompts:** orchestrator/manager role (Claude), Grok coder role, judge role. Pinned and versioned in `/prompts`.
- **Environment prompts:** the SessionStart base-rules summary injected per run.
- **Rules:** `/rules` holds the base-15, the full rubric lanes, and the per-generated-app rule pack (Cloudflare/D1/Web-Crypto constraints, no-Supabase, real-data-only, and the rest of the standing rules).

## 12. Error handling and safety

Scratch branch per run with clean revert. Secret scan runs before any external call and fails closed. Grok scoped to the target dir only. Final diff reviewed before merge or deploy. Deploy verified by asset-hash match (local `dist` hash equals the hash served in prod) and by curling a real backend endpoint, not just the homepage. Secrets live in `.env` only, mirrored to GitHub repo secrets; `.env` contents are never read or printed.

## 13. Testing

- Orchestrator: unit tests for the gate scorer, collision analyzer, and token estimator; a fixture repo with known anti-patterns that must score below threshold (degradation test).
- Web app and dashboard: Vitest + Playwright + axe, verified live post-deploy by qa-tester with screenshot and clean-console evidence.

## 14. Deployment

Cloudflare Pages via wrangler (direct upload / Type B assumed until confirmed): `git push` and deploy are separate steps, and both must land. Verify prod by asset hash. Token from the x-search-mcp-server `.env` (`NewCloudFlareAccountToken`), account `dd01b432f0329f87bb1cc1a3fad590ee`. New GitHub repo created via classic PAT with `repo` + `workflow` scopes; all secrets mirrored to repo secrets. Check GitHub Actions after every push.

## 15. v1 scope and phasing

v1 delivers: monorepo, orchestrator loop (interactive + script), gate (tier-1 + capped judge), pre-flight (token + collision), prompts/rules/design corpus with enforced inheritance, app-builder web app, and dashboard, all deployed. First real run points the loop at a full-featured generated app at threshold 90.

Phase 2: full rubric calibration (reference repos, stability sampling, per-rule weights), re-sync tooling across generated apps, richer dashboard controls.

## 16. Open items to confirm at spec review

- Repo name (`app-forge` placeholder).
- Cloudflare deploy type (A git-connected vs B direct upload) confirmed against reality before first deploy.
- Whether the dashboard is read-only in v1 or can also trigger/cancel runs.
