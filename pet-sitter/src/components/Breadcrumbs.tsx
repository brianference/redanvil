import { Link, useLocation } from 'react-router-dom';
import { en } from '../i18n/en';

/**
 * Breadcrumb trail for inner pages. Home is always the root parent.
 */
export function Breadcrumbs(): JSX.Element | null {
  const location = useLocation();
  const path = location.pathname;
  if (path === '/' || path === '') return null;

  const segments = path.split('/').filter(Boolean);
  const crumbs: Array<{ label: string; to: string }> = [
    { label: en.nav.home, to: '/' }
  ];

  if (segments[0] === 'sitters') {
    crumbs.push({ label: en.nav.sitters, to: '/sitters' });
    if (segments[1]) {
      crumbs.push({ label: en.nav.sitterDetail, to: path });
    }
  } else if (segments[0] === 'about') {
    crumbs.push({ label: en.nav.about, to: '/about' });
  } else if (segments[0] === 'terms') {
    crumbs.push({ label: en.nav.terms, to: '/terms' });
  } else if (segments[0] === 'privacy') {
    crumbs.push({ label: en.nav.privacy, to: '/privacy' });
  } else if (segments[0] === 'contact') {
    crumbs.push({ label: en.nav.contact, to: '/contact' });
  } else if (segments[0] === 'login') {
    crumbs.push({ label: en.nav.login, to: '/login' });
  } else {
    crumbs.push({ label: segments[0] ?? path, to: path });
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs__list">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.to + c.label} className="breadcrumbs__item">
              {last ? (
                <span aria-current="page">{c.label}</span>
              ) : (
                <Link to={c.to}>{c.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
