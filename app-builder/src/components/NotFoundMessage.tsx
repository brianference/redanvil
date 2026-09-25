import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { buttonStyle } from './ui';

/**
 * Why the page is empty, and the way back to the builder.
 */
export function NotFoundMessage(): JSX.Element {
  const copy = en.pages.notFound;
  return (
    <>
      <p style={bodyStyle}>{copy.body}</p>
      <Link to="/" style={homeLinkStyle}>
        {copy.home}
      </Link>
    </>
  );
}

const bodyStyle: CSSProperties = {
  color: theme.color.muted,
  fontSize: theme.type.scale[3],
  margin: 0
};

const homeLinkStyle: CSSProperties = {
  ...buttonStyle(true),
  textDecoration: 'none',
  width: 'fit-content',
  marginTop: theme.space.lg
};
