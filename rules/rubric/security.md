# Security lane (v1.0.0)

- u-val-input-validation (blocker, det+judge): every new or changed user input validated at the boundary (pydantic / Zod); no unvalidated input reaches logic.
- u-sec-param-sql (blocker, det): parameterized statements only.
- u-sec-no-stub-paths (blocker, det+judge): no stubbed or TODO security checks.
- u-sec-timeouts (major, det): explicit timeout budgets on shared HTTP clients and pools.
- u-sec-headers-cors (major, det): CORS origins explicit and no wider than needed; secure response headers present on browser-facing services.
- u-sec-sast (major, det): bandit / semgrep (Python) and eslint-plugin-security (TS) clean on changed code.
- u-plat-worker-runtime (blocker, det): no Node-only global (`process`, `Buffer`, `__dirname`, `__filename`) and no native or Node-only module (`fs`, `path`, `crypto` as a Node import, `bcrypt`, `jsonwebtoken`, `better-sqlite3`) referenced in Worker (`functions/**`) or browser (`src/**`) code. Decided by an import and identifier scan, not by a passing Node test: unit tests run in Node, where these exist, so they cannot catch it.
- u-plat-migrations (blocker, det): a D1 binding implies versioned migrations in the app tree containing the CREATE TABLE DDL, so the schema is reproducible from the repo. A dump under backups/ is a data backup, not a schema source.
