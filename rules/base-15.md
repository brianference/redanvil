# Base rules (v1.0.0)

The core of the standard. A diff that honors these rarely trips the detailed lanes. This block is injected as the SessionStart summary for every RedAnvil run.

1. Strict typing everywhere: mypy strict, tsc strict, zero `any`, no untyped defs.
2. Concise, reviewable code: the smallest diff that does the job; no padding, no speculative abstraction, no line that does what one clear line can.
3. Use what exists before writing or adding anything: stdlib, then framework, then shared library; a new dependency is a reviewable event.
4. Comments explain why, never what; every TODO carries a ticket.
5. Fail closed with typed errors; never swallow exceptions broadly.
6. Never log secrets or PII; never commit keys, binaries, or copy-paste duplication.
7. Tests assert the change, not just exist; behavior over implementation.
8. Small, single-purpose files and functions, sized from the corpus norm.
9. A shared library's public API is a contract: deprecation alias or version bump, never a silent break.
10. Security is structural: allowlisted JWT validation, parameterized SQL, explicit timeouts, no stubbed auth paths, SAST clean.
11. Frontend: theme tokens only, central style sheet, pages compose named components, all copy in the locale bundle, WCAG AA.
12. CI workflows: SHA-pinned actions, least-privilege permissions, no injection surfaces.
13. PR discipline: ticket-prefixed title, conventional commits, full local suite before push.
14. When the surrounding file uses an older idiom, a minimal diff matches it; consistency beats a style island.
15. Validate every input at the boundary and fail closed everywhere: unknown or partial state is an explicit error, in code and on screen; silent success is forbidden.
16. Never report a number from an unvalidated measurement. An unverified measurer produces fabricated data. Sanity-check every measured figure against an invariant that would prove the tool broken before quoting it; if two runs disagree, report neither. Use the standard implementation for anything with a spec (axe-core for contrast, not a bespoke parser). When a measurement cannot be trusted, record UNVERIFIED and let it fail closed.
