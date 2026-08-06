/**
 * App-local URL gates for data-driven navigable attributes (u-sec-safe-href).
 *
 * Binding an untrusted string into an anchor without a scheme gate is an XSS
 * sink when the value can be javascript:, data:, protocol-relative hosts, or a
 * scheme with whitespace/case tricks the browser still accepts. Call these
 * before rendering an anchor; when they return null, render no element.
 */

/**
 * Accept only absolute http: or https: URLs. Everything else is null.
 *
 * @param value - Untrusted string from data, API, or query.
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
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Safe value for any href: same-origin relative path/hash, or absolute http(s).
 *
 * @param value - Untrusted string from data, API, or query.
 * @returns A safe href string, or null.
 */
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('//')) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }
  return safeHttpUrl(trimmed);
}
