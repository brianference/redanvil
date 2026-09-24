# Spec — security headers and assistant rate limiting

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Validate every boundary input with Zod.
- Parameterize every D1 query. Never build SQL by concatenation.
- Fail closed. Unknown state is an explicit error, never silent success.
- Write `--`. Never a unicode em dash.

## What is missing, measured on production

`curl -sI https://az-planting-calendar.pages.dev/` returns only
`referrer-policy: strict-origin-when-cross-origin` and
`x-content-type-options: nosniff`.

Absent: `content-security-policy`, `strict-transport-security`,
`x-frame-options`, `permissions-policy`. The rule pack requires secure headers.

`functions/api/assistant.ts` contains no rate limiting. It is an unauthenticated
public endpoint that calls a paid inference binding on every request, so anyone
can drive cost and exhaust quota with a loop.

## 1. Security headers on every response

Add a `public/_headers` file (Cloudflare Pages applies it to static assets AND
function responses) covering all routes:

- `Content-Security-Policy` — the app loads no third-party scripts, so
  `default-src 'self'`, `img-src 'self' data:`, `style-src 'self' 'unsafe-inline'`
  (Vite injects inline styles; if you can avoid it, do), `script-src 'self'`,
  `connect-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`,
  `form-action 'self'`. **Verify the app still works with it applied** -- a CSP
  that breaks the app is worse than none, and a CSP nobody tested is decoration.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Frame-Options: DENY` (belt and braces with `frame-ancestors`)
- `Permissions-Policy` — deny what the app does not use: geolocation, camera,
  microphone, payment, usb.
- Keep the two existing headers.

The shared helper in `functions/lib/http.ts` already sets CORS on API responses;
do not duplicate headers there and in `_headers` in a way that conflicts.

## 2. Rate limit the assistant

`POST /api/assistant` must refuse abusive volume. Implement in D1 (the binding
already exists) with a parameterized query:

- A small table keyed by client identifier and a time window.
- Identify by `CF-Connecting-IP`; when absent, fall back to a constant bucket
  rather than letting an unidentified caller bypass the limit entirely -- fail
  closed, not open.
- A sane limit for a single human planning a garden: on the order of 10 requests
  per minute and a few hundred per day. Pick values, and write down why.
- Over the limit returns **429** with a real message and a `Retry-After` header,
  never a silent empty success and never a 500.
- Prune old rows so the table cannot grow without bound.

Do not rate limit the read-only GET endpoints; they are cheap and cached.

## 3. Do not break what exists

`/api/assistant` must still answer normally under the limit, the five read
endpoints must still return 200, unmatched `/api/*` must still 404, and the
cold-visitor console must stay clean.

## Proof required

Report each with real output:

- `curl -sI` against your local build showing every new header present.
- The app loading with CSP applied: screenshot at 1280, and the console clean.
  A CSP violation logs to console -- if there are any, the CSP is wrong.
- The rate limiter refusing: a loop that exceeds the limit, showing the 429 and
  the `Retry-After` header, then a successful request after the window.
- A unit test for the limiter's window logic, and an acceptance test that the
  assistant still works normally.
- `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
  `npm run build` -- real tails.

If a CSP directive cannot be tightened without breaking the app, say which and
why rather than loosening the whole policy to `unsafe-*`.
