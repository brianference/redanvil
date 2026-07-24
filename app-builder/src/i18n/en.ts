/**
 * Central English locale bundle for all user-facing copy.
 * Components must reference these keys; no inline UI strings.
 */
export const en = {
  app: {
    name: 'RedAnvil',
    primaryNav: 'Primary',
    logoAlt: 'RedAnvil — forge apps from a prompt',
    footerCopyright: (year: number): string => `© ${year} RedAnvil`,
    footerTagline:
      'Forge a full-stack app from one prompt. Every app ships behind a real quality gate.',
    footerProduct: 'Product',
    footerCompany: 'Company',
    footerLegal: 'Legal',
    footerQuality: 'Quality gate · score ≥ 90',
    footerAppBuilder: 'App Builder',
    footerDashboard: 'Dashboard',
    footerGitHub: 'GitHub',
    footerAbout: 'About',
    footerContact: 'Contact',
    footerTerms: 'Terms',
    footerPrivacy: 'Privacy',
    navBuilder: 'App Builder',
    navDashboard: 'Dashboard',
    navGitHub: 'GitHub',
    navSaved: 'Saved',
    navAbout: 'About',
    navContact: 'Contact',
    themeToLight: 'Switch to light theme',
    themeToDark: 'Switch to dark theme',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    breadcrumbHome: 'Home',
    breadcrumbNav: 'Breadcrumb',
    sidebarLabel: 'Navigate'
  },
  pages: {
    home: {
      title: 'What app should we forge?',
      subtitle:
        'Describe the product in plain language. RedAnvil asks a few questions, then generates a downloadable PRD.',
      bannerAlt: 'RedAnvil — forge apps from a prompt'
    },
    saved: {
      title: 'Saved builds',
      subtitle:
        'Public PRDs saved on this site (shared library, not private to your browser). Open one to view or share the link.',
      loading: 'Loading recent builds…',
      error: 'Could not load saved PRDs.',
      errorRetry: 'Retry',
      empty: 'No saved PRDs yet.',
      emptyHint: 'Generate a PRD and choose Save to site to see it here.',
      emptyCta: 'Start a new build',
      listLabel: 'Public saved PRDs',
      sectionRecent: 'Public library',
      itemMeta: (slug: string): string => `Public PRD · ${slug}`,
      statusReady: 'Ready',
      sourcePublic: 'Public example',
      newBuild: 'New build',
      countMeta: (n: number): string => (n === 1 ? '1 shown' : `${n} shown`),
      kpiLabel: 'Library stats',
      kpiTotal: 'All time',
      kpiSaved: 'In library',
      kpiThisWeek: 'This week',
      openAction: 'Open',
      openAria: (title: string): string => `Open ${title}`
    },
    savedPrd: {
      title: 'Saved PRD',
      loading: 'Loading PRD…',
      error: 'Could not load this PRD.',
      notFound: 'This PRD was not found.',
      backToSaved: 'Back to saved PRDs',
      createdAt: (createdAt: string): string => `Saved ${createdAt}`,
      readyBadge: 'PRD READY'
    },
    about: {
      title: 'About RedAnvil',
      updated: 'Updated July 2026',
      intro:
        'RedAnvil turns a plain-language prompt into a complete, downloadable product requirements document (PRD) you can hand to Claude or another coding agent to build a full-stack app.',
      sections: [
        {
          heading: 'How it works',
          body: 'Describe the app you want, answer a few clarifying questions, and RedAnvil generates a structured PRD — features with acceptance criteria, a data model, the enforced tech stack, a test plan, an effort estimate, and a ready-to-paste build prompt. Download it as markdown and build.'
        },
        {
          heading: 'Built behind a quality gate',
          body: 'Every app RedAnvil describes is meant to be built behind a real quality gate: strict typing, tests, accessibility, security, and a visual review. Nothing ships below the score threshold.'
        },
        {
          heading: 'Open source',
          body: 'RedAnvil is open source. You can read the code, file issues, and contribute on GitHub.'
        }
      ]
    },
    contact: {
      title: 'Contact',
      updated: 'Updated July 2026',
      intro: 'Questions, feedback, or a bug to report — here is how to reach RedAnvil.',
      sections: [
        {
          heading: 'GitHub',
          body: 'The fastest way to reach us is to open an issue on the RedAnvil GitHub repository: https://github.com/brianference/redanvil/issues. We read every one.'
        },
        {
          heading: 'Feedback and requests',
          body: 'Feature requests and bug reports are welcome as GitHub issues. Please include steps to reproduce for bugs.'
        }
      ]
    },
    privacy: {
      title: 'Privacy Policy',
      updated: 'Updated July 2026',
      intro:
        'RedAnvil is built to collect as little as possible. This policy explains what happens to your data.',
      sections: [
        {
          heading: 'What we collect',
          body: 'RedAnvil has no accounts and no sign-in. The wizard runs in your browser; your prompt and answers are used to generate a PRD on your device. We do not store your prompts or PRDs.'
        },
        {
          heading: 'The submit endpoint',
          body: 'If you submit, your answers are sent to a stateless serverless function that validates them and returns a build job. It does not persist your input.'
        },
        {
          heading: 'Hosting and logs',
          body: 'The site is hosted on Cloudflare Pages. Cloudflare may process standard request metadata such as your IP address to serve and protect the site, under Cloudflare’s own privacy policy. We add no analytics or tracking.'
        },
        {
          heading: 'Cookies',
          body: 'RedAnvil does not set tracking cookies.'
        },
        {
          heading: 'Your choices',
          body: 'Because we do not hold personal data, there is nothing for us to export or delete on request. You can stop using the service at any time.'
        },
        {
          heading: 'Changes',
          body: 'We may update this policy; the date above reflects the latest version.'
        }
      ]
    },
    terms: {
      title: 'Terms and Conditions',
      updated: 'Updated July 2026',
      intro:
        'By using RedAnvil you agree to these terms. If you do not agree, do not use the service.',
      sections: [
        {
          heading: 'Who can use it',
          body: 'RedAnvil is available to anyone who can form a binding agreement under applicable law. If you use it for an organization, you confirm you are authorized to accept these terms for it.'
        },
        {
          heading: 'What you can do',
          body: 'You may use RedAnvil to generate PRDs and build your own applications. The PRDs you generate are yours to use.'
        },
        {
          heading: 'What you cannot do',
          body: 'Do not use RedAnvil to break the law, infringe others’ rights, disrupt or reverse-engineer the service, or generate content that is illegal, harmful, or abusive.'
        },
        {
          heading: 'Your content',
          body: 'You are responsible for the prompts you enter and the apps you build. We do not review or endorse generated output.'
        },
        {
          heading: 'Right to remove',
          body: 'We may suspend or remove access, or remove content, that violates these terms or the law, at our discretion.'
        },
        {
          heading: 'No warranty',
          body: 'RedAnvil is provided “as is,” without warranties of any kind. Generated PRDs and estimates are suggestions, not guarantees.'
        },
        {
          heading: 'Limitation of liability',
          body: 'To the maximum extent permitted by law, RedAnvil and its maintainers are not liable for any indirect, incidental, or consequential damages arising from your use of the service.'
        },
        {
          heading: 'Changes',
          body: 'We may update these terms; continued use after a change means you accept it. Material changes are noted with a new date above.'
        }
      ]
    }
  },
  chat: {
    agentName: 'RedAnvil',
    greetingBody:
      'Describe the product in plain language. I’ll ask a few sharp questions, then generate a downloadable PRD you can ship to engineering.',
    greetingMeta: 'Full-stack scope · Mobile-first · No account required to start',
    starterLine: 'Try a starter, or type your own idea below.',
    trustOnline: 'Online',
    trustPrivate: 'PRD private to you',
    trustStatusLabel: 'Service status',
    examplesLabel: 'Example prompts',
    emptyHint: 'No draft yet. Send a description to start forging your PRD.',
    composerLabel: 'Describe your app',
    composerPlaceholder: 'e.g. A marketplace for local makers with tips and pickup slots…',
    composerHint: 'Send · I’ll reply with clarifying questions, then forge a PRD.',
    sendAria: 'Send description',
    tooShort: (min: number): string => `Enter at least ${min} characters to continue.`,
    browseTemplates: 'Or start from a template',
    examples: [
      {
        title: 'Field service app',
        prompt: 'A field service app where techs log jobs offline and sync when back online'
      },
      {
        title: 'Parent coach',
        prompt: 'A parent coach app with daily prompts and shared family goals'
      },
      {
        title: 'B2B invoice tracker',
        prompt: 'A B2B invoice tracker with Stripe status, dunning reminders, and CSV export'
      }
    ]
  },
  templates: {
    title: 'Start from a template',
    subtitle: 'Pick an app archetype, or describe your own below.',
    gridLabel: 'App type templates',
    sectionLabel: 'App types',
    sectionCount: (n: number): string => (n === 1 ? '1 template' : `${n} templates`),
    orDescribe: 'or describe your own',
    composerLabel: 'Your app idea',
    composerPlaceholder:
      'e.g. A booking system for independent bike shops with inventory and SMS reminders',
    continue: 'Continue to questions',
    backToChat: 'Back to chat',
    selected: 'Selected',
    emptyHint: 'Pick a template or write your own description to continue.',
    emptyTitle: 'No template selected',
    examplesLabel: 'Example prompts',
    items: [
      {
        id: 'saas',
        title: 'SaaS',
        description: 'Subscriptions, teams, billing, dashboards',
        appType: 'SaaS dashboard',
        prompt: 'A multi-tenant SaaS dashboard with team invites, billing, and usage analytics'
      },
      {
        id: 'marketplace',
        title: 'Marketplace',
        description: 'Listings, search, checkout, sellers',
        appType: 'Marketplace',
        prompt: 'A marketplace for local makers with listings, search, tips, and pickup slots'
      },
      {
        id: 'internal',
        title: 'Internal tool',
        description: 'Ops tables, roles, audit trails',
        appType: 'Internal tool',
        prompt: 'An internal ops tool with role-based access, audit trails, and bulk export'
      },
      {
        id: 'mobile',
        title: 'Mobile app',
        description: 'iOS/Android flows, push, offline',
        appType: 'Mobile app',
        prompt: 'A mobile-first app with offline support, push notifications, and simple onboarding'
      },
      {
        id: 'api',
        title: 'API / backend',
        description: 'Auth, webhooks, rate limits, OpenAPI docs',
        appType: 'API backend',
        prompt: 'A backend API with auth, webhooks, rate limits, and OpenAPI documentation'
      }
    ]
  },
  wizard: {
    formLabel: 'App build wizard',
    stepOf: (step: number): string => `Step ${step} of 3`,
    stepTitles: ['App idea', 'Scope', 'Review'] as const,
    comingUp: 'Coming up',
    stepDone: 'Done',
    questionKicker: (n: number): string => `Question ${n}`,
    promptLabel: 'What app do you want?',
    promptHint: (minLength: number): string =>
      `Describe the product in a short sentence (at least ${minLength} characters).`,
    promptPlaceholder:
      'e.g. A booking app for a small yoga studio with class schedules and payments',
    exampleIdeasLabel: 'Example app ideas',
    exampleIdeas: ['Team habit tracker', 'Local marketplace', 'Clinic waitlist'] as const,
    appTypeLabel: 'App type',
    appTypePlaceholder: 'e.g. marketplace, dashboard, content site',
    appTypeRequired: 'Pick or type an app type to continue — it shapes the PRD.',
    appTypeChipsLabel: 'Common types',
    appTypeChips: ['SaaS', 'Marketplace', 'Internal tool', 'Mobile app', 'API'] as const,
    authYes: 'Yes',
    authNo: 'No',
    authGroupLabel: 'Does this app need sign-in?',
    entitiesLabel: 'Main entities',
    entitiesPlaceholder: 'e.g. User, Recipe, Favorite',
    entitiesHint: 'Comma-separated domain nouns the app will store or manage.',
    reviewHeading: 'Review your answers',
    reviewPrompt: 'Prompt:',
    reviewEmpty: '(empty)',
    reviewAppType: 'App type:',
    reviewNotSet: '(not set)',
    reviewAuth: 'Auth:',
    reviewYes: 'Yes',
    reviewNo: 'No',
    reviewEntities: 'Entities:',
    reviewNone: '(none)',
    estimatedIterations: (n: number): string => `Estimated iterations: ${n}`,
    estimatedTokens: (n: string): string => `Estimated tokens: ${n}`,
    confidence: (level: string): string => `Confidence: ${level}`,
    promptTooShort: (minLength: number): string =>
      `Enter a prompt of at least ${minLength} characters before submitting.`,
    submittingStatus: 'Submitting build job…',
    jobReadyHeading: (slug: string): string => `Job ready: ${slug}`,
    jobMeta: (targetType: string, threshold: number): string =>
      `${targetType} · threshold ${threshold}`,
    back: 'Back',
    next: 'Next',
    submit: 'Forge PRD',
    submitting: 'Forging…',
    errors: {
      invalidResponse: 'Invalid response from server',
      submitFailed: (status: number): string => `Submit failed (${status})`,
      invalidJobPayload: 'Invalid job payload from server',
      network: 'Network error submitting job',
      timeout: 'Request timed out'
    }
  },
  prdResult: {
    ready: 'PRD READY',
    download: 'Download .md',
    copy: 'Copy',
    copied: 'Copied',
    newPrd: 'New PRD',
    saveToSite: 'Save to site',
    saving: 'Saving…',
    hint: 'Paste this into Claude to build the app, or download it as markdown.',
    savedViewAt: (url: string): string => `Saved — view at ${url}`,
    sectionLabel: 'Generated PRD',
    lede: 'Your product requirements document is ready. Download it, copy it, or save a shareable link.',
    errors: {
      generic: 'Could not save the PRD.',
      timeout: 'Save request timed out',
      network: 'Network error saving PRD'
    }
  }
} as const;

/** English locale type derived from the bundle (no any). */
export type Locale = typeof en;
