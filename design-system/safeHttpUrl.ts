/**
 * Shared URL gates for data-driven href/src attributes.
 *
 * A bare `href={row.url}` is an XSS sink when the value can be `javascript:`,
 * `data:`, protocol-relative `//evil`, or a scheme with whitespace/case tricks
 * the browser still accepts. Call these before rendering an anchor or remote
 * resource; when they return null, render no element.
 *
 * Single implementation for every RedAnvil app and the scaffold copy — four
 * local copies is how validators drift.
 */

/**
 * Accept only absolute http: or https: URLs. Everything else is null.
 *
 * Uses the URL parser (not a regex) so leading whitespace, mixed case schemes,
 * tabs/newlines inside the scheme, `javascript:`, `data:`, and protocol-relative
 * `//host` values cannot slip through.
 *
 * Use for external / new-tab links. For same-origin paths prefer {@link safeHref}.
 *
 * @param value - Untrusted string (or anything) from data, API, or query.
 * @returns The normalised absolute href when safe, otherwise null.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    // Parser already accepted the scheme; return the trimmed input so we do not
    // rewrite path shape (URL.href would force a trailing slash on bare hosts).
    return trimmed;
  } catch {
    // Protocol-relative (`//evil.example`), bare paths, and junk throw here.
    return null;
  }
}

/**
 * Safe value for any `href` (or non-remote `src`): same-origin relative path
 * or hash, OR absolute http(s). Rejects protocol-relative `//`, `javascript:`,
 * `data:`, and other schemes.
 *
 * Relative paths starting with `/` or `#` cannot introduce a foreign scheme
 * (a path like `/javascript:alert(1)` is still a path, not a scheme handler).
 * Protocol-relative `//evil` is rejected explicitly.
 *
 * @param value - Untrusted string from data, API, or query.
 * @returns A safe href string, or null.
 */
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  // Protocol-relative URLs inherit the page scheme and point at an attacker host.
  if (trimmed.startsWith('//')) return null;
  // Same-origin relative path or fragment — no scheme to hijack.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }
  return safeHttpUrl(trimmed);
}

/**
 * Alias kept for dashboard and older call sites that already imported `safeUrl`.
 *
 * @param value - Untrusted value.
 * @returns Safe absolute http(s) href or null.
 */
export function safeUrl(value: unknown): string | null {
  return safeHttpUrl(value);
}
