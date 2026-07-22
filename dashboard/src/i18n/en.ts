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
      intro:
        'RedAnvil forges a full-stack web app from a single prompt and ships it only after an automated quality gate accepts the build. This site is the public dashboard for those build runs.',
      sections: [
        {
          heading: 'What RedAnvil is',
          body: 'From one prompt, a build loop writes the app. Finished apps run on Cloudflare Pages with D1 storage and Web Crypto for auth. The sibling app builder is at https://redanvil.pages.dev.'
        },
        {
          heading: 'Build loop and quality gate',
          body: 'A build loop produces the code. An automated gate then scores the result against a fixed rubric: typing, security, tests, accessibility, and design. A build passes only when the score is 90 or higher.'
        },
        {
          heading: 'What this dashboard shows',
          body: 'Each run lists a slug, score, iteration count, and a link to the deployed result. The view is read-only. Nothing here starts, edits, or restarts a build.'
        },
        {
          heading: 'Source',
          body: 'Project source lives on GitHub at https://github.com/brianference/redanvil.'
        }
      ]
    },
    contact: {
      title: 'Contact',
      intro:
        'RedAnvil is a personal project. This dashboard has no accounts, no support inbox, and no phone line.',
      sections: [
        {
          heading: 'How to reach the project',
          body: 'Open an issue on the GitHub repository: https://github.com/brianference/redanvil/issues. Use issues for bugs, questions, and feedback about the builder or this dashboard.'
        },
        {
          heading: 'What to expect',
          body: 'There is no support SLA. Replies depend on maintainer availability. The dashboard does not collect account or personal data from you.'
        }
      ]
    },
    terms: {
      title: 'Terms',
      updated: 'Last updated 2026-07-21',
      intro:
        'These terms cover the RedAnvil dashboard, a free read-only site that lists public build run results. By using this site, you agree to them.',
      sections: [
        {
          heading: 'What this site is',
          body: 'The dashboard is informational. It does not offer accounts, paid features, or write access to builds. Content may change or go offline without notice.'
        },
        {
          heading: 'As is, no warranty',
          body: 'The site is provided as is, without warranties of any kind. We do not promise uptime, accuracy of every listed score, or fitness for a particular purpose. Use it at your own risk.'
        },
        {
          heading: 'Third-party links',
          body: 'Run rows may link to deployed apps and external hosts such as GitHub or Cloudflare. Those sites have their own terms. We are not responsible for third-party content or practices.'
        }
      ]
    },
    privacy: {
      title: 'Privacy',
      updated: 'Last updated 2026-07-21',
      intro:
        'This privacy notice applies to the RedAnvil dashboard. The short version: the dashboard does not collect personal data from you.',
      sections: [
        {
          heading: 'What we collect',
          body: 'The dashboard has no accounts and no forms that store your name or email. It shows public build run data only. We do not run product analytics on this UI.'
        },
        {
          heading: 'Cookies and tracking',
          body: 'This site does not set tracking cookies and does not run third-party ad or analytics pixels for the dashboard.'
        },
        {
          heading: 'Host logging',
          body: 'The site is hosted on Cloudflare Pages. Like most hosts, Cloudflare may keep standard access logs (for example IP address, user agent, and request path) for security and operations. That logging is controlled by the host, not by a separate RedAnvil user database.'
        }
      ]
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
