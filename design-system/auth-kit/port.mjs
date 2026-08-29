#!/usr/bin/env node
/**
 * Copy the auth kit into an app, deterministically.
 *
 * Everything here is mechanical on purpose: file copies, one generated config,
 * one migration, one `[vars]` block. Anything requiring judgement about the app
 * (its profile screen, its own feature, its outbound email) is deliberately NOT
 * done here.
 *
 * Usage:
 *   node port.mjs --app <dir> --name "Sushi Finder" --cookie sushi_session \
 *        --site https://sushi-finder.pages.dev --brand '#0f766e' \
 *        --text '#16122b' --muted '#5b5878' --purpose "..." [--dry]
 */
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const opt = (flag, fallback = null) => {
  const i = args.indexOf(flag)
  return i === -1 ? fallback : args[i + 1]
}
const DRY = args.includes('--dry')

const app = opt('--app')
const name = opt('--name')
const cookie = opt('--cookie')
const site = opt('--site')
const brand = opt('--brand', '#c45c26')
const text = opt('--text', '#2a1c14')
const muted = opt('--muted', '#8a7365')
const purpose = opt('--purpose', '')
const contactTo = opt('--contact-to', 'brianference@protonmail.com')

for (const [flag, value] of [['--app', app], ['--name', name], ['--cookie', cookie], ['--site', site]]) {
  if (!value) {
    console.error(`missing required ${flag}`)
    process.exit(2)
  }
}
if (!existsSync(app)) {
  console.error(`app dir does not exist: ${app}`)
  process.exit(2)
}
// A shared cookie name across *.pages.dev would let one app read another's session.
if (!/^[a-z0-9_]+_session$/.test(cookie)) {
  console.error(`cookie name must match ^[a-z0-9_]+_session$, got ${cookie}`)
  process.exit(2)
}

const steps = []
const write = (path, body) => {
  steps.push(`write   ${path.replace(app, '.')}`)
  if (!DRY) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, body, 'utf8')
  }
}
const copy = (from, to) => {
  steps.push(`copy    ${to.replace(app, '.')}`)
  if (!DRY) {
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
  }
}

// 1. Library files. appconfig.ts is generated, never copied.
for (const f of readdirSync(join(KIT, 'functions/_lib'))) {
  if (f === 'appconfig.ts') continue
  copy(join(KIT, 'functions/_lib', f), join(app, 'functions/_lib', f))
}

// 2. Endpoints.
for (const f of readdirSync(join(KIT, 'functions/api/auth')).filter((f) => f.endsWith('.ts'))) {
  copy(join(KIT, 'functions/api/auth', f), join(app, 'functions/api/auth', f))
}
for (const f of readdirSync(join(KIT, 'functions/api/auth/password'))) {
  copy(join(KIT, 'functions/api/auth/password', f), join(app, 'functions/api/auth/password', f))
}
copy(join(KIT, 'functions/api/contact.ts'), join(app, 'functions/api/contact.ts'))

// 3. The one file that differs per app.
write(
  join(app, 'functions/_lib/appconfig.ts'),
  `/**
 * The only file that changes when the auth kit is ported to a new app.
 * See RedAnvil/design-system/auth-kit/README.md.
 */
export type AppConfig = {
  name: string
  cookieName: string
  brandColor: string
  textColor: string
  mutedColor: string
  accountPurpose: string
}

export const APP: AppConfig = {
  name: '${name.replace(/'/g, "\\'")}',
  // Unique per app: a shared cookie name under *.pages.dev would let one app
  // receive another app's session.
  cookieName: '${cookie}',
  brandColor: '${brand}',
  textColor: '${text}',
  mutedColor: '${muted}',
  accountPurpose:
    '${purpose.replace(/'/g, "\\'")}',
}
`,
)

// 4. Migration, numbered after whatever the app already has.
const migDir = join(app, 'migrations')
mkdirSync(migDir, { recursive: true })
const existing = readdirSync(migDir).filter((f) => /^\d{4}_.*\.sql$/.test(f))
const alreadyPorted = existing.find((f) => f.endsWith('_auth_core.sql'))
if (alreadyPorted) {
  steps.push(`skip    migrations/${alreadyPorted} (already present)`)
} else {
  const next = String(
    existing.reduce((max, f) => Math.max(max, parseInt(f.slice(0, 4), 10)), 0) + 1,
  ).padStart(4, '0')
  copy(join(KIT, 'migrations/0001_auth_core.sql'), join(migDir, `${next}_auth_core.sql`))
}

// 5. wrangler [vars]. Never touch an existing block: it may hold app config that
// would be dropped, because [vars] is replace-not-merge.
const wranglerPath = join(app, 'wrangler.toml')
if (!existsSync(wranglerPath)) {
  steps.push('WARN    no wrangler.toml — SITE_URL/MAIL_FROM/CONTACT_TO must be set by hand')
} else {
  const current = readFileSync(wranglerPath, 'utf8')
  if (current.includes('[vars]')) {
    const missing = ['SITE_URL', 'MAIL_FROM', 'CONTACT_TO'].filter((k) => !current.includes(k))
    steps.push(
      missing.length
        ? `WARN    [vars] exists but is missing ${missing.join(', ')} — add by hand, do not overwrite the block`
        : 'skip    [vars] already complete',
    )
  } else {
    const block = `
# Plain-text configuration. NOTE: [vars] is replace-not-merge: any var missing
# from this block is dropped from the deployment. Secrets (BREVO_API_KEY,
# RATE_LIMIT_SALT) are set with \`wrangler pages secret put\` and never appear here.
[vars]
SITE_URL   = "${site}"
MAIL_FROM  = "no-reply@txeas.com"
CONTACT_TO = "${contactTo}"
`
    steps.push('append  wrangler.toml [vars]')
    if (!DRY) writeFileSync(wranglerPath, current.trimEnd() + '\n' + block, 'utf8')
  }
}

// 6. zod is imported by validate.ts.
const pkgPath = join(app, 'package.json')
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const hasZod = pkg.dependencies?.zod || pkg.devDependencies?.zod
  steps.push(hasZod ? 'ok      zod already a dependency' : 'TODO    zod is NOT a dependency — run: npm i zod')
}

console.log(`${DRY ? 'DRY RUN' : 'PORTED'}: ${name} -> ${app}`)
for (const s of steps) console.log('  ' + s)
