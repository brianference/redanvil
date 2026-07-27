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
    navExamples: 'Examples',
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
    notFound: {
      title: 'Page not found',
      body: 'That address does not match a page on RedAnvil. It may have moved, or the link may be incomplete.',
      home: 'Back to home'
    },
    examples: {
      title: 'Examples',
      intro:
        'Apps RedAnvil has shipped, and the prompts that produced them. Every screen below is a real screenshot of a real deployment -- nothing here is a mockup.',
      builtHeading: 'How it was built',
      stepBrand: 'The brand it generated',
      brandNote:
        'Every app gets a real logo, not an emoji or a placeholder. RedAnvil briefs an image model for a set of marks, reviews each one, and prepares the winner as two assets -- a full-colour mark for the header and a flat companion that survives a favicon and recolours for a dark theme. The palette is then derived from the mark, so the app and its logo match.',
      brandAlt: (name: string): string => `The generated ${name} logo mark`,
      stepPrompt: 'The prompt',
      stepPrd: 'The PRD it produced',
      stepApp: 'The app it shipped',
      prdNote:
        'RedAnvil turns the answers into a full implementation spec: features, acceptance criteria, a data model, a test plan, and a vertical-slice build plan. This is the review step, exactly as the builder renders it.',
      prdAlt: (name: string): string =>
        `The RedAnvil wizard review step showing the answers that generated the ${name} spec`,
      screensLabel: (name: string): string => `${name} screens`,
      viewLive: 'Open the live app'
    },
    home: {
      title: 'What app should we forge?',
      subtitle:
        'Describe the product in plain language. RedAnvil asks a few questions, then generates a downloadable PRD -- and a real logo and palette to build it in.',
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
      updated: 'Last updated 27 July 2026',
      intro:
        'RedAnvil turns a plain-language prompt into a complete, downloadable product requirements document (PRD) you can hand to a coding agent. This site is the public app builder at https://redanvil.pages.dev.',
      sections: [
        {
          heading: 'What the app builder does',
          body: 'You describe the product you want, answer a short clarifying wizard, and RedAnvil generates a structured PRD: features with acceptance criteria, a data model, the enforced tech stack, a test plan, an effort estimate, and a ready-to-paste build prompt. You can download the markdown, or save it to the public library on this site.'
        },
        {
          heading: 'How generation works',
          body: 'The wizard runs in your browser. When you submit, your prompt and answers go to the RedAnvil API (Cloudflare Pages Functions). A job can be queued in Cloudflare D1. The PRD itself is produced for you to download or save. There are no accounts and no sign-in.'
        },
        {
          heading: 'Saved PRDs are public',
          body: 'The Saved page is a shared library, not a private folder. Anyone with the link can open a saved PRD. Do not put confidential product plans, customer data, or secrets into a prompt you plan to save.'
        },
        {
          heading: 'The quality gate behind RedAnvil',
          body: 'The wider RedAnvil project builds apps behind an automated gate: strict typing, tests, accessibility, security checks, and a real visual review. A build passes only when the score meets the threshold (default 90). The companion dashboard at https://redanvil-dashboard.pages.dev lists those gate results for RedAnvil\'s own builds.'
        },
        {
          heading: 'What this is not',
          body: 'This site does not compile, deploy, or host the app you described. A generated PRD is a starting specification. It is not verified engineering advice, a legal review, a security audit, or a guarantee that a build will pass the gate or ship on time.'
        },
        {
          heading: 'Source and stack',
          body: 'Source is public at https://github.com/brianference/redanvil. Hosting, storage, and functions use Cloudflare Pages, Pages Functions, and D1. Theme preference is stored only in your browser\'s localStorage.'
        },
        {
          heading: 'Honest limitations',
          body: 'The builder can misread a vague prompt, under- or over-scope features, or produce estimates that do not match real effort. Always review the PRD before you treat it as a build plan. There is no paid support SLA on this personal project.'
        }
      ]
    },
    contact: {
      title: 'Contact',
      updated: 'Last updated 27 July 2026',
      intro:
        'RedAnvil is a personal open project. There is no phone line, chat desk, or account inbox. Use the routes below.',
      sections: [
        {
          heading: 'How to reach the project',
          body: 'Open an issue on the public GitHub repository: https://github.com/brianference/redanvil/issues. That is the primary contact path for bugs, questions, feature ideas, and feedback about the app builder or the dashboard.'
        },
        {
          heading: 'What to include',
          body: 'A useful report speeds a reply. Please put the essentials in the first message.',
          items: [
            'What you tried (prompt summary or steps), and what you expected',
            'What actually happened, including any error text you saw',
            'Browser and device if the problem is on the site itself',
            'Whether you saved a public PRD (include the public URL if relevant)'
          ]
        },
        {
          heading: 'What response to expect',
          body: 'There is no support SLA. Replies depend on maintainer availability. Issues may be closed as duplicates, out of scope, or wont-fix when that is the honest answer.'
        },
        {
          heading: 'Privacy requests',
          body: 'To ask about access, correction, or deletion of data you submitted or saved on this site, open a GitHub issue and title it with "Privacy request". Include enough detail to find the record (for example a public PRD URL or approximate time and slug). See the Privacy Policy for what we hold and what we do not.'
        },
        {
          heading: 'Security reports',
          body: 'If you believe you found a security issue in RedAnvil, open a GitHub issue titled "Security report" and describe the impact without pasting secrets or exploit payloads into a public thread when you can avoid it. Do not use the public PRD library to store vulnerability details about third parties.'
        }
      ]
    },
    privacy: {
      title: 'Privacy Policy',
      updated: 'Last updated 27 July 2026',
      intro:
        'This policy describes how the RedAnvil app builder (https://redanvil.pages.dev) handles information. The short version: there are no accounts; prompts and wizard answers you send hit our API and may be stored; anything you save to the library is public; we run no ads or product analytics.',
      sections: [
        {
          heading: 'What we collect',
          body: 'RedAnvil has no accounts and no sign-in. Depending on what you do, we may process:',
          items: [
            'Prompt text and wizard answers you submit to generate a PRD or queue a job',
            'Saved PRD records you choose to publish (slug, title, prompt, markdown, created time), stored in Cloudflare D1 and listed on the public Saved page',
            'Theme choice (light or dark) in your browser localStorage only',
            'Standard request metadata that our host, Cloudflare, may log to serve and protect the site (for example IP address, user agent, path, and timestamps)'
          ]
        },
        {
          heading: 'What we do not collect',
          body: 'We do not ask for your name, email, password, payment card, phone number, or location as part of using the builder. We do not run advertising pixels, third-party analytics SDKs, or tracking scripts on this UI. We do not sell personal data.',
          items: [
            'No product analytics dashboard on visitor behaviour',
            'No third-party ad or retargeting cookies set by RedAnvil',
            'No social login or OAuth identity from this app'
          ]
        },
        {
          heading: 'Why we process it',
          body: 'We process the data above only to operate the product you asked for:',
          items: [
            'Generate and return a PRD from your prompt and answers',
            'Queue build jobs for the RedAnvil loop when you submit',
            'Show a public library of PRDs people chose to save',
            'Remember your theme preference on the same device',
            'Keep the site available and protected on Cloudflare infrastructure'
          ]
        },
        {
          heading: 'Who else receives it',
          body: 'Hosting, storage, and serverless functions run on Cloudflare (Pages, Pages Functions, and D1). Cloudflare processes request and storage data under its own terms and privacy policy to provide that infrastructure. We do not hand your prompts to advertising partners. Public saved PRDs are visible to anyone who loads the Saved page or a shared PRD URL.'
        },
        {
          heading: 'Cookies and local storage',
          body: 'RedAnvil does not set tracking cookies. The only intentional client storage we use is localStorage for theme preference (`theme` key: light or dark). Your browser may also hold ordinary session or cache data for any static site. Clear site data in the browser to remove the theme preference.'
        },
        {
          heading: 'Where data lives and transfers',
          body: 'Application data for this product lives in Cloudflare\'s network, including D1 for jobs and saved PRDs. Cloudflare operates globally, so request handling and storage may involve transfers outside your country. We do not run a separate RedAnvil user database outside that stack.'
        },
        {
          heading: 'Retention',
          body: 'Queued jobs and saved PRDs remain until a maintainer removes them or the storage is wiped. We do not promise a fixed auto-delete schedule. Host access logs follow Cloudflare\'s retention practices. Theme preference stays on your device until you clear it.'
        },
        {
          heading: 'Your rights',
          body: 'Depending on where you live, you may have rights to access, correct, delete, port, or object to certain processing of personal data. For this app that mainly covers content you submitted or saved. To exercise a right, open a GitHub issue titled "Privacy request" at https://github.com/brianference/redanvil/issues and describe the record (public PRD URL, approximate time, or slug). We may need enough detail to find the row. We will not invent accounts we never created.',
          items: [
            'Access: we can point you at public saved PRDs; for other stored jobs we will look up what we can from the details you give',
            'Correction or deletion: request removal of a saved PRD or related stored content you can identify',
            'Portability: download your PRD markdown yourself, or ask for a copy of a saved record you identify',
            'Objection: stop using the service; request deletion of saved content you control'
          ]
        },
        {
          heading: 'Children',
          body: 'The app builder is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child submitted data here, contact us via a privacy-titled GitHub issue and we will delete what we can identify.'
        },
        {
          heading: 'Security',
          body: 'We rely on Cloudflare\'s platform controls for transport and edge protection. Saved PRDs are intentionally public once published -- treat that as a confidentiality boundary, not a bug. No method of transmission or storage is perfectly secure. Do not submit secrets, production credentials, or private customer data into prompts or saved documents.'
        },
        {
          heading: 'Changes to this policy',
          body: 'We may update this policy when the product or hosting setup changes. The date at the top of this page is the signal. Continued use after a change means you accept the updated notice. Material changes get a new date here rather than a separate mailing list (we have no email list).'
        },
        {
          heading: 'Contact for privacy',
          body: 'Privacy questions and requests: open an issue at https://github.com/brianference/redanvil/issues with "Privacy request" in the title. Source code for this app is at the same repository.'
        }
      ]
    },
    terms: {
      title: 'Terms and Conditions',
      updated: 'Last updated 27 July 2026',
      intro:
        'These terms cover the RedAnvil app builder at https://redanvil.pages.dev. By using the site you agree to them. If you do not agree, do not use the service.',
      sections: [
        {
          heading: 'Acceptance and eligibility',
          body: 'You must be able to form a binding agreement under the laws that apply to you. If you use RedAnvil for an organization, you confirm you are allowed to accept these terms for it. There are no accounts; using the site is acceptance.'
        },
        {
          heading: 'What the service is',
          body: 'RedAnvil is a free tool that turns a typed prompt and short wizard answers into a downloadable PRD, and optionally queues a build job and saves a PRD to a public library. It does not host the finished product you described, process payments, or provide managed professional services.'
        },
        {
          heading: 'Central disclaimer',
          body: 'A generated PRD is a starting specification, not verified engineering, legal, security, or product advice. Estimates and stack choices can be wrong. Anything you save to the site is publicly visible on the Saved page and at its share URL -- do not put confidential product plans, personal data about others, or secrets into content you save. You are responsible for reviewing output before you build or ship from it.'
        },
        {
          heading: 'Acceptable use',
          body: 'Use the service only for lawful purposes. You agree not to:',
          items: [
            'Break the law or infringe others\' rights through prompts, saved PRDs, or apps you build from them',
            'Probe, disrupt, overload, or reverse-engineer the service beyond ordinary use of the public APIs',
            'Submit malware, abuse, harassment, or content you do not have the right to publish',
            'Treat the public library as private storage for confidential or regulated data'
          ]
        },
        {
          heading: 'Intellectual property and source',
          body: 'You keep rights in the prompts you enter and in the PRDs you generate, subject to the public nature of anything you save. RedAnvil branding, site design, and project code remain with their owners. Project source is public at https://github.com/brianference/redanvil; third-party packages keep their own licences. Do not strip notices from code you reuse from the repository when a licence requires them.'
        },
        {
          heading: 'Third-party services',
          body: 'The site is hosted on Cloudflare and may link to GitHub, the RedAnvil dashboard, or deployed example apps. Those services have their own terms and privacy policies. We are not responsible for third-party content, uptime, or practices.'
        },
        {
          heading: 'Disclaimer of warranties',
          body: 'The service is provided "as is" and "as available," without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that generated PRDs are complete, accurate, or safe to implement without your own review.'
        },
        {
          heading: 'Limitation of liability',
          body: 'To the maximum extent permitted by law, RedAnvil and its maintainers are not liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of the service or reliance on generated output. Our total liability for any claim relating to the service is limited to zero dollars, because the service is free.'
        },
        {
          heading: 'Indemnity',
          body: 'You agree to defend and hold harmless RedAnvil and its maintainers from claims, damages, and expenses (including reasonable legal fees) arising from your prompts, saved content, apps you build, or your breach of these terms.'
        },
        {
          heading: 'Availability',
          body: 'We may change, suspend, or discontinue features, including the public library and job queue, without notice. We do not promise uptime, support response times, or that a queued job will run. Content may be removed if it violates these terms or the law.'
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
    }
  },
  chat: {
    agentName: 'RedAnvil',
    greetingBody:
      'Describe the product in plain language. I’ll ask a few sharp questions, then generate a downloadable PRD you can ship to engineering.',
    greetingMeta: 'Full-stack scope · Mobile-first · No account required to start',
    starterLine: 'Try a starter, or type your own idea below.',
    howHeading: 'How this works',
    steps: [
      {
        title: 'Describe the product',
        body: 'Plain language is enough. Say what it does and who it is for.'
      },
      {
        title: 'Answer four short questions',
        body: 'App type, sign-in, the nouns it stores, and which features to keep.'
      },
      {
        title: 'Get a downloadable PRD',
        body: 'Features, acceptance criteria, data model, tests, and a build plan.'
      }
    ],
    startersHeading: 'Start from an example',
    chatTitle: 'Describe your app',
    chatSubtitle: 'RedAnvil replies with clarifying questions, then forges the PRD.',
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
    variantsLabel: 'Starter variants',
    variantsHint: 'Pick a concrete starter under this type, or keep the default prompt.',
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
        prompt: 'A multi-tenant SaaS dashboard with team invites, billing, and usage analytics',
        variants: [
          {
            id: 'saas-analytics',
            label: 'Analytics dashboard',
            appType: 'SaaS dashboard',
            prompt:
              'A multi-tenant SaaS analytics dashboard with team invites, usage charts, and CSV export'
          },
          {
            id: 'saas-billing',
            label: 'Team billing & seats',
            appType: 'SaaS dashboard',
            prompt:
              'A SaaS app with seat-based billing, plan upgrades, team invites, and invoice history'
          },
          {
            id: 'saas-admin',
            label: 'Admin console',
            appType: 'SaaS dashboard',
            prompt:
              'A SaaS admin console with role-based access, audit logs, and customer account search'
          },
          {
            id: 'saas-onboarding',
            label: 'Product onboarding',
            appType: 'SaaS dashboard',
            prompt:
              'A SaaS product with guided onboarding, checklist progress, and team workspace setup'
          }
        ]
      },
      {
        id: 'marketplace',
        title: 'Marketplace',
        description: 'Listings, search, checkout, sellers',
        appType: 'Marketplace',
        prompt: 'A marketplace for local makers with listings, search, tips, and pickup slots',
        variants: [
          {
            id: 'market-local',
            label: 'Local services',
            appType: 'Marketplace',
            prompt:
              'A local services marketplace with provider profiles, booking slots, and reviews'
          },
          {
            id: 'market-digital',
            label: 'Digital goods',
            appType: 'Marketplace',
            prompt:
              'A digital goods marketplace with listings, secure download delivery, and seller payouts'
          },
          {
            id: 'market-rentals',
            label: 'Rentals',
            appType: 'Marketplace',
            prompt:
              'A peer-to-peer rentals marketplace with availability calendars, deposits, and return checks'
          },
          {
            id: 'market-makers',
            label: 'Local makers',
            appType: 'Marketplace',
            prompt: 'A marketplace for local makers with listings, search, tips, and pickup slots'
          }
        ]
      },
      {
        id: 'internal',
        title: 'Internal tool',
        description: 'Ops tables, roles, audit trails',
        appType: 'Internal tool',
        prompt: 'An internal ops tool with role-based access, audit trails, and bulk export',
        variants: [
          {
            id: 'internal-ops',
            label: 'Ops queue',
            appType: 'Internal tool',
            prompt:
              'An internal ops queue with role-based access, status transitions, and bulk export'
          },
          {
            id: 'internal-inventory',
            label: 'Inventory tracker',
            appType: 'Internal tool',
            prompt:
              'An internal inventory tracker with stock levels, low-stock alerts, and audit trails'
          },
          {
            id: 'internal-approvals',
            label: 'Approval workflow',
            appType: 'Internal tool',
            prompt:
              'An internal approval workflow with request forms, multi-step review, and audit logs'
          },
          {
            id: 'internal-crm',
            label: 'Lightweight CRM',
            appType: 'Internal tool',
            prompt:
              'A lightweight internal CRM with contacts, notes, pipeline stages, and CSV export'
          }
        ]
      },
      {
        id: 'mobile',
        title: 'Mobile app',
        description: 'iOS/Android flows, push, offline',
        appType: 'Mobile app',
        prompt:
          'A mobile-first app with offline support, push notifications, and simple onboarding',
        variants: [
          {
            id: 'mobile-reminders',
            label: 'Reminders & checklists',
            appType: 'Mobile app',
            prompt:
              'A mobile-first reminders app with checklists, due dates, and push-style notifications'
          },
          {
            id: 'mobile-field',
            label: 'Field capture',
            appType: 'Mobile app',
            prompt:
              'A mobile field capture app with offline notes, photo attachments, and later sync'
          },
          {
            id: 'mobile-habits',
            label: 'Habits & streaks',
            appType: 'Mobile app',
            prompt: 'A mobile habit tracker with daily check-ins, streaks, and simple onboarding'
          },
          {
            id: 'mobile-coach',
            label: 'Daily coach',
            appType: 'Mobile app',
            prompt: 'A mobile coach app with daily prompts, progress history, and offline reading'
          }
        ]
      },
      {
        id: 'api',
        title: 'API / backend',
        description: 'Auth, webhooks, rate limits, OpenAPI docs',
        appType: 'API backend',
        prompt: 'A backend API with auth, webhooks, rate limits, and OpenAPI documentation',
        variants: [
          {
            id: 'api-crud',
            label: 'CRUD + auth',
            appType: 'API backend',
            prompt: 'A backend API with session auth, resource CRUD, rate limits, and OpenAPI docs'
          },
          {
            id: 'api-webhooks',
            label: 'Webhooks hub',
            appType: 'API backend',
            prompt:
              'A webhooks hub API with signed delivery, retry queues, and event subscription CRUD'
          },
          {
            id: 'api-ingest',
            label: 'Data ingest',
            appType: 'API backend',
            prompt:
              'A data ingest API with API keys, schema validation, batch upload, and rate limits'
          },
          {
            id: 'api-bff',
            label: 'BFF for SPA',
            appType: 'API backend',
            prompt:
              'A backend-for-frontend API with cookie sessions, aggregate endpoints, and health checks'
          }
        ]
      }
    ]
  },
  wizard: {
    formLabel: 'App build wizard',
    stepOf: (step: number): string => `Step ${step} of 4`,
    stepTitles: ['App idea', 'Scope', 'Features', 'Review'] as const,
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
    dataStorageLabel: 'Data storage',
    dataStorageHint: 'Optional. Default is simple D1 tables.',
    dataStorageOptions: {
      none: 'None',
      simple: 'Simple (D1 tables)',
      relational: 'Relational + search'
    } as const,
    realtimeLabel: 'Realtime updates?',
    realtimeYes: 'Yes',
    realtimeNo: 'No',
    realtimeHint: 'Optional. Live refresh or push-style updates (default no).',
    integrationsLabel: 'Integrations',
    integrationsPlaceholder: 'e.g. Stripe, email, webhooks',
    integrationsHint: 'Optional. Free text or pick common chips.',
    integrationsChipsLabel: 'Common integrations',
    integrationsChips: ['Stripe', 'Email', 'Webhooks', 'SMS'] as const,
    featuresHeading: 'Choose features for the PRD',
    featuresHint:
      'RedAnvil inferred these from your scope. Keep MVP items, drop what you do not need, or add beyond-MVP work before forging.',
    featuresListLabel: 'Suggested features',
    featuresMvpBadge: 'MVP',
    featuresRequired: 'Select at least one feature to continue.',
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
    reviewDataStorage: 'Data storage:',
    reviewRealtime: 'Realtime:',
    reviewIntegrations: 'Integrations:',
    reviewFeatures: 'Features:',
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
