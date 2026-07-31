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
      updated: 'Last updated 31 July 2026',
      intro:
        'These terms cover the RedAnvil dashboard at https://redanvil-dashboard.pages.dev. The dashboard is a free, read-only site that lists public quality-gate results for RedAnvil\'s own builds. By loading or using the site you agree to these terms. If you do not agree, do not use it. There are no paid plans and no user accounts on this product.',
      sections: [
        {
          heading: 'Acceptance and eligibility',
          body: 'You must be able to form a binding agreement under the laws that apply to you. If you use the dashboard for an organization, you confirm you are allowed to accept these terms for it. There is no registration step and no sign-in. Loading the site, browsing the run list, opening a run detail page, or following a deploy link from this UI is acceptance of these terms for that use. If you cannot accept them, leave the site.'
        },
        {
          heading: 'What the service is',
          body: 'The dashboard is an informational, read-only view of published build-run results that RedAnvil records when it gates its own projects. The home page lists runs; each run detail page shows summary fields and a per-rule breakdown. The browser loads a public JSON feed from the project repository on GitHub (results/all.json served via raw.githubusercontent.com). The only Pages Function shipped with this dashboard is a health endpoint at /api/health that returns a small JSON status payload. This site does not offer accounts, billing, write access to builds, job submission, PRD generation, or control of the orchestrator. The sibling app builder that turns a prompt into a PRD is a separate product at https://redanvil.pages.dev and is covered by its own pages.'
        },
        {
          heading: 'No accounts',
          body: 'This dashboard does not offer registration, login, passwords, session cookies for identity, OAuth, or social sign-in. There is no user profile table and no visitor database bound to this Pages project. Because there are no accounts, there is nothing to close when you stop visiting; residual state is limited to what your browser keeps (for example a theme preference) and whatever public run data remains published by the project.'
        },
        {
          heading: 'Central disclaimer',
          body: 'Scores, pass/fail flags, coverage counts, iteration histories, and rule results shown here are RedAnvil\'s own automated gate outcomes for its own builds. They are not a third-party certification of security, quality, accessibility, fitness for purpose, uptime, or legal compliance. Do not treat a pass badge, numeric score, or green status as a warranty, audit report, penetration-test result, or guarantee that a linked deploy is free of bugs. Feed content can lag a live deploy, omit runs that never published a result, reflect an older rubric version, or be temporarily wrong while maintainers correct the repository. Deploy links may point at apps that later go offline or change.'
        },
        {
          heading: 'How run data is presented',
          body: 'Each feed row the UI accepts is validated in the browser before display. Fields the site is built to show include: slug, finalScore, threshold, passed, evaluated rule count, total rule count, per-rule ruleId and passed flags, iteration index/score/blockers, deployUrl (only when it is an http or https URL), and finishedAt. Invalid or non-http(s) deploy URLs are treated as absent rather than rendered as live links. A malformed feed fails closed: the UI shows an error state instead of inventing empty success. The dashboard never lets a visitor create, edit, restart, or delete a run through this UI.'
        },
        {
          heading: 'Acceptable use',
          body: 'Use the dashboard only for lawful purposes. You agree not to:',
          items: [
            'Probe, disrupt, overload, or abuse the hosted site or the public results feed in a way that harms availability for others',
            'Scrape or automate access in a volume or manner that degrades the service or violates the terms of hosts that serve the feed or the site',
            'Misrepresent listed scores as independent certification, a security audit, or a guarantee of third-party product quality',
            'Attempt to inject, forge, or alter run data through this UI (it is read-only by design)',
            'Use the site to break the law, harass others, or distribute malware via linked or pasted content you control elsewhere'
          ]
        },
        {
          heading: 'Intellectual property and displayed output',
          body: 'RedAnvil branding, site design, and project source remain with their owners. Project source is public at https://github.com/brianference/redanvil under whatever licence files the repository states; third-party packages keep their own licences. Run metadata shown on this dashboard is published project data so people can inspect gate history. Display of that metadata is not a transfer of ownership in third-party applications linked from deploy URLs, and it is not a licence to rebrand those apps as RedAnvil products. You may link to public run pages and quote public scores with accurate context; you may not strip notices from repository code when a licence requires them, or present the gate UI as a paid certification service you operate.'
        },
        {
          heading: 'Third-party services and links',
          body: 'The site is hosted on Cloudflare Pages. The run feed is fetched from GitHub\'s raw content host for the public repository. Run rows may link to deployed apps and other external hosts. Those services have their own terms and privacy policies. We are not responsible for third-party content, uptime, security, or practices. Following a deploy link or opening the GitHub repository leaves this site and is governed by that destination\'s rules.'
        },
        {
          heading: 'Disclaimer of warranties',
          body: 'The site is provided "as is" and "as available," without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the run history is complete, that every listed score matches a live production binary, that deploy links work, that the feed will remain reachable, or that the health endpoint will always answer. Some jurisdictions do not allow certain warranty exclusions; in those places, exclusions apply only to the extent permitted.'
        },
        {
          heading: 'Limitation of liability',
          body: 'To the maximum extent permitted by law, RedAnvil and its maintainers are not liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, lost goodwill, business interruption, or substitute services, arising from your use of the dashboard or reliance on listed scores, deploy links, or feed content, whether based on contract, tort, or any other theory. Total liability for any claim relating to this free site is limited to zero US dollars, because the service is free and provided without paid consideration. Mandatory rights that cannot be waived in your jurisdiction remain intact.'
        },
        {
          heading: 'Indemnity',
          body: 'You agree to defend and hold harmless RedAnvil and its maintainers from claims, damages, losses, and expenses (including reasonable legal fees) arising from your misuse of the site, your misrepresentation of listed scores, or your breach of these terms, to the extent permitted by applicable law.'
        },
        {
          heading: 'Availability and changes to the service',
          body: 'We may change, suspend, or discontinue the dashboard, the health endpoint, the public feed path, or any part of the UI without notice and without liability. Published runs may be corrected, removed, re-scored under a new rubric, or temporarily unavailable when the repository or host has a problem. There is no uptime SLA and no paid support commitment. The project is maintained on a best-effort basis.'
        },
        {
          heading: 'Termination',
          body: 'You may stop using the dashboard at any time by leaving the site. Because there are no accounts, there is no account termination step. We may refuse further automated access, remove misleading mirrors we control, or shut down endpoints if you violate these terms, if continued operation is unlawful, or if we discontinue the project. Provisions that by their nature should survive (including disclaimers, liability limits, indemnity, and intellectual-property notices) continue after your use ends.'
        },
        {
          heading: 'Changes to these terms',
          body: 'We may update these terms when the product or legal needs change. The "Last updated" line at the top of this page is how notice is given; we do not operate an email list for term notices. Continued use after the date changes means you accept the new terms for subsequent use. If you do not accept a change, stop using the site.'
        },
        {
          heading: 'Governing law and disputes',
          body: 'These terms are conditions of use for a free personal open project; they are not a substitute for advice from a lawyer in your jurisdiction. Before filing a formal claim, open a GitHub issue at https://github.com/brianference/redanvil/issues describing the dispute and allow a reasonable time to respond. Where the law requires a governing jurisdiction to be stated and permits the parties to choose, the laws of the United States apply to the extent they govern a personal project of this kind, without creating a fictional company domicile. Mandatory consumer protections in your place of residence that cannot be waived still apply. Nothing here requires you to waive rights you are legally forbidden to waive.'
        },
        {
          heading: 'Contact',
          body: 'Questions about these terms: open an issue at https://github.com/brianference/redanvil/issues. For privacy-specific requests (access, correction, deletion of anything you believe we hold about you), title the issue "Privacy request". For security concerns, title it "Security report" and describe impact without pasting secrets into a public thread when you can avoid it. The Contact page on this site lists the same routes and what to include in a useful report.'
        }
      ]
    },
    privacy: {
      title: 'Privacy',
      updated: 'Last updated 31 July 2026',
      intro:
        'This privacy notice applies to the RedAnvil dashboard at https://redanvil-dashboard.pages.dev. The dashboard is a free, read-only site. There are no user accounts and no sign-in. Visitors do not submit forms that create a profile. The UI shows public build-run results that RedAnvil publishes for its own projects. We do not run ads or product analytics on this UI.',
      sections: [
        {
          heading: 'Who we are and how to reach us',
          body: 'RedAnvil is a personal open project. There is no company registration page, postal address, data-protection officer listing, or phone line published with this dashboard. The contact route is the public GitHub repository: open an issue at https://github.com/brianference/redanvil/issues. For privacy access, correction, or deletion questions, title the issue "Privacy request" and include enough detail to investigate (for example a run slug, approximate time, and what you saw). The Contact page on this site describes what to include in a useful report.'
        },
        {
          heading: 'No accounts',
          body: 'This dashboard does not offer registration, login, passwords, session cookies for identity, OAuth, or social sign-in. There is no users table and no Cloudflare D1 database bound to this dashboard project. Server-side code for this site is limited to static Pages assets plus a /api/health function that returns a fixed status JSON object. Nothing in that path stores visitor identity.'
        },
        {
          heading: 'What this site shows and where it comes from',
          body: 'The run list and run detail pages display published project data that RedAnvil records when it gates its own builds. The browser fetches a public JSON array from the repository feed at https://raw.githubusercontent.com/brianference/redanvil/master/results/all.json (with a short client-side timeout). Each accepted row can include: slug; finalScore; threshold; passed; evaluated and total rule counts; an array of ruleId and passed pairs; iterations with index, score, and blockers; deployUrl when it is a valid http or https URL; and finishedAt. That feed is world-readable project output, not a private per-visitor dataset. Visitors do not write to the feed through this UI.'
        },
        {
          heading: 'What we collect from visitors',
          body: 'From visitors, this dashboard does not collect names, email addresses, passwords, payment details, phone numbers, or form fields that create a user profile. There are no newsletter, checkout, or registration forms on this site. The only intentional client-side preference RedAnvil application code stores is your theme choice.',
          items: [
            'Theme preference on your device only: localStorage key theme with value light or dark, set when you use the theme toggle',
            'Request metadata that Cloudflare may log while serving Pages and the health function (for example IP address, user agent, path, and timestamps under Cloudflare\'s own practices)',
            'Ordinary browser behaviour such as HTTP cache entries for static assets you load'
          ]
        },
        {
          heading: 'What we do not collect',
          body: 'We do not run advertising pixels, third-party product-analytics SDKs, heatmaps, or retargeting scripts in this UI. We do not sell personal data. There is no mailing list and no marketing profile built from your use of this dashboard.',
          items: [
            'No identity or billing fields collected by this app',
            'No RedAnvil-set tracking or advertising cookies',
            'No social login or OAuth identity from this app',
            'No server-side store of visitor browsing history in a RedAnvil database (this project has none)'
          ]
        },
        {
          heading: 'Why information is processed',
          body: 'We process the limited data above only to run the features the site actually provides:',
          items: [
            'Render public run history so anyone can inspect how RedAnvil\'s own builds scored against the gate',
            'Remember light or dark theme on the same browser after you toggle it',
            'Answer a simple health check so operators can confirm the Pages Function runtime is up',
            'Operate hosting and edge delivery on Cloudflare infrastructure'
          ]
        },
        {
          heading: 'Third-party processors and subprocessors',
          body: 'Infrastructure this dashboard is built on:',
          items: [
            'Cloudflare Pages hosts static assets and runs the /api/health Pages Function. Cloudflare receives the request metadata needed to serve those resources under Cloudflare\'s terms and privacy policy.',
            'GitHub hosts the public source repository and serves the results/all.json feed via raw.githubusercontent.com. When your browser loads the run list, it requests that URL directly; GitHub processes that request under GitHub\'s policies.',
            'Optional outbound links (repository issues, deploy URLs on other hosts, the sibling app builder) send you to those destinations under their own policies when you choose to follow them.'
          ]
        },
        {
          heading: 'What is not a processor of visitor content on this path',
          body: 'This dashboard does not integrate advertising networks, payment processors, email delivery vendors, or external AI completion APIs into the request path that loads runs or health. It does not bind Cloudflare D1, KV, or R2 for visitor or run storage in the dashboard wrangler configuration. Run rows live in the public git repository as published JSON, not in a private dashboard database.'
        },
        {
          heading: 'Cookies and local storage',
          body: 'RedAnvil application code does not set tracking cookies and does not use session cookies for accounts (there are no accounts). The only intentional client persistence this app implements is localStorage for theme preference under the key theme (values light or dark). Your browser may still keep ordinary HTTP cache entries for CSS, JavaScript, and images. Clear site data in the browser to remove the theme key and cached assets. We do not use localStorage or sessionStorage to store run feed copies as a durable product feature; the list is re-fetched when the page loads the feed again.'
        },
        {
          heading: 'Where data lives and international transfers',
          body: 'Static assets and the health function for this dashboard run on Cloudflare\'s network. The run feed is stored in the public GitHub repository and delivered from GitHub\'s content infrastructure. Cloudflare and GitHub operate globally, so request handling may involve processing outside your country. We do not maintain a separate RedAnvil user database for dashboard visitors.'
        },
        {
          heading: 'Retention and deletion',
          body: 'Theme preference remains on your device until you clear site data or remove the theme key. Published run results remain in the public repository until maintainers update, rewrite, or remove the feed files; there is no automatic per-visitor expiry job in the dashboard app because there is no per-visitor store. Cloudflare edge or access logs, if any, follow Cloudflare\'s retention practices, which this repository does not control. GitHub retains repository history and access logs under GitHub\'s policies. If you want a specific public run row corrected or removed from the project feed, open a GitHub issue titled "Privacy request" or a normal bug report with the slug; maintainers may edit the public feed for accuracy or abuse. Clearing your own browser storage is how you delete the theme preference.'
        },
        {
          heading: 'What you can request and how',
          body: 'Depending on where you live, you may have rights to access, correct, delete, port, or object to certain processing of personal data. For this dashboard those rights mainly concern the minimal data described above, not an account profile we never created. Exercise them by opening https://github.com/brianference/redanvil/issues with "Privacy request" in the title. There is no SLA; response depends on maintainer availability.',
          items: [
            'Access: public run pages and the public JSON feed are already world-readable; theme data lives only in your browser',
            'Correction: report a wrong public run display with the slug so maintainers can fix the published feed if the error is real',
            'Deletion: clear localStorage for theme; request feed-row edits via GitHub when the concern is published project data; host-log deletion is subject to Cloudflare or GitHub practices',
            'Portability: copy public run URLs or download the public JSON feed yourself from GitHub',
            'Objection: stop using the site; there is no marketing list to opt out of'
          ]
        },
        {
          heading: 'Children',
          body: 'This dashboard is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has been identified in something published here beyond ordinary public project metadata, open a GitHub issue titled "Privacy request" with enough detail to find the material. We will address what we can identify from the details you provide.'
        },
        {
          heading: 'Security practices in this codebase',
          body: 'What this dashboard actually implements: HTTPS is provided by Cloudflare for the hosted site; the client validates the untrusted run feed with Zod and fails closed on malformed rows; deploy links are accepted only when they parse as http or https URLs; the health function sets x-content-type-options: nosniff, a same-origin referrer policy, and CORS limited to the production dashboard origin with GET only. What this notice does not claim: we do not assert application-layer encryption at rest for a visitor database we do not operate, a formal SOC 2 report, or that public run scores are confidential. The run feed is intentionally public. No method of transmission or storage is perfectly secure. Do not post secrets into GitHub issues when reporting problems.'
        },
        {
          heading: 'Changes to this policy',
          body: 'We may update this notice when the product, feed path, or hosting setup changes. The "Last updated" line at the top of this page is the notice mechanism. We do not operate an email list for policy notices. Continued use of the site after the date changes means you accept the revised notice for subsequent use. For material changes, the updated text on this page is the record; check the date when you care about the current rules.'
        },
        {
          heading: 'Contact for privacy',
          body: 'Privacy questions and requests: open an issue at https://github.com/brianference/redanvil/issues with "Privacy request" in the title. Source for this dashboard, including this notice text, the health function, and the client feed loader, is in the same repository. General product contact details are also summarized on the Contact page of this site.'
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
