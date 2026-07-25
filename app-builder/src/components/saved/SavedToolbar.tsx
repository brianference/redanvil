import { Link } from 'react-router-dom';
import { en } from '../../i18n/en';
import { buttonStyle } from '../ui';
import { toolbarStyle } from './styles';

/**
 * Saved page toolbar with the primary "new build" action.
 */
export function SavedToolbar(): JSX.Element {
  const copy = en.pages.saved;
  return (
    <div style={toolbarStyle}>
      <Link to="/" style={buttonStyle(true)}>
        <span aria-hidden="true">+</span>
        {copy.newBuild}
      </Link>
    </div>
  );
}
