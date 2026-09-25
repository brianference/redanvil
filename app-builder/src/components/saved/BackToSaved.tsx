import { Link } from 'react-router-dom';
import { en } from '../../i18n/en';
import { theme } from '../../theme';
import { buttonStyle } from '../ui';

/**
 * Return link from one saved PRD to the saved list.
 */
export function BackToSaved(): JSX.Element {
  return (
    <p style={{ marginBottom: theme.space.md }}>
      <Link to="/saved" style={buttonStyle(false)}>
        ← {en.pages.savedPrd.backToSaved}
      </Link>
    </p>
  );
}
