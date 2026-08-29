# Accounts, profiles and transactional email across nine apps

Date: 2026-08-28
Status: approved in chat, built overnight

## Problem

Nine live apps have no way for a visitor to make an account. Each already holds
data worth keeping — a trip, a board, a saved restaurant, a tracked brand — and
loses all of it the moment the browser is closed. scholarship-one solved this
once, in production, and nothing was reused.

A tenth app, trip-one, has accounts already but no email at all: no address
verification, no password reset, no contact delivery. An account you cannot
recover the password for is a trap, not a feature.

## What already exists

`scholarship-one` runs the reference implementation in production:

| File | Lines | What it carries |
|---|---|---|
| `functions/_lib/password.ts` | 105 | PBKDF2-SHA256 via Web Crypto, 100k iterations |
| `functions/_lib/auth.ts` | 46 | token hashing, session create/resolve |
| `functions/_lib/ratelimit.ts` | 108 | fixed-window D1 limiter, salted-hash keys |
| `functions/_lib/validate.ts` | 77 | Zod schemas, honeypot, parse helper |
| `functions/_lib/email.ts` | 110 | Brevo send, HTML-to-text, templates |
| `functions/_lib/http.ts` | 39 | JSON + session cookie helpers |
| `functions/api/auth/*` | 258 | register, login, verify, session, signout, reset |
| `migrations/0002_password_auth.sql` | 43 | password columns, rate_limits, password_resets |

Three constraints are already encoded there and must not be re-derived:

1. **bcrypt and argon2 cannot run in Workers.** They are native Node modules.
   PBKDF2-SHA256 from Web Crypto is the only option.
2. **Workers caps PBKDF2 at 100,000 iterations.** Above that `deriveBits`
   throws, surfacing as a 1101 in production while `wrangler pages dev` accepts
   it locally. The per-row iteration count allows a transparent upgrade later.
3. **`MAIL_FROM` must be `no-reply@txeas.com`.** Sending as protonmail.com
   through Brevo fails DMARC by construction: protonmail publishes
   `p=quarantine` with strict alignment and Brevo is not in its SPF record.
   Brevo logs "delivered" for messages Proton then quarantines.

## Approach

A vendored auth kit, copied into each repo, not a shared dependency.

The nine apps are nine separate GitHub repos with nine separate Pages projects.
An npm package shared between them adds a publish step and version skew for no
benefit at this scale. A central `auth.txeas.com` SSO service was also rejected:
cross-origin session cookies across distinct `pages.dev` subdomains is a real
fight, and nobody asked for single sign-on between a sushi finder and a flight
search.

The kit lives at `RedAnvil/design-system/auth-kit/` as the canonical copy. Each
app receives a copy under its own `functions/`, parameterised by an app config
block: display name, sender name, brand colour, cookie name, and the sentence
describing what the account is for.

### Identical in every app

- PBKDF2-SHA256 password hashing, 100k iterations, per-row iteration count
- D1 tables: `users`, `sessions`, `rate_limits`, `password_resets`,
  `contact_messages`
- HttpOnly + Secure + SameSite=Lax session cookie, 60-day TTL
- Account-enumeration defence: register, reset-request and contact all return a
  generic 200 whatever the outcome, and mail failures are logged server-side
  rather than surfaced
- Rate limiting: 5 attempts per subject, 60 per IP, 15-minute window. The looser
  IP cap exists because shared NAT would otherwise let one person lock out a
  whole network. Success clears the subject window.
- Zod validation, 12-character password floor (length-first, per NIST)
- Contact submissions persist to D1 *before* the Brevo call, so a delivery
  failure never loses a message

### Different in every app

The account's reason to exist. This drives the profile page, the nav entry, the
email copy, and the one feature that actually persists.

| App | What the account holds | Outbound email |
|---|---|---|
| trip-one | saved trips synced across devices | verification, reset, trip-share |
| kanban-board | your boards and cards | verification, reset |
| pet-sitter | owner vs sitter profile | booking notifications |
| sushi-finder | saved places, been-there list | verification, reset |
| az-planting-calendar | your garden bed, by zone | planting-window reminders |
| quickflight | saved routes | fare-drop alerts |
| agent-tower | your workspace | budget-threshold alerts |
| social-pulse | tracked brands | weekly digest |
| yt-intel-one | saved channel scans | insight digest |

## Per-app deployment facts

Measured against the Cloudflare API on 2026-08-28, not recalled.

| App | Pages project | Prod branch | D1 |
|---|---|---|---|
| trip-one | trip-one | main | trip-one-db exists |
| kanban-board | **kanban-board-public** | main | kanban-board-db exists |
| pet-sitter | pet-sitter | main | pet-sitter-db exists |
| sushi-finder | sushi-finder | main | sushi-finder-db exists |
| az-planting-calendar | az-planting-calendar | **master** | az-planting-calendar exists |
| quickflight | quickflight | main | quickflight exists |
| agent-tower | agent-tower | main | **create** |
| social-pulse | social-pulse | main | **create** |
| yt-intel-one | yt-intel-one | main | **create** |

Two traps here. The kanban Pages project is not named after its repo, and
az-planting-calendar's production branch is `master` — passing the wrong
`--branch` silently publishes a preview while reporting success.

## Secrets

Per app: `BREVO_API_KEY` (shared), `MAIL_FROM=no-reply@txeas.com`, a freshly
generated per-app `AUTH_PEPPER` and `RATE_LIMIT_SALT`, and `SITE_URL`.

Secrets are piped into `wrangler pages secret put` from a subshell that sources
the env file. No secret value is ever printed to output, written into
`wrangler.toml`, or passed as a CLI argument. Each is mirrored to the repo's
GitHub secrets via the PyNaCl-encrypted API.

`wrangler.toml` `[vars]` is replace-not-merge: any plain-text var absent from
the block is dropped from the deployment. `MAIL_FROM` and `SITE_URL` therefore
live in `[vars]`, and only true secrets go through `secret put`.

## Verification, per app

No app counts as done until every line below has been run and its output read.

1. `typecheck`, `lint`, unit tests, `build` — exit codes read, not assumed
2. D1 migration applied remotely, then `select` against the new tables
3. Deployed to the production branch, and the served
   `assets/index-<hash>.js` matched against local `dist/`
4. `curl` against the live `/api/auth/register` with an empty body — a 400
   proves a real handler; a 405 proves the function is absent and the SPA
   fallback is answering
5. `curl` the full round trip: register, session, signout
6. A real Brevo send, confirmed against `/v3/smtp/statistics/events` — a
   messageId means queued, not delivered
7. Screenshots at 375, 768 and 1280 in both themes of sign-up, sign-in and
   profile, **opened and looked at**, not merely captured
8. Browser console clean
9. Pushed, with `git rev-list origin/<branch>..HEAD` empty

## Out of scope tonight

`lena-scholarships` is a static `index.html` with a data folder and no backend
at all. `mission-control-cole` is Supabase-backed with zero Pages Functions.
Both need a backend built from nothing before a single auth endpoint can land,
and both are apps built for other people. They get a written estimate instead of
a rushed implementation.

## Correction recorded

An earlier note in this session said trip-one runs auth on Supabase. It does
not. trip-one is on D1 (`trip-one-db`) with PBKDF2 and JWT session cookies
already built; the only Supabase strings left are historical comments in
`functions/lib/db.ts` and `d1/schema.sql`. The claim came from a memory note
plus grep hits in documentation, and the code contradicts it. trip-one needs the
email half only.

## Unrelated security finding

`workspace/projects/tpusa-monitor-dashboard/.git/config` has a GitHub personal
access token embedded in its `origin` URL in plaintext. Not touched by this
work. It should be revoked and the remote rewritten.
