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
    navBuilder: 'App Builder',
    navDashboard: 'Dashboard',
    navRuns: 'Runs',
    navAbout: 'About',
    navContact: 'Contact',
    navGitHub: 'GitHub',
    themeToLight: 'Switch to light theme',
    themeToDark: 'Switch to dark theme',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    breadcrumbHome: 'Home',
    breadcrumbNav: 'Breadcrumb',
    sidebarLabel: 'Navigate',
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
    notFound: {
      title: 'Page not found',
      body: 'That address does not match a page on the RedAnvil dashboard. It may have moved, or the link may be incomplete.',
      home: 'Back to home'
    },
    home: {
      title: 'Runs',
      loading: 'Loading live runs…',
      error: (message: string): string => `Could not load runs: ${message}`,
      empty: 'No runs recorded yet.',
      summaryLabel: 'Build stats',
      kpiTotal: 'Total runs',
      kpiPassed: 'Passed',
      kpiAvgScore: 'Avg score',
      recentHeading: 'Recent builds',
      recentMeta: (count: number): string => (count === 1 ? '1 shown' : `${count} shown`)
    },
    about: {
      title: 'About',
      updated: 'Last updated 27 July 2026',
      intro:
        'RedAnvil forges full-stack web apps behind an automated quality gate. This site (https://redanvil-dashboard.pages.dev) is the public, read-only dashboard for RedAnvil\'s own build run results.',
      sections: [
        {
          heading: 'What RedAnvil is',
          body: 'From a prompt and a spec, a build loop writes the app. Finished apps target Cloudflare Pages with D1 storage and Web Crypto for auth where needed. The sibling app builder that turns a prompt into a downloadable PRD is at https://redanvil.pages.dev.'
        },
        {
          heading: 'How the gate actually works',
          body: 'A local orchestrator drives implementation, then scores the result against a fixed rubric: typing, security, tests, accessibility, design, and related lanes. Failures feed back into another iteration until the score meets the threshold (default 90) or the run hits a max-iteration cap. Unknown means fail -- a rule with no recorded outcome does not quietly pass.'
        },
        {
          heading: 'What the scores mean',
          body: 'Each score is RedAnvil\'s own automated gate result for one of its own builds. It is a machine-checked rubric score from that run, not a third-party certification, security audit, compliance badge, or guarantee that the app is free of bugs. The number is only as good as the rules wired into that gate and the evidence recorded for that run.'
        },
        {
          heading: 'Where the data comes from',
          body: 'The dashboard reads published run data that RedAnvil records when it gates builds (slug, score, pass or fail, rule coverage, iterations, deploy links, and per-rule breakdowns). Visitors do not submit that data through forms on this site. Source for the project is at https://github.com/brianference/redanvil.'
        },
        {
          heading: 'What this dashboard is not',
          body: 'This view is read-only. Nothing here starts, edits, restarts, or deletes a build. It is not a multi-tenant status product for other companies\' CI, and it does not offer accounts, billing, or write APIs for visitors.'
        },
        {
          heading: 'Honest limitations',
          body: 'Listed scores can lag deploys, omit runs that never published a result, or reflect a rubric version that later changed. Deploy links may go offline. Treat the feed as a public log of RedAnvil experiments, not as an uptime or certification service.'
        }
      ]
    },
    contact: {
      title: 'Contact',
      updated: 'Last updated 27 July 2026',
      intro:
        'RedAnvil is a personal project. This dashboard has no accounts, no support inbox, and no phone line. Use the routes below.',
      sections: [
        {
          heading: 'How to reach the project',
          body: 'Open an issue on the public GitHub repository: https://github.com/brianference/redanvil/issues. Use issues for bugs, questions, and feedback about this dashboard or the app builder.'
        },
        {
          heading: 'What to include',
          body: 'Clear reports get clearer answers. When something looks wrong on a run, include:',
          items: [
            'The run slug or URL you were viewing',
            'What you expected versus what you saw',
            'Browser and approximate time, if the problem is the site UI'
          ]
        },
        {
          heading: 'What response to expect',
          body: 'There is no support SLA. Replies depend on maintainer availability. Issues may be closed as duplicates, out of scope, or wont-fix when that is the honest answer.'
        },
        {
          heading: 'Privacy requests',
          body: 'This dashboard does not collect account data from visitors. If you still need a privacy-related answer (for example host logs or a linked public page), open a GitHub issue titled "Privacy request". See the Privacy Policy for what this site processes and what it does not.'
        },
        {
          heading: 'Security reports',
          body: 'For a suspected security issue in RedAnvil or this dashboard, open a GitHub issue titled "Security report" and describe impact without pasting secrets into a public thread when you can avoid it.'
        }
      ]
    },
    terms: {
      title: 'Terms',
      updated: 'Last updated 27 July 2026',
      intro:
        'These terms cover the RedAnvil dashboard at https://redanvil-dashboard.pages.dev, a free read-only site that lists public build run results. By using this site, you agree to them. If you do not agree, do not use it.',
      sections: [
        {
          heading: 'Acceptance and eligibility',
          body: 'You must be able to form a binding agreement under the laws that apply to you. There are no accounts on this dashboard; loading and using the site is acceptance of these terms.'
        },
        {
          heading: 'What the service is',
          body: 'The dashboard is informational. It displays published gate results for RedAnvil\'s own builds: scores, coverage, iterations, and deploy links. It does not offer accounts, paid features, write access to builds, or control of the orchestrator.'
        },
        {
          heading: 'Central disclaimer',
          body: 'Scores shown here are RedAnvil\'s own automated gate results for its own builds. They are not a certification of security, quality, accessibility, or fitness for any purpose. Do not treat a pass badge as a warranty, audit report, or legal compliance statement. Content may be incomplete, delayed, or wrong relative to a live deploy.'
        },
        {
          heading: 'Acceptable use',
          body: 'Use the dashboard only in lawful ways. You agree not to probe, disrupt, scrape in a way that harms the service, or misrepresent listed scores as third-party certification. Do not attempt to inject or alter run data through this UI; it is read-only by design.'
        },
        {
          heading: 'Intellectual property and source',
          body: 'RedAnvil branding, site design, and project code remain with their owners. Project source is public at https://github.com/brianference/redanvil; third-party packages keep their own licences. Run metadata displayed here is published project data, not a grant of rights in third-party apps linked from deploy URLs.'
        },
        {
          heading: 'Third-party services',
          body: 'Run rows may link to deployed apps and external hosts such as GitHub or Cloudflare. Those sites have their own terms and privacy policies. We are not responsible for third-party content, availability, or practices.'
        },
        {
          heading: 'Disclaimer of warranties',
          body: 'The site is provided "as is" and "as available," without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not promise uptime, completeness of the run history, or accuracy of every listed score.'
        },
        {
          heading: 'Limitation of liability',
          body: 'To the maximum extent permitted by law, RedAnvil and its maintainers are not liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of the dashboard or reliance on listed scores. Total liability for any claim relating to this free site is limited to zero dollars.'
        },
        {
          heading: 'Indemnity',
          body: 'You agree to defend and hold harmless RedAnvil and its maintainers from claims, damages, and expenses (including reasonable legal fees) arising from your misuse of the site or your breach of these terms.'
        },
        {
          heading: 'Availability',
          body: 'We may change, suspend, or discontinue the dashboard or any part of the feed without notice. Published runs may be corrected, removed, or temporarily unavailable. There is no uptime SLA.'
        },
        {
          heading: 'Changes to these terms',
          body: 'We may update these terms. The date at the top of this page changes when we do. Continued use after an update means you accept the new terms.'
        },
        {
          heading: 'Governing law and disputes',
          body: 'These terms are governed by the laws of the United States and the state in which the maintainer resides, without regard to conflict-of-law rules that would choose another forum. Before filing a claim, open a GitHub issue describing the dispute and allow a reasonable time to respond. Courts of competent jurisdiction there may hear disputes that cannot be resolved that way, except where mandatory consumer law says otherwise.'
        },
        {
          heading: 'Contact',
          body: 'Questions about these terms: open an issue at https://github.com/brianference/redanvil/issues. For privacy-specific requests, title the issue "Privacy request". For security concerns, title it "Security report".'
        }
      ]
    },
    privacy: {
      title: 'Privacy',
      updated: 'Last updated 27 July 2026',
      intro:
        'This privacy notice applies to the RedAnvil dashboard at https://redanvil-dashboard.pages.dev. The short version: the dashboard is read-only for visitors, collects no account data, and shows public build run results. We run no ads or product analytics on this UI.',
      sections: [
        {
          heading: 'What we collect',
          body: 'From visitors, this dashboard does not collect names, emails, passwords, or form submissions that create a user profile. The only intentional client-side preference we store is your theme choice (light or dark) in browser localStorage. The run list and run detail pages display published project data that RedAnvil already recorded for its own builds (slug, scores, rule results, iterations, deploy links).'
        },
        {
          heading: 'What we do not collect',
          body: 'We do not offer accounts on this site. We do not run advertising pixels, third-party analytics SDKs, or tracking scripts on the dashboard UI. We do not sell personal data.',
          items: [
            'No sign-in, newsletter, or payment forms',
            'No product analytics on click paths or heatmaps',
            'No third-party ad or retargeting cookies set by RedAnvil'
          ]
        },
        {
          heading: 'Why we process it',
          body: 'Theme preference exists so the site stays light or dark on your next visit on the same browser. Published run data is shown so anyone can inspect how RedAnvil\'s own builds scored against the gate. Host logging exists so Cloudflare can serve and protect the site.'
        },
        {
          heading: 'Who else receives it',
          body: 'The site is hosted on Cloudflare Pages. Cloudflare may process standard request metadata under its own privacy policy. Public pages are visible to anyone on the internet. We do not send visitor data to advertising partners.'
        },
        {
          heading: 'Cookies and local storage',
          body: 'This site does not set tracking cookies. Theme preference is stored in localStorage under the `theme` key. Clear site data in your browser to remove it. Your browser may keep ordinary cache entries for static assets.'
        },
        {
          heading: 'Where data lives and transfers',
          body: 'Static assets and Pages Functions for this dashboard run on Cloudflare\'s network. Run feed data is published project output, not a private per-visitor database. Cloudflare operates globally, so request handling may involve transfers outside your country.'
        },
        {
          heading: 'Retention',
          body: 'Theme preference remains on your device until you clear it. Published run results remain until maintainers update or remove the feed. Host access logs follow Cloudflare\'s retention practices. We do not keep a separate RedAnvil profile store for dashboard visitors.'
        },
        {
          heading: 'Your rights',
          body: 'Depending on where you live, you may have rights to access, correct, delete, port, or object to certain processing of personal data. For this dashboard, visitor personal data is minimal (theme on device; host logs controlled by Cloudflare). To make a request, open a GitHub issue titled "Privacy request" at https://github.com/brianference/redanvil/issues.',
          items: [
            'Access and portability: you can read public run pages; theme data lives only in your browser',
            'Deletion: clear localStorage for theme; host-log deletion is subject to Cloudflare practices',
            'Correction: report wrong public run display via a GitHub issue with the slug',
            'Objection: stop using the site; there is no marketing list to opt out of'
          ]
        },
        {
          heading: 'Children',
          body: 'This dashboard is not directed at children under 13, and we do not knowingly collect personal information from children under 13. Contact us via a privacy-titled GitHub issue if you believe that has occurred.'
        },
        {
          heading: 'Security',
          body: 'We rely on Cloudflare\'s platform controls for transport and edge protection. The run feed is intentionally public. No method of transmission or storage is perfectly secure. Do not post secrets into GitHub issues when reporting problems.'
        },
        {
          heading: 'Changes to this policy',
          body: 'We may update this notice when the product or hosting setup changes. The date at the top of this page is the signal. Continued use after a change means you accept the updated notice. We have no email list for change announcements.'
        },
        {
          heading: 'Contact for privacy',
          body: 'Privacy questions and requests: open an issue at https://github.com/brianference/redanvil/issues with "Privacy request" in the title. Source code is in the same repository.'
        }
      ]
    }
  },
  status: {
    pass: 'Pass',
    fail: 'Fail',
    badgeAria: (label: string, score: number, threshold: number): string =>
      `${label}: score ${score} versus threshold ${threshold}`
  },
  runList: {
    empty: 'No runs yet.',
    caption: 'Build runs',
    listAria: 'Recent builds',
    slug: 'Slug',
    score: 'Score',
    scoreValue: (score: number): string => String(score),
    coverage: 'Coverage',
    coverageValue: (evaluated: number, total: number): string => `${evaluated}/${total} rules`,
    iterations: 'Iterations',
    iterationsValue: (count: number): string =>
      count === 1 ? '1 iteration' : `${count} iterations`,
    deploy: 'Deploy',
    openDeploy: 'Open deploy',
    none: 'None',
    metaSep: ' · '
  },
  relativeTime: {
    justNow: 'just now',
    minutes: (n: number): string => `${n}m ago`,
    hours: (n: number): string => `${n}h ago`,
    days: (n: number): string => `${n}d ago`,
    months: (n: number): string => `${n}mo ago`,
    years: (n: number): string => `${n}y ago`
  },
  runDetail: {
    loading: 'Loading run detail…',
    error: (message: string): string => `Could not load run: ${message}`,
    notFound: 'No run found for this slug.',
    backToRuns: 'Back to all runs',
    missingSlug: 'Run',
    headerLabel: 'Run summary',
    scoreLabel: 'Score',
    scoreValue: (score: number, threshold: number): string => `${score} / ${threshold}`,
    coverageLabel: 'Coverage',
    coverageValue: (evaluated: number, total: number): string => `${evaluated}/${total} rules`,
    finishedLabel: 'Finished',
    deployLabel: 'Deploy',
    openDeploy: 'Open deploy',
    none: 'None',
    iterationsHeading: 'Iteration history',
    iterationsSummary: (count: number): string =>
      count === 1 ? '1 iteration' : `${count} iterations`,
    iterationsEmpty: 'No iterations recorded for this run.',
    iterationIndex: (index: number): string => `Iteration ${index}`,
    iterationScore: (score: number): string => `score ${score}`,
    noBlockers: 'No blockers',
    rulesHeading: 'Per-rule breakdown',
    rulesEmpty: 'No rule results recorded for this run.',
    laneHeading: (lane: string): string => `${lane} lane`
  }
} as const;

/** English locale type derived from the bundle (no any). */
export type Locale = typeof en;
