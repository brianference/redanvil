import { Link, useLocation } from 'react-router-dom';
import { en } from '../i18n/en';
import './Breadcrumbs.css';

/**
 * Map a path segment to a human label.
 *
 * @param segment - URL path segment.
 * @returns Display label.
 */
function labelForSegment(segment: string): string {
  if (segment === 'grid') return en.nav.grid;
  if (segment === 'about') return en.nav.about;
  if (segment === 'terms') return en.nav.terms;
  if (segment === 'privacy') return en.nav.privacy;
  if (segment === 'contact') return en.nav.contact;
  if (segment === 'crop') return en.detail.back.replace(/back to home/i, 'Crop').trim() || 'Crop';
  // Crop id: humanize crop-tomatoes → Tomatoes
  if (segment.startsWith('crop-')) {
    return segment
      .replace(/^crop-/, '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return segment;
}

/**
 * Breadcrumb nav for inner and detail routes (not home).
 * Accessible name matches /breadcrumb/i; always includes a parent link.
 */
export function Breadcrumbs() {
  const location = useLocation();
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return null;

  const parts = path.split('/').filter(Boolean);
  /** Crumb trail: home always first, then each segment. */
  const crumbs: Array<{ to: string; label: string; current: boolean }> = [
    { to: '/', label: en.nav.home, current: false }
  ];
  let acc = '';
  for (let i = 0; i < parts.length; i += 1) {
    const seg = parts[i] ?? '';
    acc += `/${seg}`;
    crumbs.push({
      to: acc,
      label: labelForSegment(seg),
      current: i === parts.length - 1
    });
  }

  return (
    <nav className="breadcrumbs shell" aria-label="Breadcrumb" data-testid="breadcrumbs">
      <ol className="breadcrumbs__list">
        {crumbs.map((crumb, index) => (
          <li key={crumb.to} className="breadcrumbs__item">
            {index > 0 ? (
              <span className="breadcrumbs__sep" aria-hidden="true">
                /
              </span>
            ) : null}
            {crumb.current ? (
              <span className="breadcrumbs__current" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link className="breadcrumbs__link" to={crumb.to}>
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
