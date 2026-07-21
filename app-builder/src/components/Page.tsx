import type { ReactNode } from 'react';
import { en } from '../i18n/en';

export interface PageProps {
  /** Page title, rendered as the single h1. */
  title: string;
  /** Page body. */
  children: ReactNode;
}

/** Shared page shell: sticky header, one h1, professional footer. */
export function Page({ title, children }: PageProps): JSX.Element {
  return (
    <div>
      <header style={{ position: 'sticky', top: 0 }}>
        <nav aria-label={en.app.primaryNav}>{en.app.name}</nav>
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
