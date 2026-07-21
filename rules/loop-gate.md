# Loop gate and execution rules (v1.0.0)

The operational contract for the Grok build loop. These rules are enforced, not advisory. The orchestrator (Claude) owns the loop and the score; Grok is a black-box coder invoked as a subprocess.

## No-stall protocol (blocker)

- lg-inline-critical-path (blocker): the critical path — Grok build, deterministic gate, score computation, feedback, deploy — runs inline in the orchestrator session. The orchestrator runs every command and reads output directly. It is never delegated to an opaque agent that could hang.
- lg-no-blocking-wait (blocker): the orchestrator never enters an indefinite blocking wait on a subagent for the critical path. If a dispatched review does not return usable output promptly, the orchestrator performs that review inline and proceeds. The build never waits.
- lg-bounded-subagents (major): subagents are used only for independent, bounded, parallelizable review dimensions (functional QA, design, architecture, security, UAT). Each dispatch carries: explicit scope, the enforced rule subset for its role, the exact evidence it must return, and a deliverable small enough to return fast.
- lg-inline-fallback (blocker): any role a subagent would cover, the orchestrator can and will run inline. Subagent use is an optimization for parallelism, never a dependency. When in doubt, inline.
- lg-score-is-inline (blocker): the 0-100 score is always computed inline by the orchestrator from real command output. Grok's self-report is never trusted, and scoring is never delegated.
- lg-grok-timeout (blocker): the Grok subprocess is the primary hang risk, not subagents. Every Grok invocation runs with a wall-clock timeout and is killable — launched in the background and monitored, never as a foreground call that can block forever. On timeout the iteration is recorded as failed, any partial diff is captured as feedback, and the loop proceeds. A wedged Grok never stalls the orchestrator.

## Role gate (every build must clear all roles)

Each role has a skillset and an enforced rule subset. A build cannot reach the score gate with an open blocker in any role.

- lg-role-build (blocker): Grok codes against the spec plus the injected per-app rule pack. Invoked headless, `--cwd` scoped to the target repo only, fixed `--session-id` for cross-iteration memory.
- lg-role-deterministic-gate (blocker): tsc strict, eslint (`--max-warnings 0`), ruff/mypy where Python, vitest/pytest, coverage, `wrangler` build, secret scan, SAST (semgrep / eslint-plugin-security), duplication scan, no committed binaries. Any tier-1 blocker fails the gate outright.
- lg-runtime-parity (blocker): a passing Node test suite does not prove the Worker runs. After build, boot the app on the real runtime (`wrangler pages dev`) and curl a live backend endpoint plus the homepage; a non-200 or a runtime throw fails the gate. This is the check that catches Node-only globals (`process`, `Buffer`) and native modules (`better-sqlite3`) that pass every Node test and then throw in Workers or the browser.
- lg-role-qa (blocker): functional QA via qa-tester on a real run (local or deployed). Evidence required: screenshot plus a clean browser console and network log. Skill: superpowers:systematic-debugging for any failure before a fix.
- lg-role-design (major; blocker on frontend lanes): design review against `/design-system` tokens and the `fe-*` rules — theme tokens only, WCAG AA contrast, sticky header, professional footer, no overlapping text at 375px, responsive at 375/768/1280.
- lg-role-architecture (major): single-purpose modules, clear boundaries, file and function size within caps, dependency discipline, no speculative abstraction.
- lg-role-security (blocker): security review — SAST clean on changed code, every input validated at the boundary (Zod / pydantic), Web Crypto (PBKDF2 + HMAC-SHA256) for auth, no secrets or PII in logs, parameterized SQL, explicit timeouts, no stubbed auth paths. Skill: /security-review.
- lg-role-uat (major): user acceptance testing — simulate real users against every acceptance line in the PRD; a feature with no exercised acceptance criterion fails UAT.

## Design and completeness gate (blockers)

These close the holes that shipped a barebones, dead-end app. They are verified on the RENDERED page, never from source.

- lg-visual-review-required (blocker): no site passes or is called done without a recorded visual review — load the deployed URL in Playwright/Chrome, screenshot at 375/768/1280, and verify the design checklist (wordmark/logo, sticky header, professional multi-column footer, theme tokens only, WCAG AA contrast, no text overlap at 375px, zero console errors). Design rules (`fe-theme-tokens-only`, `fe-a11y-contrast`, header/footer) are scored from the screenshot, never rubber-stamped from code. A global deploy hook injects this requirement on every `wrangler pages deploy`.
- lg-product-completeness (blocker): the app must deliver its stated core feature end-to-end, verified by UAT on the live site. A flow that collects input but produces no usable output (e.g. a wizard that never generates its PRD) fails — "does nothing" is never a pass.
- lg-cross-link (major): apps that belong to the same system link to each other in a shared header/footer (app-builder <-> dashboard), so the product is navigable, not a set of orphan pages.

## Score gate

- lg-score-threshold (blocker): the run passes only when the inline score is >= the job threshold (default 90). Below threshold, capture failing output verbatim and feed it into the next Grok prompt.
- lg-score-tiers (blocker): score = deterministic tier-1 (blockers gate to zero) plus capped judge tier-2 (judge-scored rules <= 30% of tier-2 weight). Judge runs only when tier-1 is clean.
- lg-score-max-iters (major): stop at MAX_ITERS (default 8; judge escalation at 5). On cap without passing, report the last score and the open blockers.
- lg-score-flipflop-escalates (major): a score that crosses the threshold and then falls back on a later iteration escalates to the owner immediately rather than looping.
- lg-run-on-scratch-branch (blocker): every run happens on a scratch branch so a bad run reverts cleanly; the final diff is reviewed before merge or deploy.
- lg-budget-ceiling (major): each run carries a wall-clock and iteration budget derived from the pre-flight token estimate. Crossing 1.5x the estimated iterations, or the wall-clock ceiling, escalates to the owner rather than looping on.

## Isolation and least privilege

Grok runs with `--always-approve`, so it can execute arbitrary shell in its working directory. It is contained, not trusted.

- lg-worktree-isolation (blocker): each run executes in a dedicated git worktree, disk-isolated from the main tree and from other concurrent runs. An unchanged worktree is discarded; a bad one is thrown away without touching main.
- lg-grok-no-secrets (blocker): no secrets ever enter Grok's environment or working directory. `.env`, `.dev.vars`, and all tokens are excluded from the worktree Grok sees. Grok is given the code and the spec, never the keys.
- lg-grok-no-deploy (blocker): Grok may not push, deploy, or make any external network mutation. Pushing to GitHub and deploying to Cloudflare are orchestrator-only actions, performed inline after the gate passes and the diff is reviewed. Grok's prompt forbids these explicitly.
- lg-collision-serialize (major): tasks run in parallel only when the collision analysis proves their file sets do not overlap. On any uncertainty, tasks are serialized. Two runs must never edit overlapping files concurrently.

## Ralph harness

The RedAnvil iteration loop is driven by the ralph-loop plugin inside the orchestrator session, which is inline by construction and matches the no-stall protocol.

- lg-ralph-driver (major): the loop is run via ralph-loop with the completion-promise bound to the score gate (emit `<promise>SCORE>=THRESHOLD</promise>` only when the inline score clears the threshold) and `--max-iterations` always set. Ralph re-feeds the same orchestration prompt after each iteration; the orchestrator sees its prior work in files and git history and continues.
- lg-ralph-bounded (blocker): ralph never runs unbounded. Both a completion-promise and `--max-iterations` are always set, so the loop cannot spin forever. The promise is emitted only from a real, inline-computed passing score, never from Grok's self-report.
- lg-ralph-each-iteration-inline (blocker): every ralph iteration performs its work inline — invoke Grok (bounded, per lg-grok-timeout), run the gate, compute the score, write feedback. No iteration blocks on an opaque subagent.
