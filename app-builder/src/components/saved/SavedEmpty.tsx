import { Link } from 'react-router-dom';
import { en } from '../../i18n/en';
import { buttonStyle } from '../ui';
import { emptyBodyStyle, emptyCardStyle, emptyCtaStyle, emptyTitleStyle } from './styles';

/**
 * Empty-state card when the user has no saved PRDs yet.
 */
export function SavedEmpty(): JSX.Element {
  const copy = en.pages.saved;
  return (
    <div role="status" style={emptyCardStyle}>
      <p style={emptyTitleStyle}>{copy.empty}</p>
      <p style={emptyBodyStyle}>{copy.emptyHint}</p>
      <Link to="/" style={{ ...buttonStyle(true), ...emptyCtaStyle }}>
        {copy.emptyCta}
      </Link>
    </div>
  );
}
