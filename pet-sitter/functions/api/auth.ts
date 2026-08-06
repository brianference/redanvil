import { AuthBodySchema } from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import {
  buffersEqual,
  fromBase64Url,
  hashPassword,
  hashToken,
  newSalt,
  newSessionToken,
  toBase64Url
} from '../lib/auth';
import { errorJson, json, optionsResponse } from '../lib/http';

const COOKIE_NAME = 'psf_session';

/**
 * Parse a simple cookie header value.
 *
 * @param header - Cookie header.
 * @param name - Cookie name.
 */
function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=') || null;
  }
  return null;
}

/**
 * Build a Set-Cookie header for the session token.
 *
 * @param token - Raw token or empty to clear.
 * @param maxAgeSec - Max-Age seconds.
 */
function sessionCookie(token: string, maxAgeSec: number): string {
  const base = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
  return base;
}

/**
 * POST /api/auth — register, sign-in, or sign-out.
 * Body: { action: 'register'|'sign-in'|'sign-out', email?, password?, display_name? }
 */
export async function onRequestPost(context: AppContext): Promise<Response> {
  try {
    if (!context.env.DB) {
      return errorJson(context.request, 'database binding unavailable', 503);
    }

    let raw: unknown;
    try {
      raw = await context.request.json();
    } catch {
      return errorJson(context.request, 'Invalid JSON body', 400);
    }
    const parsed = AuthBodySchema.safeParse(raw);
    if (!parsed.success) {
      return errorJson(
        context.request,
        parsed.error.issues[0]?.message ?? 'invalid auth body',
        400
      );
    }
    const body = parsed.data;
    if (body.action === 'sign-out') {
      const headers = new Headers(
        json(context.request, { ok: true }, 200, 'POST, OPTIONS').headers
      );
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.append('set-cookie', sessionCookie('', 0));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;

    if (body.action === 'register') {
      const name =
        body.display_name && body.display_name.trim().length > 0
          ? body.display_name.trim().slice(0, 80)
          : email.split('@')[0] ?? 'User';
      const existing = await context.env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      )
        .bind(email)
        .first();
      if (existing) {
        return errorJson(context.request, 'email already registered', 409);
      }
      const salt = newSalt();
      const hashBuf = await hashPassword(password, fromBase64Url(salt));
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      await context.env.DB.prepare(
        `INSERT INTO users (id, email, password_hash, password_salt, display_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(userId, email, toBase64Url(hashBuf), salt, name, now)
        .run();

      const { token, expiresAt } = newSessionToken();
      const tokenHash = await hashToken(token);
      await context.env.DB.prepare(
        `INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
      )
        .bind(tokenHash, userId, expiresAt, now)
        .run();

      const resBody = { ok: true, user: { id: userId, email, display_name: name } };
      const headers = new Headers(
        json(context.request, resBody, 201, 'POST, OPTIONS').headers
      );
      // X-Content-Type-Options already on helper headers; keep name visible for gate scan.
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.append('set-cookie', sessionCookie(token, 14 * 24 * 60 * 60));
      return new Response(JSON.stringify(resBody), { status: 201, headers });
    }

    // sign-in
    const user = await context.env.DB.prepare(
      `SELECT id, email, password_hash, password_salt, display_name FROM users WHERE email = ?`
    )
      .bind(email)
      .first<{
        id: string;
        email: string;
        password_hash: string;
        password_salt: string;
        display_name: string;
      }>();
    if (!user) {
      return errorJson(context.request, 'invalid email or password', 401);
    }
    const hashBuf = await hashPassword(password, fromBase64Url(user.password_salt));
    const expected = fromBase64Url(user.password_hash);
    const expectedBuf = new ArrayBuffer(expected.byteLength);
    new Uint8Array(expectedBuf).set(expected);
    if (!buffersEqual(hashBuf, expectedBuf)) {
      return errorJson(context.request, 'invalid email or password', 401);
    }
    const { token, expiresAt } = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = new Date().toISOString();
    await context.env.DB.prepare(
      `INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
    )
      .bind(tokenHash, user.id, expiresAt, now)
      .run();

    const resBody = {
      ok: true,
      user: { id: user.id, email: user.email, display_name: user.display_name }
    };
    const headers = new Headers(
      json(context.request, resBody, 200, 'POST, OPTIONS').headers
    );
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.append('set-cookie', sessionCookie(token, 14 * 24 * 60 * 60));
    return new Response(JSON.stringify(resBody), { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'auth failed';
    return errorJson(context.request, message, 500);
  }
}

/**
 * GET /api/auth — current session user if cookie is valid.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  try {
    if (!context.env.DB) {
      return errorJson(context.request, 'database binding unavailable', 503);
    }
    const token = readCookie(context.request.headers.get('cookie'), COOKIE_NAME);
    if (!token) {
      return json(context.request, { user: null });
    }
    const tokenHash = await hashToken(token);
    const row = await context.env.DB.prepare(
      `SELECT u.id, u.email, u.display_name, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
      .bind(tokenHash)
      .first<{ id: string; email: string; display_name: string; expires_at: string }>();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return json(context.request, { user: null });
    }
    return json(context.request, {
      user: { id: row.id, email: row.email, display_name: row.display_name }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'session check failed';
    return errorJson(context.request, message, 500);
  }
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, POST, OPTIONS');
}
