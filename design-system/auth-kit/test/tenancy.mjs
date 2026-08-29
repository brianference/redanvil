/**
 * Proves that two apps sharing one D1 database do NOT share user accounts.
 *
 * This is the whole point of the `app` column and the (app, email) unique index.
 * Without them, a single `email unique` constraint silently merges the tenants:
 * registering on one app would either collide with, or hand you access to, an
 * account on its neighbour. Both failure shapes are checked here.
 *
 * Expects two dev servers on the SAME database, with APP.scope set differently.
 *   ALPHA=http://127.0.0.1:8811  BETA=http://127.0.0.1:8812
 */
const ALPHA = process.env.ALPHA || 'http://127.0.0.1:8811'
const BETA = process.env.BETA || 'http://127.0.0.1:8812'
// Cookie names differ per app by design; the harness uses alpha/beta, production
// uses each app's own. Parameterised so this suite runs against either.
const ALPHA_COOKIE = process.env.ALPHA_COOKIE || 'alpha_session'
const BETA_COOKIE = process.env.BETA_COOKIE || 'beta_session'

let pass = 0
let fail = 0
const check = (n, c, d = '') => {
  c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n} ${d}`))
}

async function req(base, path, { method = 'GET', body, cookie } = {}) {
  const headers = {}
  if (body) headers['content-type'] = 'application/json'
  if (cookie) headers.cookie = cookie
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* leave null */
  }
  return { status: res.status, json, text, setCookie: res.headers.get('set-cookie') }
}

// The same address on both apps. This is the case that breaks without scoping.
const email = `shared-${Date.now()}@example.org`
const pwAlpha = 'alpha-password-one-two'
const pwBeta = 'beta-password-three-four'

console.log('\n-- the same email registers independently on each app --')
const rA = await req(ALPHA, '/api/auth/register', { method: 'POST', body: { email, password: pwAlpha } })
check('register on alpha returns 201', rA.status === 201, `got ${rA.status} ${rA.text.slice(0, 140)}`)

const rB = await req(BETA, '/api/auth/register', { method: 'POST', body: { email, password: pwBeta } })
check(
  'the SAME email registers on beta too, not 409',
  rB.status === 201,
  `got ${rB.status} — a 409 means the tenants share one user table and the app column is not being applied`,
)

console.log('\n-- credentials do not cross the tenant boundary --')
{
  const crossed = await req(BETA, '/api/auth/login', { method: 'POST', body: { email, password: pwAlpha } })
  check(
    "alpha's password does NOT sign you in to beta",
    crossed.status === 401,
    `got ${crossed.status} — anything but 401 means one app authenticates another app's user`,
  )
  const crossed2 = await req(ALPHA, '/api/auth/login', { method: 'POST', body: { email, password: pwBeta } })
  check("beta's password does NOT sign you in to alpha", crossed2.status === 401, `got ${crossed2.status}`)
}

console.log('\n-- each app still authenticates its own user --')
{
  const okA = await req(ALPHA, '/api/auth/login', { method: 'POST', body: { email, password: pwAlpha } })
  check('alpha signs in with its own password', okA.status === 200, `got ${okA.status}`)
  const okB = await req(BETA, '/api/auth/login', { method: 'POST', body: { email, password: pwBeta } })
  check('beta signs in with its own password', okB.status === 200, `got ${okB.status}`)

  const cookieA = (okA.setCookie || '').split(';')[0]
  const meA = await req(ALPHA, '/api/auth/session', { cookie: cookieA })
  check('alpha session resolves its own user', meA.json?.email === email, JSON.stringify(meA.json))
  check('alpha uses its own cookie name', new RegExp(ALPHA_COOKIE + '=').test(okA.setCookie || ''), String(okA.setCookie))
  check('beta uses a different cookie name', ALPHA_COOKIE !== BETA_COOKIE && new RegExp(BETA_COOKIE + '=').test(okB.setCookie || ''), String(okB.setCookie))
}

console.log('\n-- a duplicate registration is still refused WITHIN one app --')
{
  const dup = await req(ALPHA, '/api/auth/register', { method: 'POST', body: { email, password: pwAlpha } })
  check('re-registering on alpha returns 409', dup.status === 409, `got ${dup.status}`)
}

console.log('\n-- password reset does not leak across tenants --')
{
  const onlyBeta = `beta-only-${Date.now()}@example.org`
  await req(BETA, '/api/auth/register', { method: 'POST', body: { email: onlyBeta, password: pwBeta } })
  // Both must answer identically; the difference has to be invisible from outside.
  const fromAlpha = await req(ALPHA, '/api/auth/password/reset-request', { method: 'POST', body: { email: onlyBeta } })
  const fromBeta = await req(BETA, '/api/auth/password/reset-request', { method: 'POST', body: { email: onlyBeta } })
  check('alpha returns the generic 200 for an address it does not own', fromAlpha.status === 200, `got ${fromAlpha.status}`)
  check('beta returns the generic 200 too', fromBeta.status === 200, `got ${fromBeta.status}`)
  check('responses are byte-identical', fromAlpha.text === fromBeta.text, `${fromAlpha.text} vs ${fromBeta.text}`)
}

console.log(`\n${'='.repeat(52)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
console.log(fail === 0 ? 'TENANCY=GREEN' : 'TENANCY=RED')
process.exit(fail === 0 ? 0 : 1)
