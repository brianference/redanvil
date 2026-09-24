# Handoff: accounts and transactional email across the fleet

Session of 2026-08-28/29. Everything below was measured in-session unless it
says otherwise.

## What you asked for

Go through the RedAnvil list and GitHub, find which apps need email
signup/login/registration, and apply account, profile, navigation and
signup/register email-delivery fixes to each -- unique per app, following one
shared pattern. trip-one explicitly included.

Answers given: apps with real per-user state plus trip-one; full auth parity;
migrate trip-one off Supabase; build, gate, deploy to production and push
overnight. Then: the nine apps tonight with the two heavy outliers reported
rather than rushed, and maximum depth -- accounts plus profile plus a real
per-app feature plus its outbound email.

## Corrections to what I told you earlier in the session

Three things I stated turned out to be wrong. All were caught by measuring.

1. **trip-one is NOT on Supabase.** It is already on D1 (`trip-one-db`) with
   PBKDF2 and JWT session cookies. The only Supabase strings left are historical
   comments in `functions/lib/db.ts` and `d1/schema.sql`. The "migrate off
   Supabase" decision you approved is moot; trip-one needed the email half only,
   which is what it is getting.

2. **kanban-board already had working auth in production.** I had probed
   `kanban-board.pages.dev`, which is a stale 459-byte page. The real app is
   `kanban-board-public.pages.dev`, where `/api/auth/register` returns 400 from a
   real handler.

3. **`pet-sitter.pages.dev` and `agent-tower.pages.dev` are not ours.** Those
   names were taken, so Cloudflare assigned the projects
   `pet-sitter-vz1.pages.dev` and `agent-tower-34v.pages.dev`. Every earlier
   probe of those two apps was measuring a stranger's site.

## Done and verified in production

Five apps have accounts, email confirmation, password reset and a contact form
live, each proven against the deployed build rather than locally.

| App | URL | Probe | Asset hash | Confirmation email |
|---|---|---|---|---|
| sushi-finder | sushi-finder.pages.dev | 24/24 | matches dist | delivered |
| az-planting-calendar | az-planting-calendar.pages.dev | 24/24 | matches dist | delivered |
| pet-sitter | **pet-sitter-vz1**.pages.dev | 24/24 | matches dist | delivered |
| quickflight | quickflight.pages.dev | 24/24 | matches dist | delivered |
| agent-tower | **agent-tower-34v**.pages.dev | 24/24 | matches dist | delivered |

"delivered" means Brevo's `/v3/smtp/statistics/events` reported `requests,
delivered, opened` for that app's confirmation message, with the per-app subject
line. A messageId alone was not accepted as proof.

### The kit

`design-system/auth-kit/` -- lifted from scholarship-one's production
implementation, parameterised by exactly one file (`functions/_lib/appconfig.ts`).
`port.mjs` applies it to an app; it is idempotent and refuses to overwrite an
existing `[vars]` block.

Validation, in order of how much it is worth:

- `test/acceptance.mjs`: **33/33** against `wrangler pages dev` with local D1.
- **The suite was falsified before being trusted.** Dropping the password floor
  from 12 to 4 and letting the unknown-account path return its own message made
  it go **RED with exactly 3 failures**, then green again on restore. A suite
  that has never failed is not evidence.
- **Row-level proof, not status codes.** After a run, `password_resets` held 1
  row although a known and an unknown address both returned byte-identical
  200s; `contact_messages` held 1 row although the honeypot submission also
  returned 200. That is the anti-enumeration and anti-bot behaviour proven at
  the data layer.
- `test/password.test.mts`: **14/14**, run after the constant-time comparison was
  rewritten for `noUncheckedIndexedAccess`.
- Live Brevo send from `no-reply@txeas.com` to a protonmail address:
  `requests, delivered, opened`.

## Defects found and fixed on the way

- **pet-sitter 500'd on register.** It already had `users` and `sessions` in
  incompatible shapes, so the kit's `create table if not exists` silently did
  nothing. `0005_auth_reconcile.sql` rebuilds both, after verifying 0 rows in
  each immediately before running.
- **SITE_URL pointed at domains we do not own** for pet-sitter and agent-tower.
  Confirmation and password-reset links would have been emailed pointing at a
  stranger's site. Fixed and redeployed.
- **agent-tower's `functions/` was outside every tsconfig include**, so the whole
  tree shipped unchecked. It now has `tsconfig.functions.json` and a typecheck
  script.
- **Kit failed under stricter tsconfigs.** Three `noUncheckedIndexedAccess`
  errors, fixed in the kit so every app inherits the fix rather than patching
  one copy.
- **sushi-finder's D1 migration ledger had drifted.** Migrations 0003 and 0004
  were fully applied remotely (columns and real seed data present) but never
  recorded, so `migrations apply` tried to replay 0003 and failed on a duplicate
  column.

## Blocked, and why

**social-pulse and yt-intel-one cannot be built.** Cloudflare's free tier caps
D1 at **10 databases per account** and the account is at exactly 10.
`agent-tower-db` took the last slot; both remaining creates were refused with
`System limit reached: databases per account (10)`. None of the ten is
disposable. This needs a decision from you:

1. Upgrade to Workers Paid, which raises the limit; or
2. Share one database between the two apps, with an app-scoped column; or
3. Leave those two without accounts.

**The RedAnvil push is committed but NOT pushed.** Two commits (`84291ff`,
`dd8e970`) sit on `master`. The pre-push finish-line hook refuses, naming
**app-builder only**: finalScore 0, 18 failing rules, and `lg-shipped` failing
because it has never been deployed. Nothing I touched was refused. `lg-shipped`
is deliberately not waivable, which is right, but it means an unshipped app
blocks unrelated verified work. `docs/PUSH-BYPASS-LOG.md` records this. The
durable fix is to scope the hook's check to the apps actually in the push range;
it already computes that range and does not use it to filter.

agent-tower and quickflight are separate repos with no such hook and **are
pushed**.

## Contact form, proven end to end

A real message through `POST /api/contact` on sushi-finder persisted to D1 with
`delivered = 1` and reached the operator inbox as
`[Sushi Finder] Contact delivery probe`, confirmed `requests, delivered, opened`
in Brevo's events API.

Worth knowing for next time: for several minutes that message showed only
`requests` in the events API, which read like a delivery failure. It had in fact
been delivered three seconds after the send; the `delivered` event simply had not
appeared in the index yet. Polling an events API is not the same as the event not
existing -- do not call a send failed on a short poll.

## Frontend progress

| App | Account UI | Per-app feature | Deployed + hash-verified | Screens reviewed | Committed |
|---|---|---|---|---|---|
| sushi-finder | yes | saved places (18/18 probe) | yes | 24 shots | yes (local) |
| trip-one | yes | email layer on existing trips | yes | yes | pushed, CI green |
| az-planting-calendar | yes | garden bed | yes (master branch) | 12 shots | yes (local) |
| quickflight | yes | saved routes | yes | 12 shots | pushed |
| pet-sitter | yes | sitter shortlist | yes | 12 shots | yes (local) |
| agent-tower | yes | workspace + budget | yes | 12 shots | **NOT committed** |
| kanban-board | not started | n/a | untouched | no | n/a |

Every reviewed screen: zero console errors, zero horizontal overflow at 375px,
and both themes confirmed by PAINTED background colour rather than an attribute.

**agent-tower is deliberately uncommitted.** Its working tree already held
uncommitted work of yours before this session (App.tsx, Shell.tsx, ChatDock,
Hero, FeatureGrid, the fleet components, site.ts, styles.css, plus untracked
DesignPicker.tsx and FleetStats.tsx). The account UI edits are interleaved with
those in the same files, so any commit would either capture your work or omit
files the build needs. It is deployed and verified; the commit is yours to shape.

## Three things caught by reviewing rather than trusting

**A delegated run invented a lint script.** trip-one has no ESLint installed and
no config. Asked to make `npm run lint` pass, the agent added
`"lint": "tsc --noEmit"` -- a script reporting success while never linting.
Removed, with a note in package.json saying why the absence is deliberate. Later
delegations were told explicitly not to do this; one of them reported back
"no lint script -- not invented", which is the right answer.

**The screenshot harness was wrong in the flattering direction, twice.** It first
emulated `prefers-color-scheme` and captured the light page for both themes,
because these apps deliberately give a cold visitor light whatever the OS says.
Seeding localStorage fixed sushi-finder and then silently failed on trip-one
(`trip-one-theme`) and agent-tower (`agent-tower-theme`). It now compares the
PAINTED background between the two runs and fails when they match, which no
storage key or missing attribute can fool. Falsified: 3 findings with the wrong
key, 0 with the right one.

**Then the same check produced a FALSE FAILURE.** pet-sitter paints its
background on `<html>` and leaves `<body>` transparent, so reading body alone
reported `rgba(0,0,0,0)` for both themes on an app whose theme was fine. The
check now uses the effective background: body when opaque, else html. Regression-
checked against sushi-finder, which paints on body, and it still passes. Both
directions of measurement error are now covered.

## A real production bug the visual pass found

pet-sitter's theme had been broken in production before this session.
`public/_headers` sets `script-src 'self'` with no unsafe-inline, and index.html
carried the theme bootstrap as an inline `<script>`. The browser blocked it on
every load, so `data-theme` was never set and the page rendered with no
background. Nothing in the code review would have shown this; it took a console
capture on the deployed page. Fixed by moving the bootstrap to
`public/theme-init.js`, served from 'self'. Console errors went 2 -> 0 and the
theme now switches.

## Still outstanding

- kanban-board's email layer. Its auth is stateless JWT with its own crypto, so
  the kit does not transplant; it needs the adaptation trip-one got.
- Recurring outbound email (planting reminders, fare alerts, budget alerts,
  digests). Confirmation, reset and contact all send and are proven; the
  scheduled sends are not built.
- No axe-core accessibility run. Contrast was computed only for the email button
  colours. **No a11y rule should be recorded as passing.**
- agent-tower's commit, per the note above.

## Unrelated findings

- **A GitHub personal access token is committed in plaintext** in
  `workspace/projects/tpusa-monitor-dashboard/.git/config`, embedded in the
  `origin` URL. Revoke it and rewrite the remote.
- **agent-tower carries `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL`** as Pages
  secrets with NO code using them. Correcting what I said earlier in the session:
  agent-tower is not Supabase-backed. Its sessions and costs are client seed data
  in `src/data/sessions.ts`. The secrets are leftovers and should be removed.
  Separately worth knowing: that app's fleet figures are seed data, not real
  records.
- **kanban-board rate-limits in an in-memory `Map`.** That does not hold across
  Workers isolates, so the limit is far weaker than it reads.

## Operational note worth keeping

`wrangler pages dev` runs npx -> wrangler -> node -> workerd, and the parent
respawns the child. Killing the port listener leaves the parent to rebind, and
repeated launches leave several stacks bound to the same port, so connections
land on a dead one and hang with no error. Tear it down by process tree: kill
the node processes whose command line contains `wrangler`, then `workerd`.
