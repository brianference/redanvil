import { Link } from 'react-router-dom';
import { EmptyState } from '../components/states';
import { en } from '../i18n/en';

/** Client 404 for unknown SPA routes. */
export function NotFoundPage(): JSX.Element {
  return (
    <main id="main">
      <h1 className="page-title">{en.notFound.title}</h1>
      <EmptyState
        message={en.notFound.body}
        action={
          <Link className="btn btn--primary" to="/">
            {en.notFound.home}
          </Link>
        }
      />
    </main>
  );
}
