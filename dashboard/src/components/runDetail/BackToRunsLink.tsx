import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { en } from '../../i18n/en';
import { theme } from '../../theme';
import { linkStyle } from './styles';

const recoveryLinkStyle: CSSProperties = {
  ...linkStyle,
  marginTop: theme.space.md,
  fontWeight: 600
};

export interface BackToRunsLinkProps {
  /** Link text; defaults to the run-detail copy. */
  label?: string;
}

/**
 * Recovery link back to the run list (used on not-found / error, and on the
 * 404 page with its own label).
 *
 * @returns The link.
 */
export function BackToRunsLink({
  label = en.runDetail.backToRuns
}: BackToRunsLinkProps): JSX.Element {
  return (
    <Link to="/" style={recoveryLinkStyle}>
      {label}
    </Link>
  );
}
