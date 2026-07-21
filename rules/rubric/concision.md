# Concision lane (v1.0.0)

- u-conc-dead-code (blocker, det): no unused imports, variables, or unreachable code.
- u-conc-idiomatic (major, judge): prefer the single-expression idiom when it reads at a glance; a dense line that needs a comment to decode fails the same rule.
- u-conc-no-speculative-abstraction (major, judge): no single-use trivial wrappers, no classes where a function does, no layers for futures not in the ticket.
- u-conc-use-what-exists (major, det+judge): use stdlib, framework, or the shared library before writing new code or adding a dependency.
- u-conc-no-padding (major, det): no try/except that only logs and re-raises, no docstrings that restate the signature, no redundant intermediate variables.
- u-conc-smallest-diff (major, det+judge): diff scoped to the ticket; generated lockfiles excluded from diff-size metrics.
