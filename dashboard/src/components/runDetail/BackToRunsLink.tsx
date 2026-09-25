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

/**
 * Recovery link back to the run list (used on not-found / error).
 *
 * @returns The link.
 */
export function BackToRunsLink(): JSX.Element {
  return (
    <Link to="/" style={recoveryLinkStyle}>
      {en.runDetail.backToRuns}
    </Link>
  );
}
