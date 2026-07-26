/**
 * Thin wrapper: supplies dashboard product links and copy to the shared Footer.
 */
import { Footer as SharedFooter, type FooterTokens } from '../../../../design-system/Footer';
import { en } from '../../i18n/en';
import { theme } from '../../theme';
import { APP_URL, DASHBOARD_URL, FOOTER_LOGO_HEIGHT, GITHUB_URL } from './constants';
import { Logo } from './Logo';
import { shellContainer } from './styles';

/**
 * Multi-column site footer: brand tagline, product/company/legal links, copyright.
 */
export function Footer(): JSX.Element {
  const tokens: FooterTokens = {
    border: theme.color.border,
    surface: theme.color.surface,
    text: theme.color.text,
    muted: theme.color.muted,
    spaceSm: theme.space.sm,
    spaceMd: theme.space.md,
    spaceLg: theme.space.lg,
    spaceXl: theme.space.xl,
    touch: theme.touch,
    fontBody: theme.type.scale[2] ?? 16,
    fontSmall: theme.type.scale[1] ?? 14
  };

  return (
    <SharedFooter
      tokens={tokens}
      shellContainer={shellContainer}
      logo={<Logo height={FOOTER_LOGO_HEIGHT} />}
      tagline={en.app.footerTagline}
      columns={[
        {
          heading: en.app.footerProduct,
          links: [
            { label: en.app.footerAppBuilder, href: APP_URL },
            { label: en.app.footerDashboard, href: DASHBOARD_URL },
            { label: en.app.footerGitHub, href: GITHUB_URL }
          ]
        },
        {
          heading: en.app.footerCompany,
          links: [
            { label: en.app.footerAbout, href: '/about' },
            { label: en.app.footerContact, href: '/contact' }
          ]
        },
        {
          heading: en.app.footerLegal,
          links: [
            { label: en.app.footerTerms, href: '/terms' },
            { label: en.app.footerPrivacy, href: '/privacy' }
          ]
        }
      ]}
      copyright={en.app.footerCopyright}
    />
  );
}
