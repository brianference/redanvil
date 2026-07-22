/**
 * Central English locale bundle for all user-facing copy.
 * Components must reference these keys; no inline UI strings.
 */
export const en = {
  app: {
    name: 'RedAnvil',
    primaryNav: 'Primary',
    footerCopyright: '© RedAnvil',
    footerTagline:
      'Forge a full-stack app from one prompt. Every app ships behind a real quality gate.',
    logoAlt: 'RedAnvil — forge apps from a prompt',
    navBuilder: 'Builder',
    navDashboard: 'Dashboard',
    navGitHub: 'GitHub',
    navAbout: 'About',
    themeToLight: 'Switch to light theme',
    themeToDark: 'Switch to dark theme',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    breadcrumbHome: 'Home',
    breadcrumbNav: 'Breadcrumb',
    footerProduct: 'Product',
    footerCompany: 'Company',
    footerLegal: 'Legal',
    footerAppBuilder: 'App Builder',
    footerDashboard: 'Dashboard',
    footerGitHub: 'GitHub',
    footerAbout: 'About',
    footerContact: 'Contact',
    footerTerms: 'Terms',
    footerPrivacy: 'Privacy'
  },
  pages: {
    home: {
      title: 'Runs',
      loading: 'Loading live runs…',
      error: (message: string): string => `Could not load runs: ${message}`,
      empty: 'No runs recorded yet.',
      summaryLabel: 'Run summary',
      summaryLine: (total: number, passed: number, avg: string): string =>
        `${total} total · ${passed} passed · avg score ${avg}`
    },
    about: {
      title: 'About',
      body: 'About content.'
    },
    contact: {
      title: 'Contact',
      body: 'Contact content.'
    },
    terms: {
      title: 'Terms',
      body: 'Terms content.'
    },
    privacy: {
      title: 'Privacy',
      body: 'Privacy content.'
    }
  },
  runList: {
    empty: 'No runs yet.',
    caption: 'Build runs',
    slug: 'Slug',
    score: 'Score',
    iterations: 'Iterations',
    deploy: 'Deploy',
    pass: 'Pass',
    fail: 'Fail',
    badgeAria: (label: string, score: number, threshold: number): string =>
      `${label}: score ${score} versus threshold ${threshold}`,
    openDeploy: 'Open deploy',
    none: 'None'
  }
} as const;

/** English locale type derived from the bundle (no any). */
export type Locale = typeof en;
