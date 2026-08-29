/**
 * Production acceptance probe for a deployed auth kit.
 *
 * Differs from test/acceptance.mjs in one important way: it never registers a
 * fake address. Registration sends a confirmation email, and hard bounces to
 * reserved domains like example.com damage the sending reputation of
 * txeas.com — which every app in this fleet shares. The single registration it
 * does perform uses a real, deliverable plus-tagged address, and the row is
 * reported afterwards so it can be removed.
 *
 * Usage:
 *   BASE_URL=https://sushi-finder.pages.dev COOKIE_NAME=sushi_session \
 *   TEST_EMAIL=someone+sushi@example.org node prod-probe.mjs [--no-register]
 */
const BASE = process.env.BASE_URL
const COOKIE_NAME = process.env.COOKIE_NAME || 'app_session'
const TEST_EMAIL = process.env.TEST_EMAIL
const SKIP_REGISTER = process.argv.includes('--no-register')

if (!BASE) {
  console.error('BASE_URL is required')
  process.exit(2)
}
if (!SKIP_REGISTER && !TEST_EMAIL) {
  console.error('TEST_EMAIL is required unless --no-register is passed')
  process.exit(2)
}

let pass = 0
let fail = 0
const failures = []
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    failures.push(`${name} ${detail}`)
    console.log(`  FAIL  ${name} ${detail}`)
  }
}

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = {}
  if (body) headers['content-type'] = 'application/json'
  if (cookie) headers.cookie = cookie
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* leave null so callers can assert the endpoint returned JSON at all */
  }
  return { status: res.status, json, text, setCookie: res.headers.get('set-cookie') }
}

console.log(`\n== ${BASE} ==`)
console.log('\n-- the handler is real, not an SPA fallback --')
{
  const r = await req('/api/auth/register', { method: 'POST', body: {} })
  check('empty register body returns 400', r.status === 400, `got ${r.status}`)
  check('response is JSON, not an HTML shell', r.json !== null, r.text.slice(0, 80))
  check('400 carries field errors', !!r.json?.fields, JSON.stringify(r.json).slice(0, 120))
}

console.log('\n-- validation --')
{
  const r = await req('/api/auth/register', { method: 'POST', body: { email: 'nope', password: 'short' } })
  check('bad email rejected', !!r.json?.fields?.email, JSON.stringify(r.json?.fields))
  check('short password rejected', !!r.json?.fields?.password, JSON.stringify(r.json?.fields))
}

console.log('\n-- login does not enumerate accounts --')
{
  const a = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'definitely-not-a-user-aaa@example.org', password: 'some-long-password' },
  })
  const b = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'definitely-not-a-user-bbb@example.org', password: 'some-long-password' },
  })
  check('unknown account returns 401', a.status === 401, `got ${a.status}`)
  check('two unknown accounts return identical bodies', a.text === b.text, `${a.text} vs ${b.text}`)
}

console.log('\n-- reset-request does not enumerate (and does not mail an unknown address) --')
{
  const r = await req('/api/auth/password/reset-request', {
    method: 'POST',
    body: { email: 'definitely-not-a-user-ccc@example.org' },
  })
  check('unknown address returns 200', r.status === 200, `got ${r.status}`)
  check('body is the generic ok', r.json?.ok === true, JSON.stringify(r.json))
}

console.log('\n-- confirm rejects a bad token --')
{
  const r = await req('/api/auth/confirm', { method: 'POST', body: { token: 'ff'.repeat(32) } })
  check('garbage confirmation token returns 400', r.status === 400, `got ${r.status}`)
}

console.log('\n-- contact --')
{
  const honey = await req('/api/contact', {
    method: 'POST',
    body: {
      name: 'Bot',
      email: 'bot@example.org',
      subject: 'spam',
      message: 'a long enough message body for the validator',
      website: 'http://spam.example',
    },
  })
  check('honeypot returns a normal 200', honey.status === 200, `got ${honey.status}`)
  const short = await req('/api/contact', {
    method: 'POST',
    body: { name: 'X', email: 'x@example.org', subject: 'Hi', message: 'too short' },
  })
  check('short message rejected', short.status === 400, `got ${short.status}`)
}

console.log('\n-- session --')
{
  const r = await req('/api/auth/session')
  check('anonymous session returns 200', r.status === 200, `got ${r.status}`)
  check('anonymous session email is null', r.json?.email === null, JSON.stringify(r.json))
  check('email delivery is configured (enabled true)', r.json?.enabled === true, JSON.stringify(r.json))
}

if (!SKIP_REGISTER) {
  console.log(`\n-- full round trip with a real deliverable address (${TEST_EMAIL}) --`)
  const password = `probe-${Math.random().toString(36).slice(2)}-${Date.now()}`
  const reg = await req('/api/auth/register', { method: 'POST', body: { email: TEST_EMAIL, password } })
  const alreadyExists = reg.status === 409
  check('register returns 201 (or 409 if a previous probe left the row)', reg.status === 201 || alreadyExists, `got ${reg.status} ${reg.text.slice(0, 140)}`)

  if (reg.status === 201) {
    check('cookie is HttpOnly', /HttpOnly/i.test(reg.setCookie || ''), String(reg.setCookie))
    check('cookie is Secure', /Secure/i.test(reg.setCookie || ''), String(reg.setCookie))
    check('cookie is SameSite=Lax', /SameSite=Lax/i.test(reg.setCookie || ''), String(reg.setCookie))
    check('cookie uses the per-app name', new RegExp(COOKIE_NAME + '=').test(reg.setCookie || ''), String(reg.setCookie))

    const cookie = (reg.setCookie || '').split(';')[0]
    const me = await req('/api/auth/session', { cookie })
    check('session resolves the registered email', me.json?.email === TEST_EMAIL, JSON.stringify(me.json))
    check('newly registered account is unverified', me.json?.emailVerified === false, JSON.stringify(me.json))

    const login = await req('/api/auth/login', { method: 'POST', body: { email: TEST_EMAIL, password } })
    check('login with the same password succeeds', login.status === 200, `got ${login.status}`)

    const out = await req('/api/auth/signout', { method: 'POST', cookie })
    check('signout clears the cookie', /Max-Age=0/.test(out.setCookie || ''), String(out.setCookie))

    console.log(`\n  NOTE: a real account row now exists for ${TEST_EMAIL}. A confirmation email was sent.`)
  } else {
    console.log('  NOTE: account already existed; skipped the session/login assertions.')
  }
}

console.log(`\n${'='.repeat(52)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
if (fail) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
}
console.log(fail === 0 ? 'PROD_PROBE=GREEN' : 'PROD_PROBE=RED')
process.exit(fail === 0 ? 0 : 1)
