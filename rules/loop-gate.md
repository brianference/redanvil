# Loop gate and execution rules (v1.0.0)

The operational contract for the Grok build loop. These rules are enforced, not advisory. The orchestrator (Claude) owns the loop and the score; Grok is a black-box coder invoked as a subprocess.

## No-stall protocol (blocker)

- lg-inline-critical-path (blocker): the critical path — Grok build, deterministic gate, score computation, feedback, deploy — runs inline in the orchestrator session. The orchestrator runs every command and reads output directly. It is never delegated to an opaque agent that could hang.
- lg-no-blocking-wait (blocker): the orchestrator never enters an indefinite blocking wait on a subagent for the critical path. If a dispatched review does not return usable output promptly, the orchestrator performs that review inline and proceeds. The build never waits.
- lg-bounded-subagents (major): subagents are used only for independent, bounded, parallelizable review dimensions (functional QA, design, architecture, security, UAT). Each dispatch carries: explicit scope, the enforced rule subset for its role, the exact evidence it must return, and a deliverable small enough to return fast.
- lg-inline-fallback (blocker): any role a subagent would cover, the orchestrator can and will run inline. Subagent use is an optimization for parallelism, never a dependency. When in doubt, inline.
- lg-score-is-inline (blocker): the 0-100 score is always computed inline by the orchestrator from real command output. Grok's self-report is never trusted, and scoring is never delegated.

## Role gate (every build must clear all roles)

Each role has a skillset and an enforced rule subset. A build cannot reach the score gate with an open blocker in any role.

- lg-role-build (blocker): Grok codes against the spec plus the injected per-app rule pack. Invoked headless, `--cwd` scoped to the target repo only, fixed `--session-id` for cross-iteration memory.
- lg-role-deterministic-gate (blocker): tsc strict, eslint (`--max-warnings 0`), ruff/mypy where Python, vitest/pytest, coverage, `wrangler` build, secret scan, SAST (semgrep / eslint-plugin-security), duplication scan, no committed binaries. Any tier-1 blocker fails the gate outright.
- lg-role-qa (blocker): functional QA via qa-tester on a real run (local or deployed). Evidence required: screenshot plus a clean browser console and network log. Skill: superpowers:systematic-debugging for any failure before a fix.
- lg-role-design (major; blocker on frontend lanes): design review against `/design-system` tokens and the `fe-*` rules — theme tokens only, WCAG AA contrast, sticky header, professional footer, no overlapping text at 375px, responsive at 375/768/1280.
- lg-role-architecture (major): single-purpose modules, clear boundaries, file and function size within caps, dependency discipline, no speculative abstraction.
- lg-role-security (blocker): security review — SAST clean on changed code, every input validated at the boundary (Zod / pydantic), Web Crypto (PBKDF2 + HMAC-SHA256) for auth, no secrets or PII in logs, parameterized SQL, explicit timeouts, no stubbed auth paths. Skill: /security-review.
- lg-role-uat (major): user acceptance testing — simulate real users against every acceptance line in the PRD; a feature with no exercised acceptance criterion fails UAT.

## Score gate

- lg-score-threshold (blocker): the run passes only when the inline score is >= the job threshold (default 90). Below threshold, capture failing output verbatim and feed it into the next Grok prompt.
- lg-score-tiers (blocker): score = deterministic tier-1 (blockers gate to zero) plus capped judge tier-2 (judge-scored rules <= 30% of tier-2 weight). Judge runs only when tier-1 is clean.
- lg-score-max-iters (major): stop at MAX_ITERS (default 8; judge escalation at 5). On cap without passing, report the last score and the open blockers.
- lg-score-flipflop-escalates (major): a score that crosses the threshold and then falls back on a later iteration escalates to the owner immediately rather than looping.
- lg-run-on-scratch-branch (blocker): every run happens on a scratch branch so a bad run reverts cleanly; the final diff is reviewed before merge or deploy.
