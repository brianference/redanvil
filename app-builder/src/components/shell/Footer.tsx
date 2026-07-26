import { en } from '../../i18n/en';
import { theme } from '../../theme';
import { DASHBOARD_URL, GITHUB_URL } from './constants';
import { Logo } from './Logo';
import { FOOTER_LOGO_HEIGHT } from './constants';
import { shellContainer } from './styles';

interface FooterColProps {
  heading: string;
  links: { label: string; href: string }[];
}

/** One labeled column of footer links (≥44px targets, ≥8px gap). */
function FooterCol({ heading, links }: FooterColProps): JSX.Element {
  return (
    <div>
      <p
        style={{
          color: theme.color.text,
          fontSize: theme.type.scale[2],
          fontWeight: 600,
          margin: `0 0 ${theme.space.sm}px`
        }}
      >
        {heading}
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: theme.space.sm
        }}
      >
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: theme.touch,
                color: theme.color.muted,
                textDecoration: 'none',
                fontSize: theme.type.scale[2]
              }}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Multi-column site footer: brand tagline, product/company/legal links, copyright.
 */
export function Footer(): JSX.Element {
  return (
    <footer
      style={{
        borderTop: `1px solid ${theme.color.border}`,
        background: `color-mix(in srgb, ${theme.color.surface} 50%, transparent)`,
        marginTop: theme.space.xl
      }}
    >
      <div
        className="ra-footer-grid"
        style={{
          ...shellContainer,
          padding: `${theme.space.xl}px ${theme.space.lg}px`
        }}
      >
        <div className="ra-footer-brand">
          <Logo height={FOOTER_LOGO_HEIGHT} />
          <p
            className="ra-footer-tagline"
            style={{
              color: theme.color.muted,
              fontSize: theme.type.scale[2],
              marginTop: theme.space.sm,
              lineHeight: 1.5
            }}
          >
            {en.app.footerTagline}
          </p>
        </div>
        <div className="ra-footer-cols">
          <FooterCol
            heading={en.app.footerProduct}
            links={[
              { label: en.app.footerAppBuilder, href: '/' },
              { label: en.app.footerDashboard, href: DASHBOARD_URL },
              { label: en.app.navSaved, href: '/saved' },
              { label: en.app.footerGitHub, href: GITHUB_URL }
            ]}
          />
          <FooterCol
            heading={en.app.footerCompany}
            links={[
              { label: en.app.footerAbout, href: '/about' },
              { label: en.app.footerContact, href: '/contact' }
            ]}
          />
          <FooterCol
            heading={en.app.footerLegal}
            links={[
              { label: en.app.footerTerms, href: '/terms' },
              { label: en.app.footerPrivacy, href: '/privacy' }
            ]}
          />
        </div>
      </div>
      <div
        style={{
          borderTop: `1px solid ${theme.color.border}`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <div
          style={{
            ...shellContainer,
            padding: `${theme.space.md}px ${theme.space.lg}px`,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: theme.space.sm
          }}
        >
          <small style={{ color: theme.color.muted, fontSize: theme.type.scale[1] }}>
            {en.app.footerCopyright(new Date().getFullYear())}
          </small>
          <small style={{ color: theme.color.muted, fontSize: theme.type.scale[1] }}>
            {en.app.footerQuality}
          </small>
        </div>
      </div>
    </footer>
  );
}
