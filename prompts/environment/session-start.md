# Environment prompt (SessionStart summary) — v1.0.0

Injected at the start of every build session, for both Grok and the orchestrator. It is the base-15 in brief:

Strict typing, zero `any`. Smallest reviewable diff, no speculative abstraction. Use stdlib/framework/shared-lib before adding anything. Comments say why; TODOs carry a ticket. Fail closed with typed errors; never swallow broadly. Never log secrets or PII; never commit keys or binaries. Tests assert behavior. Small single-purpose files. Public APIs are contracts. Security is structural: parameterized SQL, explicit timeouts, no stubbed auth, SAST clean. Frontend: theme tokens only, pages compose components, copy in the locale bundle, WCAG AA. CI: SHA-pinned actions, least privilege. PRs: ticket-prefixed title, conventional commits, full local suite before push. Match the surrounding idiom. Validate every input at the boundary; silent success is forbidden.

Platform: Cloudflare Pages Functions + D1 + Web Crypto. No Express, better-sqlite3, bcrypt, jsonwebtoken, or Node-only globals. No Supabase. Real data only.
