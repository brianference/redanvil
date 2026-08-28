# Transactional email for a generated app

Any RedAnvil app that has to send mail — account verification, password reset,
a digest, a reminder — uses **Brevo** with the sender `no-reply@txeas.com`.
`txeas.com` is already authenticated and verified in Brevo, so **a new app needs
no DNS work at all**. Bind the key, set the sender, send.

Written 2026-08-28, after the same DMARC bug bit a second project.

## Do not use Resend

`RESEND_API_KEY` shows up in Scholarship One's docs as an open gap. That gap was
closed by moving to Brevo in v4.0.0, not by ever setting a Resend key. Nothing in
any project has sent a message through Resend. Ignore those doc lines.

## The drop-in

| Piece | Value |
|---|---|
| ESP | Brevo, free tier, 300 sends/day |
| Key | `BREVO_API_KEY` in `workspace/projects/x-search-mcp-server/.env` |
| Sender | `no-reply@txeas.com` |
| Endpoint | `POST https://api.brevo.com/v3/smtp/email`, header `api-key: <key>` |
| Domain | `txeas.com` — registrar Epik, DNS on Cloudflare, zone `0c92aec576d3d96aa0cc64d51b743a96` |
| Branded subdomain | `send.txeas.com` (Brevo tracking + bounce) |

Reference implementation, ~50 lines and Workers-safe:
`workspace/apply-dashboard/functions/api/_mail.js`. Its callers are
`functions/api/auth/register.js` and `functions/api/auth/request-reset.js`.

Four steps for a new app:

1. Take `_mail.js` into `functions/api/`.
2. Bind `BREVO_API_KEY` as a Cloudflare Pages secret, and mirror it to the repo's
   GitHub Actions secrets so a scheduled sender can use it.
3. In `wrangler.toml` `[vars]`, set `MAIL_FROM = "no-reply@txeas.com"`.
4. Change the `name:` field on the `sender` object to the app's name.

Build any link in a message from a `SITE_ORIGIN` var, never from the request's
own `Host` header — a caller controls that and could point the link at their
own site.

`sendMail` must never throw. A mail outage that turns a registration into an
error response is also an account-enumeration oracle; return the failure for the
caller to log server-side and keep the response generic.

## The bug that cost two projects

Never send **as** an `@protonmail.com` address through Brevo. `protonmail.com`
publishes `v=DMARC1; p=quarantine` with strict alignment (`aspf=s; adkim=s`),
and Brevo is not in its SPF record. Sending as that domain through Brevo fails
DMARC by construction, and Proton is entitled to quarantine or silently discard
the message.

What makes it expensive: **Brevo logs "delivered"**. Proton's servers accept the
message, then Proton drops it. The provider dashboard shows success for mail
that never arrived. This happened in Scholarship One in July and again in
apply-dashboard on 2026-08-28, both times costing hours before anyone read the
receiving domain's DNS.

Send only from a domain you control, and check the recipient domain's DMARC
policy before trusting a "delivered" status.

## Brevo behaviours that look like bugs

- **"Authorized IPs" must stay OFF.** Serverless senders have no fixed IP;
  leaving it on returns `401 unrecognised IP`.
- **A `messageId` is not proof of sending.** Brevo accepts, then rejects
  asynchronously. An unverified sender surfaces only as `event: error` in
  `GET /v3/smtp/statistics/events`. Confirm there, always.
- **Domain authentication is dashboard-only on the free tier.**
  `POST /v3/senders/domains` returns `400 "not available for your account"`.
- **The branded record is renameable.** Brevo defaults it to `mail`, which
  collides with a live `mail.<domain>` mail server. Rename it to `send` rather
  than authenticating a separate sending subdomain.
- **DKIM keys publish only after authentication completes.** Expect a lag before
  they resolve at `b1`/`b2.<domain>.dkim.brevo.com`.

## Verifying delivery for real

A gate that checks "the API returned 201" has not checked delivery. Two things
actually prove it:

1. `GET https://api.brevo.com/v3/smtp/statistics/events?days=1` — real
   send/deliver/error events, not the queue acknowledgement.
2. **mail-tester.com**, driven with Playwright because its address is
   JS-generated. Read the address from `input[name="id"]`, send to it, then read
   the score at `https://www.mail-tester.com/<id>`. Scholarship One scored
   **8/10 with "You're properly authenticated"** — zero deduction on the
   authentication category, the two lost points being content-only.

Test oracles that gave **wrong** answers and should not be trusted: a mail.tm
disposable inbox re-encodes the body and fails DKIM body-hash on a valid
signature; `dkimpy` with its default resolver returns the CNAME instead of the
chained TXT and reports a missing public key; and a recursive resolver caches one
side of a split delegation and calls it correct.

## Full write-ups

- `workspace/projects/scholarship-one/docs/EMAIL-DELIVERABILITY-RUNBOOK.md` —
  test methodology, the wrong oracles, and the split-nameserver-delegation root
  cause that made DKIM fail on roughly half of all lookups.
- `workspace/projects/scholarship-one/docs/EMAIL-DOMAIN-SETUP.md` — step-by-step
  provisioning, if a second sending domain is ever needed.
