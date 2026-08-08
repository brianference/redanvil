import { Link } from 'react-router-dom';
import { en } from '../i18n/en';

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Breadcrumb nav for inner/detail pages.
 * Uses spans (not list items) so collection listitem queries stay pure.
 *
 * @param props - Crumb trail.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }): JSX.Element {
  return (
    <nav className="breadcrumbs" aria-label={en.breadcrumb.nav}>
      <div className="breadcrumbs__trail">
        {items.map((item, index) => (
          <span key={`${item.label}-${item.to ?? 'current'}`} className="breadcrumbs__item">
            {index > 0 ? <span className="breadcrumbs__sep" aria-hidden="true"> / </span> : null}
            {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </span>
        ))}
      </div>
    </nav>
  );
}
