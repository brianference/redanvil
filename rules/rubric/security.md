# Security lane (v1.0.0)

- u-val-input-validation (blocker, det+judge): every new or changed user input validated at the boundary (pydantic / Zod); no unvalidated input reaches logic.
- u-sec-param-sql (blocker, det): parameterized statements only.
- u-sec-no-stub-paths (blocker, det+judge): no stubbed or TODO security checks.
- u-sec-timeouts (major, det): explicit timeout budgets on shared HTTP clients and pools.
- u-sec-headers-cors (major, det): CORS origins explicit and no wider than needed; secure response headers present on browser-facing services.
- u-sec-sast (major, det): bandit / semgrep (Python) and eslint-plugin-security (TS) clean on changed code.
- u-sec-safe-href (blocker, det): every data-driven JSX `href={…}` (and dangerous remote `src` on iframe/script/object/embed) must pass through `safeHttpUrl` / `safeHref` / `safeUrl` or render via `SafeExternalLink`. Unvalidated `href={row.url}` is an XSS sink (`javascript:`, mixed-case/whitespace schemes, protocol-relative `//evil`). When validation fails, render no anchor. String literals and relative `/`/`#` paths via `safeHref` are fine. n/a only when the app has no JSX source.
- u-plat-worker-runtime (blocker, det): no Node-only global (`process`, `Buffer`, `__dirname`, `__filename`) and no native or Node-only module (`fs`, `path`, `crypto` as a Node import, `bcrypt`, `jsonwebtoken`, `better-sqlite3`) referenced in Worker (`functions/**`) or browser (`src/**`) code. Decided by an import and identifier scan, not by a passing Node test: unit tests run in Node, where these exist, so they cannot catch it.
- u-plat-runtime-parity (blocker, det): after build, boot the app on the real Workers runtime (`wrangler pages dev`) and request the homepage plus every discovered `functions/api/health.*` endpoint; a non-200, invalid health JSON, or a runtime throw fails. A passing Node suite is not enough: Node-only globals and transitive native modules pass unit tests then throw in Workers. Exit 3 (not-applicable) when the app has no `wrangler.toml`. Implements `lg-runtime-parity`; the static grep alone cannot see a Workers-incompatible transitive dependency.
- u-plat-migrations (blocker, det): a D1 binding implies versioned migrations in the app tree containing the CREATE TABLE DDL, so the schema is reproducible from the repo. A dump under backups/ is a data backup, not a schema source.
