/**
 * Shared with every RedAnvil app.
 *
 * Multi-column footer chrome is identical; product/company/legal link lists,
 * tagline, copyright, and optional quality line are app content.
 */
import React, { type CSSProperties, type ReactNode } from 'react';

/** One footer link. */
export interface FooterLink {
  label: string;
  href: string;
}

/** One labeled column of footer links. */
export interface FooterColumn {
  heading: string;
  links: readonly FooterLink[];
}

/** Palette and metrics the footer needs. */
export interface FooterTokens {
  border: string;
  surface: string;
  text: string;
  muted: string;
  spaceSm: number;
  spaceMd: number;
  spaceLg: number;
  spaceXl: number;
  touch: number;
  fontBody: number;
  fontSmall: number;
}

export interface FooterProps {
  /** Palette and spacing. */
  tokens: FooterTokens;
  /** Shared max-width column style (main/footer align). */
  shellContainer: CSSProperties;
  /** Brand mark + optional height already applied by the app. */
  logo: ReactNode;
  /** Short brand blurb under the logo. */
  tagline: string;
  /** Product / company / legal columns. */
  columns: readonly FooterColumn[];
  /** Copyright line (already resolved for the current year if needed). */
  copyright: string;
  /** Optional secondary quality line (app-builder only). */
  quality?: string;
  /** When true, pad the legal bar for the iOS home indicator (app-builder). */
  safeAreaBottom?: boolean;
}

/**
 * One labeled column of footer links (≥44px targets, ≥8px gap).
 */
function FooterCol({
  heading,
  links,
  tokens
}: {
  heading: string;
  links: readonly FooterLink[];
  tokens: FooterTokens;
}): JSX.Element {
  return (
    <div>
      <p
        style={{
          color: tokens.text,
          fontSize: tokens.fontBody,
          fontWeight: 600,
          margin: `0 0 ${tokens.spaceSm}px`
        }}
      >
        {heading}
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: tokens.spaceSm
        }}
      >
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: tokens.touch,
                color: tokens.muted,
                textDecoration: 'none',
                fontSize: tokens.fontBody
              }}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Multi-column site footer: brand tagline, product/company/legal links, copyright.
 */
export function Footer({
  tokens,
  shellContainer,
  logo,
  tagline,
  columns,
  copyright,
  quality,
  safeAreaBottom = false
}: FooterProps): JSX.Element {
  return (
    <footer
      style={{
        borderTop: `1px solid ${tokens.border}`,
        background: `color-mix(in srgb, ${tokens.surface} 50%, transparent)`,
        marginTop: tokens.spaceXl
      }}
    >
      <div
        className="ra-footer-grid"
        style={{
          ...shellContainer,
          padding: `${tokens.spaceXl}px ${tokens.spaceLg}px`
        }}
      >
        <div className="ra-footer-brand">
          {logo}
          <p
            className="ra-footer-tagline"
            style={{
              color: tokens.muted,
              fontSize: tokens.fontBody,
              marginTop: tokens.spaceSm,
              lineHeight: 1.5
            }}
          >
            {tagline}
          </p>
        </div>
        <div className="ra-footer-cols">
          {columns.map((col) => (
            <FooterCol key={col.heading} heading={col.heading} links={col.links} tokens={tokens} />
          ))}
        </div>
      </div>
      <div
        style={{
          borderTop: `1px solid ${tokens.border}`,
          ...(safeAreaBottom ? { paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : {})
        }}
      >
        <div
          style={{
            ...shellContainer,
            padding: `${tokens.spaceMd}px ${tokens.spaceLg}px`,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: tokens.spaceSm
          }}
        >
          <small style={{ color: tokens.muted, fontSize: tokens.fontSmall }}>{copyright}</small>
          {quality !== undefined && (
            <small style={{ color: tokens.muted, fontSize: tokens.fontSmall }}>{quality}</small>
          )}
        </div>
      </div>
    </footer>
  );
}
