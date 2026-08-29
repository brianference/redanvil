#!/usr/bin/env node
/**
 * Verify every app's SITE_URL points at the domain its Pages project actually
 * serves.
 *
 * WHY THIS EXISTS: a `<name>.pages.dev` subdomain is claimed globally, not per
 * account. When the name is taken, Cloudflare silently assigns the project a
 * suffixed one -- pet-sitter became pet-sitter-vz1, agent-tower became
 * agent-tower-34v, social-pulse became social-pulse-21m. Three of eight apps in
 * one session.
 *
 * The failure is quiet and nasty. `wrangler pages deploy` reports success, the
 * site works on its real domain, and the only broken thing is SITE_URL -- which
 * is what confirmation and password-reset links are built from. Getting it wrong
 * emails your users a link to a domain a stranger controls. Nothing in a build,
 * a typecheck or a test suite looks at it.
 *
 * Usage:  CLOUDFLARE_API_TOKEN=... node check-site-url.mjs <appDir> [<appDir> ...]
 * Exits non-zero if any app's SITE_URL disagrees with its project's subdomain.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || 'dd01b432f0329f87bb1cc1a3fad590ee'
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN is required')
  process.exit(2)
}

const dirs = process.argv.slice(2)
if (!dirs.length) {
  console.error('pass at least one app directory')
  process.exit(2)
}

/** Pull `name` and the SITE_URL from a wrangler.toml without a TOML parser. */
function readConfig(dir) {
  const p = join(dir, 'wrangler.toml')
  if (!existsSync(p)) return null
  const text = readFileSync(p, 'utf8')
  const name = text.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1]
  const siteUrl = text.match(/^\s*SITE_URL\s*=\s*"([^"]+)"/m)?.[1]
  return { name, siteUrl }
}

let failures = 0
for (const dir of dirs) {
  const label = basename(dir)
  const cfg = readConfig(dir)
  if (!cfg?.name) {
    console.log(`  SKIP  ${label.padEnd(24)} no wrangler.toml name`)
    continue
  }
  if (!cfg.siteUrl) {
    console.log(`  FAIL  ${label.padEnd(24)} no SITE_URL in [vars] — reset and confirm links have no origin`)
    failures++
    continue
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${cfg.name}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const body = await res.json()
  if (!body.success) {
    console.log(`  FAIL  ${label.padEnd(24)} could not read Pages project "${cfg.name}"`)
    failures++
    continue
  }
  const real = body.result.subdomain
  const custom = body.result.domains || []
  const host = new URL(cfg.siteUrl).host
  const ok = host === real || custom.includes(host)
  if (ok) {
    console.log(`  OK    ${label.padEnd(24)} ${host}`)
  } else {
    console.log(
      `  FAIL  ${label.padEnd(24)} SITE_URL is ${host} but the project serves ${real}` +
        (custom.length ? ` (custom: ${custom.join(', ')})` : '') +
        `\n        Confirmation and reset links would point at a domain this project does not control.`,
    )
    failures++
  }
}

console.log(`\n${failures === 0 ? 'SITE_URL_CHECK=GREEN' : `SITE_URL_CHECK=RED (${failures} wrong)`}`)
process.exit(failures === 0 ? 0 : 1)
