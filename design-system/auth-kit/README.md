# Auth kit

Email/password accounts, email confirmation, password reset and a contact form
for a Cloudflare Pages app backed by D1. Lifted from scholarship-one, which has
run this in production since v5.

## Why a copy and not a package

These apps are separate repos with separate Pages projects. A shared npm
dependency would add a publish step and version skew for no benefit at this
scale, and cross-subdomain SSO on `*.pages.dev` is a fight nobody asked for. Copy
the files; keep them byte-identical except `appconfig.ts`.

## Validated

Measured 2026-08-28 against `wrangler pages dev` with a local D1, not recalled:

- `test/acceptance.mjs`: **33 assertions, all passing**
- The suite was falsified before being trusted. Dropping the password floor from
  12 to 4 and making the unknown-account path return its own message turned it
  **RED with exactly 3 failures**, then green again on restore. A suite that has
  never failed is not yet evidence.
- Row-level proof, not just status codes: after a run, `password_resets` held
  **1** row though both a known and an unknown address got byte-identical 200s,
  and `contact_messages` held **1** row though the honeypot submission also got
  a 200.
- Live Brevo send from `no-reply@txeas.com` to a protonmail address reached
  `/v3/smtp/statistics/events` as `requests, delivered, opened`.

## Porting to an app

1. Copy `functions/_lib/*` and `functions/api/*` into the app's `functions/`.
   If the app already has a `_lib`, merge rather than overwrite.
2. Copy `migrations/0001_auth_core.sql` as the app's next migration number. Its
   tables are all `if not exists`, so it is safe alongside an existing schema.
   **App-specific tables go in a later migration**, never in this file, so the
   kit can be re-copied verbatim when it is updated.
3. Edit `functions/_lib/appconfig.ts`. This is the only file that changes.
   `cookieName` **must** be unique per app: several of these deploy under
   `*.pages.dev`, and a shared cookie name on a shared parent domain would let
   one app receive another app's session cookie.
4. Add `zod` to the app's dependencies if it is not already there.
5. Bind config and secrets (see below).
6. Run the acceptance suite against the app:

   ```sh
   BASE_URL=http://127.0.0.1:8799 COOKIE_NAME=<the app's cookieName> \
     node test/acceptance.mjs
   ```

## Configuration

`wrangler.toml` `[vars]` — plain text, safe to commit:

```toml
[vars]
SITE_URL   = "https://<app>.pages.dev"
MAIL_FROM  = "no-reply@txeas.com"
CONTACT_TO = "brianference@protonmail.com"
```

`[vars]` is **replace, not merge**: any plain-text var missing from this block is
dropped from the deployment.

Secrets, via `wrangler pages secret put` — never in `wrangler.toml`, never as a
CLI argument:

- `BREVO_API_KEY`
- `RATE_LIMIT_SALT` — per app, so one app's rate-limit buckets are not
  computable from another's

## Traps already paid for

**bcrypt and argon2 cannot run in Workers.** They are native Node modules.
PBKDF2-SHA256 from Web Crypto is the only option here.

**Workers caps PBKDF2 at 100,000 iterations.** Above that `deriveBits` throws,
which surfaces as a bare 1101 in production while `wrangler pages dev` accepts it
locally. The per-row iteration count means the cost can be raised later without
invalidating existing hashes.

**`MAIL_FROM` must be on a Brevo-authenticated domain.** Sending as
protonmail.com fails DMARC by construction: protonmail publishes `p=quarantine`
with strict alignment and Brevo is not in its SPF record. Brevo logged
"delivered" for messages Proton then quarantined. Verifying an individual address
in Brevo proves you control it; it does not authorise Brevo to send as that
domain.

**A messageId means queued, not delivered.** Confirm against
`/v3/smtp/statistics/events` before believing a send worked.

**Brevo's "Authorized IPs" must stay off.** A serverless sender has no fixed IP.

**Tear wrangler down by process tree, not by port.** `wrangler pages dev` runs
npx → wrangler → node → workerd, and the parent respawns the child. Killing the
port listener leaves the parent to rebind, and repeated launches leave several
stacks bound to the same port, so connections land on a dead one and hang. Kill
the node processes whose command line contains `wrangler`, then `workerd`.

**Confirmation never gates the account.** A Brevo outage must not lock every new
user out of a product that otherwise works. What confirmation buys is a
recoverable address, so a reset is only mailed to a confirmed one.

## Endpoints

| Method + path | Purpose |
|---|---|
| `POST /api/auth/register` | create account, sign in, mail a confirmation link |
| `POST /api/auth/login` | password sign-in |
| `GET /api/auth/session` | current user + `emailVerified` + whether mail is configured |
| `POST /api/auth/signout` | clear the session cookie |
| `POST /api/auth/confirm` | redeem a confirmation link |
| `POST /api/auth/verify` | redeem a magic-link sign-in token |
| `POST /api/auth/password/reset-request` | mail a reset link |
| `POST /api/auth/password/reset` | redeem it, set a new password, drop other sessions |
| `POST /api/contact` | persist to D1, then notify the operator |
