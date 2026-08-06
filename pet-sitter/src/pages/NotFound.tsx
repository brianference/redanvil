import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { en } from '../i18n/en';

/** Client 404 with a path back home. */
export function NotFound(): JSX.Element {
  return (
    <Page title={en.notFound.title}>
      <p className="state state--empty">{en.notFound.body}</p>
      <p>
        <Link to="/">{en.notFound.home}</Link>
      </p>
    </Page>
  );
}
