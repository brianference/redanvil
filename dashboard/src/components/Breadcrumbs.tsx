import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { en } from '../i18n/en';
import { theme } from '../theme';

export interface BreadcrumbsProps {
  /** Current page label (not linked). */
  current: string;
}

const navStyle: CSSProperties = {
  marginBottom: theme.space.md,
  fontSize: theme.type.scale[1],
  lineHeight: 1.5
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.xs,
  listStyle: 'none',
  margin: 0,
  padding: 0
};

const sepStyle: CSSProperties = {
  color: theme.color.muted,
  userSelect: 'none'
};

const currentStyle: CSSProperties = {
  color: theme.color.text,
  fontWeight: 500
};

/**
 * Inner-page trail: Home / &lt;page&gt;. Home links to /.
 */
export function Breadcrumbs({ current }: BreadcrumbsProps): JSX.Element {
  return (
    <nav aria-label={en.app.breadcrumbNav} style={navStyle}>
      <ol style={listStyle}>
        <li>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: theme.touch,
              color: theme.color.muted,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              fontSize: theme.type.scale[2]
            }}
          >
            {en.app.breadcrumbHome}
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
