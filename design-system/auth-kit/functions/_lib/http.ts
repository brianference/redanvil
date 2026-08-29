/** JSON/cookie helpers for Pages Functions. */
import { APP } from './appconfig'

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

export function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') || ''
  const m = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'))
  return m && m[1] ? decodeURIComponent(m[1]) : null
}

/**
 * Per-app, from appconfig. Several of these apps deploy to *.pages.dev; a shared
 * cookie name on a shared parent domain would let one app receive another's session.
 */
const COOKIE_NAME = APP.cookieName

export function sessionCookie(id: string, maxAgeSeconds: number): string {
  return [
    `${COOKIE_NAME}=${id}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ')
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export function readSessionId(request: Request): string | null {
  return readCookie(request, COOKIE_NAME)
}
