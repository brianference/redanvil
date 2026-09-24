/**
 * Thin app wrappers around the shared shell.
 *
 * The markup lives in `design-system/` (copied by `sharedShellFiles`). These
 * files only supply this app's routes, copy, and token names — the same split
 * dashboard uses. A raster lockup is not shipped: `hyg-no-binaries` allows
 * images under `public/`, and the mark is added there later.
 */

/**
 * Text brand until a lockup exists under `public/`.
 *
 * `measurable` is the header instance. Footer and drawer omit it so
 * `getByTestId('brand')` matches one node.
 *
 * @returns Contents of `src/components/shell/Brand.tsx`.
 */
export function brandTsx(): string {
  return [
    "import { Link } from 'react-router-dom';",
    "import { en } from '../../i18n/en';",
    "import { theme } from '../../theme';",
    '',
    'export interface BrandProps {',
    '  /**',
    '   * Header instance. Sets `data-testid="brand"` for the acceptance spec.',
    '   * Footer and drawer pass false so the id stays unique.',
    '   */',
    '  measurable?: boolean;',
    '}',
    '',
    '/**',
    ' * Home link showing the app name.',
    ' *',
    ' * The shared `Logo` points at `/logo-lockup.png`. That file is a binary',
    ' * the scaffold does not ship; the mark is generated later into `public/`.',
    ' *',
    ' * @param props - Whether this instance is the measured header mark.',
    ' * @returns The brand link.',
    ' */',
    'export function Brand({ measurable = false }: BrandProps): JSX.Element {',
    '  return (',
    '    <Link',
    '      to="/"',
    "      {...(measurable ? { 'data-testid': 'brand' } : {})}",
    '      style={{',
    "        display: 'inline-flex',",
    "        alignItems: 'center',",
    '        minHeight: theme.touch,',
    '        color: theme.color.text,',
    '        fontWeight: 700,',
    "        textDecoration: 'none'",
    '      }}',
    '    >',
    '      {en.app.name}',
    '    </Link>',
    '  );',
    '}',
    ''
  ].join('\n');
}

/**
 * Heights for the text brand. A raster lockup would be taller; there is not one yet.
 *
 * @returns Contents of `src/components/shell/constants.ts`.
 */
export function shellConstantsTs(): string {
  return [
    '/** Header brand row height, px. Text, not a lockup, so it stays a touch target. */',
    'export const LOGO_HEIGHT = 48;',
    '',
    '/** Drawer brand height, px. */',
    'export const DRAWER_LOGO_HEIGHT = 48;',
    '',
    '/** Footer brand height, px. */',
    'export const FOOTER_LOGO_HEIGHT = 48;',
    ''
  ].join('\n');
}

/**
 * Primary nav derived from the route table, not a second hardcoded list.
 *
 * @returns Contents of `src/components/shell/NavLinks.tsx`.
 */
export function navLinksTsx(): string {
  return [
    "import type { NavItem } from '../../../design-system/NavLink';",
    "import { en } from '../../i18n/en';",
    "import { ROUTES } from '../../lib/routes';",
    '',
    'export type { NavItem };',
    '',
    '/**',
    ' * Localised label for a route export name.',
    ' *',
    ' * @param name - `ROUTES[].name` (`About`, `Home`, …).',
    ' * @returns The nav label.',
    ' */',
    'function labelFor(name: string): string {',
    '  switch (name) {',
    "    case 'Home':",
    '      return en.app.navHome;',
    "    case 'About':",
    '      return en.app.navAbout;',
    "    case 'Terms':",
    '      return en.app.navTerms;',
    "    case 'Privacy':",
    '      return en.app.navPrivacy;',
    "    case 'Contact':",
    '      return en.app.navContact;',
    '    default:',
    '      return name;',
    '  }',
    '}',
    '',
    '/**',
    ' * Whether a primary nav item is the current page.',
    ' *',
    ' * @param pathname - Current router pathname.',
    ' * @param key - Nav item key (lowercased route name).',
    ' * @returns True when the item matches the current route.',
    ' */',
    'export function isNavActive(pathname: string, key: string): boolean {',
    '  const route = ROUTES.find((item) => item.name.toLowerCase() === key);',
    '  return route !== undefined && pathname === route.path;',
    '}',
    '',
    '/**',
    ' * Desktop header links. Each carries `testId: \'nav-link\'` so the',
    ' * acceptance spec can click one label without also hitting the drawer.',
    ' *',
    ' * @returns Ordered primary nav items.',
    ' */',
    'export function headerNavItems(): NavItem[] {',
    '  return ROUTES.map((route) => ({',
    '    key: route.name.toLowerCase(),',
    '    label: labelFor(route.name),',
    '    to: route.path,',
    "    testId: 'nav-link'",
    '  }));',
    '}',
    '',
    '/**',
    ' * Drawer links: the same routes, without the header test id.',
    ' *',
    ' * @returns Ordered drawer nav items.',
    ' */',
    'export function drawerNavItems(): NavItem[] {',
    '  return ROUTES.map((route) => ({',
    '    key: route.name.toLowerCase(),',
    '    label: labelFor(route.name),',
    '    to: route.path',
    '  }));',
    '}',
    ''
  ].join('\n');
}

/**
 * Shell style objects. Width comes from `theme.layout.contentMaxWidth`
 * (`94%`), passed through `makeShellContainer`. No numeric `maxWidth` literal:
 * that is what `fe-no-inline-width` rejects.
 *
 * @returns Contents of `src/components/shell/styles.ts`.
 */
export function shellStylesTs(): string {
  return [
    "import type { CSSProperties } from 'react';",
    "import { shellChromeCss } from '../../../design-system/shellChromeCss';",
    "import { shellCss as sharedShellCss } from '../../../design-system/shellCss';",
    'import {',
    '  makeBarStyle,',
    '  makeIconButtonStyle,',
    '  makeShellContainer,',
    '  makeShellStyle,',
    '  type ShellStyleTokens',
    "} from '../../../design-system/shellStyles';",
    "import { theme } from '../../theme';",
    '',
    'const styleTokens: ShellStyleTokens = {',
    '  bg: theme.color.bg,',
    '  surface: theme.color.surface,',
    '  text: theme.color.text,',
    '  fontFamily: theme.type.family,',
    '  border: theme.color.border,',
    '  contentMaxWidth: theme.layout.contentMaxWidth,',
    '  spaceLg: theme.space.lg,',
    '  spaceSm: theme.space.sm,',
    '  touch: theme.touch,',
    '  radiusSm: theme.radius.sm,',
    '  fontSize: theme.type.scale[2] ?? 16',
    '};',
    '',
    '/** Full-page shell background and type base. */',
    'export const shellStyle: CSSProperties = makeShellStyle(styleTokens);',
    '',
    '/** Sticky header bar chrome. */',
    'export const barStyle: CSSProperties = makeBarStyle(styleTokens);',
    '',
    '/** Shared column for main and footer so the edges line up. */',
    'export const shellContainer: CSSProperties = makeShellContainer(styleTokens);',
    '',
    '/** Icon button chrome. Display stays on the CSS class, not this object. */',
    'export const iconButtonStyle: CSSProperties = makeIconButtonStyle(styleTokens);',
    '',
    'const SHARED_SHELL_CSS = sharedShellCss(',
    '  {',
    '    bg: theme.color.bg,',
    '    surface: theme.color.surface,',
    '    surfaceRaised: theme.color.surface2,',
    '    text: theme.color.text,',
    '    muted: theme.color.muted,',
    '    accent: theme.color.accent,',
    '    accentFg: theme.color.accentFg,',
    '    border: theme.color.border,',
    '    borderStrong: theme.color.border',
    '  },',
    '  {',
    '    touch: theme.touch,',
    '    space: {',
    '      sm: theme.space.sm,',
    '      md: theme.space.md,',
    '      lg: theme.space.lg,',
    '      xl: theme.space.xl',
    '    },',
    '    radiusMd: theme.radius.md,',
    '    fontBody: theme.type.scale[2] ?? 16,',
    '    fontFamily: theme.type.family',
    '  }',
    ');',
    '',
    'const CHROME_CSS = shellChromeCss({',
    '  text: theme.color.text,',
    '  surface: theme.color.surface,',
    '  border: theme.color.border,',
    '  drawerBackdrop: theme.color.scrim,',
    '  drawerShadow: theme.color.shadow,',
    '  spaceXs: theme.space.xs,',
    '  spaceSm: theme.space.sm,',
    '  spaceMd: theme.space.md,',
    '  touch: theme.touch',
    '});',
    '',
    '/**',
    ' * Global shell CSS injected once by Page.',
    ' *',
    ' * @returns The chrome plus the shared nav/footer rules.',
    ' */',
    'export function shellCss(): string {',
    '  return `${CHROME_CSS}\\n${SHARED_SHELL_CSS}`;',
    '}',
    ''
  ].join('\n');
}

/**
 * Header wrapper. Renders `<ThemeToggle />`, which the feature manifest claims.
 *
 * @returns Contents of `src/components/shell/Header.tsx`.
 */
export function headerTsx(): string {
  return [
    "import { useLocation } from 'react-router-dom';",
    "import { Header as SharedHeader } from '../../../design-system/Header';",
    "import type { PageHeaderProps } from '../../../design-system/Page';",
    "import { en } from '../../i18n/en';",
    "import { theme } from '../../theme';",
    "import { ThemeToggle } from '../ThemeToggle';",
    "import { Brand } from './Brand';",
    "import { LOGO_HEIGHT } from './constants';",
    "import { headerNavItems, isNavActive } from './NavLinks';",
    "import { barStyle, iconButtonStyle } from './styles';",
    '',
    '/**',
    ' * Sticky site header: brand, primary nav, theme toggle, menu button.',
    ' *',
    ' * @param props - Drawer state and refs owned by the shared Page.',
    ' * @returns The shared header with this app\'s chrome.',
    ' */',
    'export function Header({',
    '  menuOpen,',
    '  headerRef,',
    '  menuBtnRef,',
    '  onToggleMenu',
    '}: PageHeaderProps): JSX.Element {',
    '  const location = useLocation();',
    '  return (',
    '    <SharedHeader',
    '      menuOpen={menuOpen}',
    '      headerRef={headerRef}',
    '      menuBtnRef={menuBtnRef}',
    '      onToggleMenu={onToggleMenu}',
    '      barStyle={barStyle}',
    '      iconButtonStyle={iconButtonStyle}',
    '      tokens={{',
    '        contentMaxWidth: theme.layout.contentMaxWidth,',
    '        paddingX: theme.space.md,',
    '        gap: theme.space.sm,',
    '        controlsGap: theme.space.sm,',
    '        minHeight: LOGO_HEIGHT + theme.space.md',
    '      }}',
    '      copy={{',
    '        primaryNav: en.app.primaryNav,',
    '        menuClose: en.app.menuClose,',
    '        menuOpen: en.app.menuOpen',
    '      }}',
    '      logo={<Brand measurable />}',
    '      themeToggle={<ThemeToggle />}',
    '      items={headerNavItems()}',
    '      isActive={(key) => isNavActive(location.pathname, key)}',
    '    />',
    '  );',
    '}',
    ''
  ].join('\n');
}

/**
 * Drawer wrapper. Same routes as the header, no duplicate test id.
 *
 * @returns Contents of `src/components/shell/MobileDrawer.tsx`.
 */
export function mobileDrawerTsx(): string {
  return [
    "import { useLocation } from 'react-router-dom';",
    "import { MobileDrawer as SharedMobileDrawer } from '../../../design-system/MobileDrawer';",
    "import type { PageDrawerProps } from '../../../design-system/Page';",
    "import { en } from '../../i18n/en';",
    "import { Brand } from './Brand';",
    "import { drawerNavItems, isNavActive } from './NavLinks';",
    "import { iconButtonStyle } from './styles';",
    '',
    '/**',
    ' * Mobile side drawer: brand, close control, overflow nav.',
    ' *',
    ' * @param props - Open state and refs owned by the shared Page.',
    ' * @returns The shared drawer with this app\'s links.',
    ' */',
    'export function MobileDrawer({',
    '  open,',
    '  drawerRef,',
    '  closeBtnRef,',
    '  onClose',
    '}: PageDrawerProps): JSX.Element {',
    '  const location = useLocation();',
    '  return (',
    '    <SharedMobileDrawer',
    '      open={open}',
    '      drawerRef={drawerRef}',
    '      closeBtnRef={closeBtnRef}',
    '      onClose={onClose}',
    '      logo={<Brand />}',
    '      items={drawerNavItems()}',
    '      isActive={(key) => isNavActive(location.pathname, key)}',
    '      navLabel={en.app.primaryNav}',
    '      closeLabel={en.app.menuClose}',
    '      iconButtonStyle={iconButtonStyle}',
    '    />',
    '  );',
    '}',
    ''
  ].join('\n');
}

/**
 * Footer wrapper. Company and legal columns come from the shared helper
 * so About / Contact / Terms / Privacy are not re-typed per app.
 *
 * @returns Contents of `src/components/shell/Footer.tsx`.
 */
export function footerTsx(): string {
  return [
    'import {',
    '  Footer as SharedFooter,',
    '  companyLegalColumns,',
    '  type FooterTokens',
    "} from '../../../design-system/Footer';",
    "import { en } from '../../i18n/en';",
    "import { theme } from '../../theme';",
    "import { Brand } from './Brand';",
    "import { shellContainer } from './styles';",
    '',
    '/**',
    ' * Site footer: brand, product link, company and legal columns.',
    ' *',
    ' * @returns The shared footer with this app\'s copy.',
    ' */',
    'export function Footer(): JSX.Element {',
    '  const tokens: FooterTokens = {',
    '    border: theme.color.border,',
    '    surface: theme.color.surface,',
    '    text: theme.color.text,',
    '    muted: theme.color.muted,',
    '    spaceSm: theme.space.sm,',
    '    spaceMd: theme.space.md,',
    '    spaceLg: theme.space.lg,',
    '    spaceXl: theme.space.xl,',
    '    touch: theme.touch,',
    '    fontBody: theme.type.scale[2] ?? 16,',
    '    fontSmall: theme.type.scale[1] ?? 14',
    '  };',
    '',
    '  return (',
    '    <SharedFooter',
    '      tokens={tokens}',
    '      shellContainer={shellContainer}',
    '      logo={<Brand />}',
    '      tagline={en.app.footerTagline}',
    '      columns={[',
    '        {',
    '          heading: en.app.footerProduct,',
    '          links: [{ label: en.app.navHome, href: \'/\' }]',
    '        },',
    '        ...companyLegalColumns({',
    '          company: en.app.footerCompany,',
    '          legal: en.app.footerLegal,',
    '          about: en.app.footerAbout,',
    '          contact: en.app.footerContact,',
    '          terms: en.app.footerTerms,',
    '          privacy: en.app.footerPrivacy',
    '        })',
    '      ]}',
    '      copyright={en.app.footerCopyright}',
    '    />',
    '  );',
    '}',
    ''
  ].join('\n');
}

/**
 * Page orchestrator wrapper. Inner pages pass `breadcrumb`; home does not.
 *
 * @returns Contents of `src/components/Page.tsx`.
 */
export function pageShellTsx(): string {
  return [
    "import type { ReactNode } from 'react';",
    "import { Page as SharedPage, type PageProps as SharedPageProps } from '../../design-system/Page';",
    "import { theme } from '../theme';",
    "import { Breadcrumbs } from './Breadcrumbs';",
    "import { Footer } from './shell/Footer';",
    "import { Header } from './shell/Header';",
    "import { MobileDrawer } from './shell/MobileDrawer';",
    "import { shellContainer, shellCss, shellStyle } from './shell/styles';",
    '',
    'export interface PageProps {',
    '  /** Page title, rendered as the single h1. */',
    '  title: string;',
    '  /** Optional hero subtitle under the h1. */',
    '  subtitle?: string;',
    '  /** Current-page label. Set on inner pages so the trail renders. */',
    '  breadcrumb?: string;',
    '  /** Page body. */',
    '  children: ReactNode;',
    '}',
    '',
    '/**',
    ' * Shared page shell: header, optional breadcrumbs, main, footer, drawer.',
    ' *',
    ' * @param props - Title, optional trail label, and body.',
    ' * @returns The shared Page with this app\'s chrome.',
    ' */',
    'export function Page({ title, subtitle, breadcrumb, children }: PageProps): JSX.Element {',
    '  const chrome: SharedPageProps[\'chrome\'] = {',
    '    spaceXl: theme.space.xl,',
    '    spaceLg: theme.space.lg,',
    '    spaceSm: theme.space.sm,',
    '    h1Size: theme.type.scale[5] ?? 40,',
    '    subtitleSize: theme.type.scale[3] ?? 20,',
    '    muted: theme.color.muted',
    '  };',
    '',
    '  return (',
    '    <SharedPage',
    '      title={title}',
    '      subtitle={subtitle}',
    '      breadcrumb={breadcrumb}',
    '      shellStyle={shellStyle}',
    '      shellContainer={shellContainer}',
    '      shellCss={shellCss}',
    '      chrome={chrome}',
    '      Header={Header}',
    '      MobileDrawer={MobileDrawer}',
    '      Footer={Footer}',
    '      Breadcrumbs={Breadcrumbs}',
    '    >',
    '      {children}',
    '    </SharedPage>',
    '  );',
    '}',
    ''
  ].join('\n');
}

/**
 * Breadcrumb wrapper. `navLabel` must match `/breadcrumb/i` — that is what
 * `fe-breadcrumbs` measures, not the component\'s file name.
 *
 * @returns Contents of `src/components/Breadcrumbs.tsx`.
 */
export function breadcrumbsTsx(): string {
  return [
    'import {',
    '  Breadcrumbs as SharedBreadcrumbs,',
    '  type BreadcrumbsProps as SharedProps',
    "} from '../../design-system/Breadcrumbs';",
    "import { en } from '../i18n/en';",
    "import { theme } from '../theme';",
    '',
    'export interface BreadcrumbsProps {',
    '  /** Current page label (not linked). */',
    '  current: string;',
    '}',
    '',
    '/**',
    ' * Inner-page trail: Home / current. Home links to `/`.',
    ' *',
    ' * @param props - Current page label.',
    ' * @returns The shared trail with this app\'s tokens and the Breadcrumb name.',
    ' */',
    'export function Breadcrumbs({ current }: BreadcrumbsProps): JSX.Element {',
    '  const tokens: SharedProps[\'tokens\'] = {',
    '    marginBottom: theme.space.md,',
    '    gap: theme.space.xs,',
    '    fontSize: theme.type.scale[2] ?? 16,',
    '    touch: theme.touch,',
    '    muted: theme.color.muted,',
    '    text: theme.color.text',
    '  };',
    '  const copy: SharedProps[\'copy\'] = {',
    '    navLabel: en.app.breadcrumbNav,',
    '    homeLabel: en.app.breadcrumbHome',
    '  };',
    '  return <SharedBreadcrumbs current={current} tokens={tokens} copy={copy} />;',
    '}',
    ''
  ].join('\n');
}

/**
 * Theme toggle wrapper. The shared control already sets `data-testid="theme-toggle"`.
 *
 * @returns Contents of `src/components/ThemeToggle.tsx`.
 */
export function themeToggleTsx(): string {
  return [
    'import {',
    '  ThemeToggle as SharedThemeToggle,',
    '  type ThemeToggleProps as SharedProps',
    "} from '../../design-system/ThemeToggle';",
    "import { en } from '../i18n/en';",
    "import { theme } from '../theme';",
    '',
    '/**',
    ' * Header control that switches light and dark and persists the choice.',
    ' *',
    ' * @returns The shared toggle with this app\'s tokens and labels.',
    ' */',
    'export function ThemeToggle(): JSX.Element {',
    '  const tokens: SharedProps[\'tokens\'] = {',
    '    touch: theme.touch,',
    '    padding: theme.space.sm,',
    '    border: theme.color.border,',
    '    radius: theme.radius.sm,',
    '    surface: theme.color.surface,',
    '    text: theme.color.text,',
    '    fontSize: theme.type.scale[2] ?? 16,',
    '    fontFamily: theme.type.family',
    '  };',
    '  const copy: SharedProps[\'copy\'] = {',
    '    toLight: en.app.themeToLight,',
    '    toDark: en.app.themeToDark',
    '  };',
    '  return <SharedThemeToggle tokens={tokens} copy={copy} />;',
    '}',
    ''
  ].join('\n');
}

/**
 * Every thin wrapper, keyed by the path it is written to.
 *
 * @returns Path → source.
 */
export function appShellFiles(): Record<string, string> {
  return {
    'src/components/shell/Brand.tsx': brandTsx(),
    'src/components/shell/constants.ts': shellConstantsTs(),
    'src/components/shell/NavLinks.tsx': navLinksTsx(),
    'src/components/shell/styles.ts': shellStylesTs(),
    'src/components/shell/Header.tsx': headerTsx(),
    'src/components/shell/MobileDrawer.tsx': mobileDrawerTsx(),
    'src/components/shell/Footer.tsx': footerTsx(),
    'src/components/Page.tsx': pageShellTsx(),
    'src/components/Breadcrumbs.tsx': breadcrumbsTsx(),
    'src/components/ThemeToggle.tsx': themeToggleTsx()
  };
}
