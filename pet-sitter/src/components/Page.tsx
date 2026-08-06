import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { en } from '../i18n/en';
import { ROUTES } from '../lib/routes';
import { theme } from '../theme';
import { ThemeToggle } from './ThemeToggle';

export interface PageProps {
  /** Page title, rendered as the single h1. */
  title: string;
  /** Page body. */
  children: ReactNode;
}

/** Shared page shell: sticky header, primary nav, one h1, professional footer. */
export function Page({ title, children }: PageProps): JSX.Element {
  return (
    <div>
      <header
        style={{
          position: 'sticky',
          top: 0,
          display: 'flex',
          alignItems: 'center',
          gap: theme.space.md,
          padding: theme.space.md,
          background: theme.color.surface,
          borderBottom: '1px solid ' + theme.color.border
        }}
      >
        <Link
          data-testid="brand"
          to="/"
          style={{ color: theme.color.text, fontWeight: 700, textDecoration: 'none' }}
        >
          {en.app.name}
        </Link>
        <nav aria-label={en.app.primaryNav}>
          <ul style={{ display: 'flex', gap: theme.space.md, listStyle: 'none', margin: 0, padding: 0 }}>
            {ROUTES.map((route) => (
              <li key={route.path}>
                <NavLink
                  data-testid="nav-link"
                  to={route.path}
                  style={({ isActive }) => ({
                    color: isActive ? theme.color.text : theme.color.muted,
                    // fe-noncolor-state: the active page is underlined as
                    // well as recoloured, so the state survives a colour
                    // vision difference and a greyscale screenshot.
                    textDecoration: isActive ? 'underline' : 'none',
                    // R1.1: a 44px touch target, not a bare text link.
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center'
                  })}
                >
                  {route.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div style={{ marginLeft: 'auto' }}>
          <ThemeToggle />
        </div>
      </header>
      <main>
        <h1>{title}</h1>
        {children}
      </main>
      <footer>
        <small>{en.app.footerCopyright}</small>
      </footer>
    </div>
  );
}
