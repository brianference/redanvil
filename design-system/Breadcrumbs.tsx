/**
 * Shared with every RedAnvil app.
 *
 * The trail markup is identical; only palette tokens and the Home / nav labels
 * differ. Apps pass those in so each site keeps its own copy and theme.
 */
import React, { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

/** Palette and metrics the breadcrumb trail needs. */
export interface BreadcrumbTokens {
  /** Space below the trail. */
  marginBottom: number;
  /** Gap between trail items. */
  gap: number;
  /** Body type size, px. */
  fontSize: number;
  /** Minimum touch target height for the Home link. */
  touch: number;
  /** Muted colour for Home and separators. */
  muted: string;
  /** Primary colour for the current page. */
  text: string;
}

/** Copy strings the trail shows. */
export interface BreadcrumbCopy {
  /** Accessible name for the nav landmark. */
  navLabel: string;
  /** Label for the Home link. */
  homeLabel: string;
}

export interface BreadcrumbsProps {
  /** Current page label (not linked). */
  current: string;
  /** Palette and metrics. */
  tokens: BreadcrumbTokens;
  /** App-specific labels. */
  copy: BreadcrumbCopy;
}

/**
 * Inner-page trail: Home / &lt;page&gt;. Home links to /.
 */
export function Breadcrumbs({ current, tokens, copy }: BreadcrumbsProps): JSX.Element {
  const navStyle: CSSProperties = {
    marginBottom: tokens.marginBottom,
    fontSize: tokens.fontSize,
    lineHeight: 1.5
  };

  const listStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.gap,
    listStyle: 'none',
    margin: 0,
    padding: 0
  };

  const sepStyle: CSSProperties = {
    color: tokens.muted,
    userSelect: 'none'
  };

  const currentStyle: CSSProperties = {
    color: tokens.text,
    fontWeight: 500
  };

  return (
    <nav aria-label={copy.navLabel} style={navStyle}>
      <ol style={listStyle}>
        <li>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: tokens.touch,
              color: tokens.muted,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              fontSize: tokens.fontSize
            }}
          >
            {copy.homeLabel}
          </Link>
        </li>
        <li aria-hidden="true" style={sepStyle}>
          /
        </li>
        <li style={currentStyle} aria-current="page">
          {current}
        </li>
      </ol>
    </nav>
  );
}
