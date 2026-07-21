import type { CSSProperties, ReactNode } from 'react';
import { theme } from '../theme';
import { AnvilMark } from './AnvilMark';

export interface PageProps {
  /** Page title, rendered as the single h1. */
  title: string;
  /** Optional hero subtitle under the h1. */
  subtitle?: string;
  /** Page body. */
  children: ReactNode;
}

const APP_URL = 'https://redanvil.pages.dev';
const DASHBOARD_URL = 'https://redanvil-dashboard.pages.dev';
const GITHUB_URL = 'https://github.com/brianference/redanvil';

const shell: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: `radial-gradient(1200px 600px at 50% -200px, ${theme.color.surface}, ${theme.color.bg})`,
  color: theme.color.text,
  fontFamily: theme.type.family
};

const bar: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  backdropFilter: 'blur(10px)',
  background: `${theme.color.surface}cc`,
  borderBottom: `1px solid ${theme.color.border}`
};

const container: CSSProperties = { width: '100%', maxWidth: '68rem', margin: '0 auto', padding: `0 ${theme.space.lg}px` };

const navLink = (active = false): CSSProperties => ({
  color: active ? theme.color.text : theme.color.muted,
  textDecoration: 'none',
  fontSize: theme.type.scale[1],
  fontWeight: active ? 600 : 400,
  padding: `${theme.space.xs}px ${theme.space.xs}px`,
  borderRadius: theme.radius.sm,
  whiteSpace: 'nowrap'
});

/** Site logo: an accent anvil mark plus the RedAnvil wordmark. */
function Logo(): JSX.Element {
  return (
    <a href={APP_URL} style={{ display: 'flex', alignItems: 'center', gap: theme.space.sm, textDecoration: 'none' }}>
      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 32,
          height: 32,
          borderRadius: theme.radius.sm,
          background: theme.color.accent,
          color: theme.color.text
        }}
      >
        <AnvilMark />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <strong style={{ color: theme.color.text, fontSize: theme.type.scale[2] }}>RedAnvil</strong>
        <span className="ra-logo-tag" style={{ color: theme.color.muted, fontSize: theme.type.scale[0] }}>App Builder</span>
      </span>
    </a>
  );
}

/** Shared page shell: sticky header with logo + cross-site nav, hero title, professional footer. */
export function Page({ title, subtitle, children }: PageProps): JSX.Element {
  return (
    <div style={shell}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; }
        @media (max-width: 480px) {
          .ra-h1 { font-size: 1.9rem !important; }
          .ra-logo-tag { display: none; }
          .ra-nav a { padding: 4px 5px !important; font-size: 0.82rem !important; }
        }
      `}</style>
      <header style={bar}>
        <div style={{ ...container, padding: `0 ${theme.space.md}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.sm, height: 60 }}>
          <Logo />
          <nav className="ra-nav" aria-label="Primary" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <a href={APP_URL} style={navLink(true)}>
              Builder
            </a>
            <a href={DASHBOARD_URL} style={navLink()}>
              Dashboard
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" style={navLink()}>
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main style={{ ...container, flex: 1, padding: `${theme.space.xl}px ${theme.space.lg}px` }}>
        <h1 className="ra-h1" style={{ fontSize: theme.type.scale[5], margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
        {subtitle !== undefined && (
          <p style={{ color: theme.color.muted, fontSize: theme.type.scale[3], maxWidth: '40rem', marginTop: theme.space.sm }}>
            {subtitle}
          </p>
        )}
        <div style={{ marginTop: theme.space.xl }}>{children}</div>
      </main>

      <footer style={{ borderTop: `1px solid ${theme.color.border}`, background: `${theme.color.surface}80`, marginTop: theme.space.xl }}>
        <div
          style={{
            ...container,
            padding: `${theme.space.xl}px ${theme.space.lg}px`,
            display: 'grid',
            gap: theme.space.lg,
            gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))'
          }}
        >
          <div>
            <Logo />
            <p style={{ color: theme.color.muted, fontSize: theme.type.scale[0], marginTop: theme.space.sm, maxWidth: '18rem' }}>
              Forge a full-stack app from one prompt. Every app ships behind a real quality gate.
            </p>
          </div>
          <FooterCol
            heading="Product"
            links={[
              { label: 'App Builder', href: APP_URL },
              { label: 'Dashboard', href: DASHBOARD_URL },
              { label: 'GitHub', href: GITHUB_URL }
            ]}
          />
          <FooterCol
            heading="Company"
            links={[
              { label: 'About', href: '/about' },
              { label: 'Contact', href: '/contact' }
            ]}
          />
          <FooterCol
            heading="Legal"
            links={[
              { label: 'Terms', href: '/terms' },
              { label: 'Privacy', href: '/privacy' }
            ]}
          />
        </div>
        <div style={{ borderTop: `1px solid ${theme.color.border}` }}>
          <div style={{ ...container, padding: `${theme.space.md}px ${theme.space.lg}px`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.space.sm }}>
            <small style={{ color: theme.color.muted }}>© {new Date().getFullYear()} RedAnvil</small>
            <small style={{ color: theme.color.muted }}>Built by the RedAnvil loop</small>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FooterColProps {
  heading: string;
  links: { label: string; href: string }[];
}

/** One labeled column of footer links. */
function FooterCol({ heading, links }: FooterColProps): JSX.Element {
  return (
    <div>
      <p style={{ color: theme.color.text, fontSize: theme.type.scale[1], fontWeight: 600, margin: `0 0 ${theme.space.sm}px` }}>{heading}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: theme.space.xs }}>
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} style={{ color: theme.color.muted, textDecoration: 'none', fontSize: theme.type.scale[1] }}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
