/**
 * Auth-kit acceptance probe. Exercises the real HTTP surface against a running
 * `wrangler pages dev`, asserting both the success paths AND the failure paths.
 * A run where every assertion passes because nothing was reachable is the exact
 * failure this is written to avoid, so the first assertion proves the server is
 * answering with a real handler rather than the SPA fallback.
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8799'
const COOKIE_NAME = process.env.COOKIE_NAME || 'app_session'
let pass = 0
let fail = 0
const failures = []

function check(name, cond, detail = '') {
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
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  let json = null
  const text = await res.text()
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON: leave null so callers can assert on it */
  }
  return { status: res.status, json, text, setCookie: res.headers.get('set-cookie') }
}

const stamp = Date.now()
const email = `kit-${stamp}@example.com`
const password = 'correct-horse-battery-staple'

console.log('\n== 0. the endpoint is real, not the SPA fallback ==')
{
  const r = await req('/api/auth/register', { method: 'POST', body: {} })
  check('empty register body returns 400 from a real handler', r.status === 400, `got ${r.status}`)
  check('400 body is JSON with field errors', !!r.json?.fields, JSON.stringify(r.json).slice(0, 120))
}

console.log('\n== 1. validation ==')
{
  const r = await req('/api/auth/register', {
    method: 'POST',
    body: { email: 'not-an-email', password: 'short' },
  })
  check('rejects bad email and short password', r.status === 400, `got ${r.status}`)
  check('names the email field', !!r.json?.fields?.email, JSON.stringify(r.json?.fields))
  check('names the password field', !!r.json?.fields?.password, JSON.stringify(r.json?.fields))
}
{
  const r = await req('/api/auth/register', {
    method: 'POST',
    body: { email: `x-${stamp}@example.com`, password: 'elevenchars' },
  })
  check('rejects an 11-character password (12 is the floor)', r.status === 400, `got ${r.status}`)
}

console.log('\n== 2. register ==')
let cookie = null
{
  const r = await req('/api/auth/register', { method: 'POST', body: { email, password } })
  check('register returns 201', r.status === 201, `got ${r.status} ${r.text.slice(0, 160)}`)
  check('register sets a session cookie', !!r.setCookie, String(r.setCookie))
  check('cookie is HttpOnly', /HttpOnly/i.test(r.setCookie || ''), String(r.setCookie))
  check('cookie is SameSite=Lax', /SameSite=Lax/i.test(r.setCookie || ''), String(r.setCookie))
  check('cookie uses the per-app name', new RegExp(COOKIE_NAME + '=').test(r.setCookie || ''), String(r.setCookie))
  check('reports emailVerified false', r.json?.emailVerified === false, JSON.stringify(r.json))
  cookie = (r.setCookie || '').split(';')[0]
}

console.log('\n== 3. session ==')
{
  const anon = await req('/api/auth/session')
  check('anonymous session has null email', anon.json?.email === null, JSON.stringify(anon.json))
  const me = await req('/api/auth/session', { cookie })
  check('cookie session returns the email', me.json?.email === email, JSON.stringify(me.json))
  check('cookie session reports unverified', me.json?.emailVerified === false, JSON.stringify(me.json))
}

console.log('\n== 4. duplicate registration ==')
{
  const r = await req('/api/auth/register', { method: 'POST', body: { email, password } })
  check('second register with same email returns 409', r.status === 409, `got ${r.status}`)
}

console.log('\n== 5. login ==')
{
  const bad = await req('/api/auth/login', { method: 'POST', body: { email, password: 'wrong-password-here' } })
  check('wrong password returns 401', bad.status === 401, `got ${bad.status}`)
  check(
    'wrong-password message does not reveal whether the account exists',
    bad.json?.error === 'That email and password combination did not match.',
    JSON.stringify(bad.json),
  )

  const ghost = await req('/api/auth/login', {
    method: 'POST',
    body: { email: `ghost-${stamp}@example.com`, password: 'wrong-password-here' },
  })
  check('unknown account returns the identical message', ghost.json?.error === bad.json?.error, JSON.stringify(ghost.json))

  const good = await req('/api/auth/login', { method: 'POST', body: { email, password } })
  check('correct password returns 200', good.status === 200, `got ${good.status} ${good.text.slice(0, 160)}`)
  check('login sets a session cookie', !!good.setCookie, String(good.setCookie))
}

console.log('\n== 6. rate limiting ==')
{
  const victim = `rl-${stamp}@example.com`
  await req('/api/auth/register', { method: 'POST', body: { email: victim, password } })
  let sawLimit = false
  let statuses = []
  for (let i = 0; i < 8; i++) {
    const r = await req('/api/auth/login', { method: 'POST', body: { email: victim, password: 'nope-nope-nope' } })
    statuses.push(r.status)
    if (r.status === 429) {
      sawLimit = true
      break
    }
  }
  check('repeated wrong passwords eventually return 429', sawLimit, `statuses ${statuses.join(',')}`)
  const okAfter = await req('/api/auth/login', { method: 'POST', body: { email: victim, password } })
  check('correct password is ALSO blocked while limited (limit is real)', okAfter.status === 429, `got ${okAfter.status}`)
}

console.log('\n== 7. password reset request (no enumeration) ==')
{
  const known = await req('/api/auth/password/reset-request', { method: 'POST', body: { email } })
  const unknown = await req('/api/auth/password/reset-request', {
    method: 'POST',
    body: { email: `nobody-${stamp}@example.com` },
  })
  check('known address returns 200', known.status === 200, `got ${known.status}`)
  check('unknown address returns 200 too', unknown.status === 200, `got ${unknown.status}`)
  check('bodies are byte-identical', known.text === unknown.text, `${known.text} vs ${unknown.text}`)
}

console.log('\n== 8. confirm with a bad token ==')
{
  const r = await req('/api/auth/confirm', { method: 'POST', body: { token: 'deadbeef'.repeat(8) } })
  check('garbage confirmation token returns 400', r.status === 400, `got ${r.status}`)
  const empty = await req('/api/auth/confirm', { method: 'POST', body: {} })
  check('missing confirmation token returns 400', empty.status === 400, `got ${empty.status}`)
}

console.log('\n== 9. contact ==')
{
  const honey = await req('/api/contact', {
    method: 'POST',
    body: {
      name: 'Bot',
      email: `bot-${stamp}@example.com`,
      subject: 'spam',
      message: 'this is a long enough message body',
      website: 'http://spam.example',
    },
  })
  check('honeypot submission returns a normal 200', honey.status === 200, `got ${honey.status}`)

  const real = await req('/api/contact', {
    method: 'POST',
    body: {
      name: 'Real Person',
      email: `person-${stamp}@example.com`,
      subject: 'Hello',
      message: 'This is a genuine message with enough characters.',
    },
  })
  check('genuine submission returns 200', real.status === 200, `got ${real.status}`)

  const short = await req('/api/contact', {
    method: 'POST',
    body: { name: 'X', email: `p2-${stamp}@example.com`, subject: 'Hi', message: 'too short' },
  })
  check('message under 10 chars is rejected', short.status === 400, `got ${short.status}`)
}

console.log('\n== 10. signout ==')
{
  const r = await req('/api/auth/signout', { method: 'POST', cookie })
  check('signout returns 200', r.status === 200, `got ${r.status}`)
  check('signout clears the cookie', /Max-Age=0/.test(r.setCookie || ''), String(r.setCookie))
}

console.log(`\n${'='.repeat(52)}`)
console.log(`PASS ${pass}   FAIL ${fail}`)
if (fail) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
}
// Emit the marker the shell greps for, so a crashed run cannot look like a pass.
console.log(fail === 0 ? 'PROBE_RESULT=GREEN' : 'PROBE_RESULT=RED')
process.exit(fail === 0 ? 0 : 1)
