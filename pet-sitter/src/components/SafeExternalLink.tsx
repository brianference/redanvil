/**
 * Anchor that only mounts when `href` is a safe http(s) URL (u-sec-safe-href).
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { safeHttpUrl } from '../lib/safeHttpUrl';

export interface SafeExternalLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Untrusted URL from data, API, or user input. */
  href: unknown;
  /** Link contents. */
  children: ReactNode;
}

/**
 * Render an external `<a>` only when `href` passes {@link safeHttpUrl}.
 *
 * @param props - Anchor props; `href` is validated before use.
 * @returns An anchor element, or null when the URL is not safe http(s).
 */
export function SafeExternalLink({
  href,
  children,
  rel = 'noopener noreferrer',
  target = '_blank',
  ...rest
}: SafeExternalLinkProps): JSX.Element | null {
  const safe = safeHttpUrl(href);
  if (safe === null) return null;
  return (
    <a href={safe} rel={rel} target={target} {...rest}>
      {children}
    </a>
  );
}
