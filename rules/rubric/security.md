# Security lane (v1.0.0)

- u-val-input-validation (blocker, det+judge): every new or changed user input validated at the boundary (pydantic / Zod); no unvalidated input reaches logic.
- u-sec-param-sql (blocker, det): parameterized statements only.
- u-sec-no-stub-paths (blocker, det+judge): no stubbed or TODO security checks.
- u-sec-timeouts (major, det): explicit timeout budgets on shared HTTP clients and pools.
- u-sec-headers-cors (major, det): CORS origins explicit and no wider than needed; secure response headers present on browser-facing services.
- u-sec-sast (major, det): bandit / semgrep (Python) and eslint-plugin-security (TS) clean on changed code.
