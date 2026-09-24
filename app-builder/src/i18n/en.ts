/**
 * Central English locale bundle for all user-facing copy.
 * Components must reference these keys; no inline UI strings.
 */
import { legalPages } from './legalPages';

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
      statsLabel: (name: string): string => `${name} measured stats`,
      viewLive: 'Open the live app',
      viewSource: 'Read the source',
      featuresHeading: 'What it does',
      filtersLabel: 'Filter examples',
      filterEmpty: 'No shipped apps match that filter.',
      /**
       * Catalog header count.
       *
       * @param n - Number of shipped examples.
       */
      shippedCount: (n: number): string => (n === 1 ? '1 shipped' : `${n} shipped`)
    },
    home: {
      title: 'What app should we forge?',
      subtitle:
        'Describe the product in plain language. RedAnvil asks a few questions, then generates a downloadable PRD -- and a real logo and palette to build it in.',
      bannerAlt: 'RedAnvil — forge apps from a prompt',
      /** Fallback when PRD generation fails without a typed message. */
      forgeError: 'Could not forge the PRD from these answers.',
      /** Return to the wizard to fix entities or the product name. */
      forgeErrorBack: 'Back to wizard',
      /** Abandon the session and start over from chat. */
      forgeErrorNew: 'Start over',
      /** Accessible label for the forge failure panel. */
      forgeErrorLabel: 'PRD generation failed'
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
    ...legalPages
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
    entitiesPlaceholder: 'Dog: name, breed, birthDate:date',
    entitiesHint:
      'Separate entities with a semicolon or a new line. Each one is Name: field, field:type, or field->Other. Types are text, int, real, bool, date, datetime. id, created_at, and updated_at are added for you.',
    entitiesExampleLead: 'Example:',
    entitySpecExamples: {
      fallback:
        'Dog: name, breed, birthDate:date; CareTask: title, dueDate:date, repeatDays:int, dog->Dog; CareLog: doneAt:datetime, note, task->CareTask',
      dog: 'Dog: name, breed, birthDate:date; CareTask: title, dueDate:date, repeatDays:int, dog->Dog; CareLog: doneAt:datetime, note, task->CareTask',
      flight:
        'Flight: origin, destination, departsAt:datetime, price:real; Layover: airport, minutes:int, flight->Flight',
      crop: 'Crop: name, daysToHarvest:int; PlantingWindow: method, startsOn:date, crop->Crop',
      recipe: 'Recipe: title, servings:int; Ingredient: name, amount, recipe->Recipe',
      shift: 'Shift: startsAt:datetime, role; Employee: name, shift->Shift'
    },
    entitiesRequired: 'Add at least one entity before continuing.',
    entityNeedsField: (name: string): string =>
      `${name} needs at least one field. List the fields after a colon.`,
    entitiesPreviewLabel: 'Parsed entities',
    entityNoFields: 'no fields yet',
    entityFieldChip: (name: string, typeLabel: string): string => `${name} (${typeLabel})`,
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
  jobStatus: {
    progressLabel: 'Build progress',
    regionLabel: 'Build job status',
    heading: 'Build status',
    ownerApproval:
      'Each build is approved by the owner before it runs. Submitting a job does not start the build.',
    jobId: (id: string): string => `Job ${id}`,
    copyJobId: 'Copy job id',
    copyLabel: 'Copy',
    copied: 'Copied',
    dismiss: 'Dismiss build status',
    startNew: 'Start a new app',
    loading: 'Checking build status…',
    /**
     * Icon, short badge, and one-line headline for a public status.
     * Unknown values keep the raw status instead of an invented label.
     *
     * @param status - Status string from the public endpoint.
     * @returns Badge icon, badge text, and headline.
     */
    statusPresentation: (
      status: string
    ): { icon: string; badge: string; headline: string } => {
      switch (status) {
        case 'queued':
          return { icon: '○', badge: 'Queued', headline: 'In line. Nothing has started.' };
        case 'claimed':
          return { icon: '◉', badge: 'Picked up', headline: 'A runner picked this up.' };
        case 'awaiting_owner':
          return {
            icon: '◎',
            badge: 'Awaiting approval',
            headline: 'Waiting for owner approval.'
          };
        case 'approved':
          return {
            icon: '✓',
            badge: 'Approved',
            headline: 'Approved. The build has not started.'
          };
        case 'building':
          return { icon: '…', badge: 'Building', headline: 'The build is running.' };
        case 'done':
          return { icon: '●', badge: 'Done', headline: 'The app is ready.' };
        case 'failed':
          return { icon: '!', badge: 'Failed', headline: 'The build did not finish.' };
        case 'rejected':
          return { icon: '×', badge: 'Rejected', headline: 'Rejected. It will not be built.' };
        default:
          return { icon: '?', badge: status, headline: `Status: ${status}` };
      }
    },
    /**
     * Process-map order (n8n-prototype/process-map.mjs). One list for ids and labels.
     */
    steps: [
      { id: 'prd', label: 'Product requirements' },
      { id: 'product', label: 'Product brief' },
      { id: 'brainstorm', label: 'Ranked features' },
      { id: 'inspo', label: 'Reference apps' },
      { id: 'reuse', label: 'Search existing code' },
      { id: 'logo', label: 'Brand marks' },
      { id: 'palette', label: 'Colour and type' },
      { id: 'layout', label: 'Layout options' },
      { id: 'decide', label: 'Owner picks the design' },
      { id: 'integration', label: 'Wire the data source' },
      { id: 'testwriter', label: 'Acceptance tests' },
      { id: 'build', label: 'Implement the design' },
      { id: 'content', label: 'Pages and empty states' },
      { id: 'runners', label: 'Run the test lanes' },
      { id: 'visual', label: 'Visual review' },
      { id: 'ui-live', label: 'Drive the deployed UI' },
      { id: 'qa-runtime', label: 'Check deployed routes' },
      { id: 'judge', label: 'Fresh review of the diff' },
      { id: 'qa-data', label: 'Check citations and links' },
      { id: 'user-refuse', label: 'Adversarial acceptance' },
      { id: 'pm', label: 'Assign unmet work' },
      { id: 'debugger', label: 'Find the root cause' },
      { id: 'reverify', label: 'Re-measure the deploy' },
      { id: 'ship', label: 'Deploy and prove the hash' }
    ],
    /**
     * Progress line for a known step.
     *
     * @param index - 1-based position in the catalog.
     * @param total - Catalog length.
     * @param label - Human label for that step.
     * @returns The panel line.
     */
    stepProgress: (index: number, total: number, label: string): string =>
      `Step ${index} of ${total} · ${label}`,
    openDeploy: 'Open the deployed app',
    errors: {
      invalid: 'Could not read the build status',
      loadFailed: 'Could not load the build status',
      network: 'Network error checking build status',
      timeout: 'Build status request timed out'
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
    fidelityTitle: 'Prompt fidelity failed',
    fidelityBody:
      'These requirements did not show up in the features. Add them to the prompt or to the entity fields, then forge again. The PRD is still below.',
    fidelityUnmatchedLabel: 'Not covered',
    errors: {
      generic: 'Could not save the PRD.',
      timeout: 'Save request timed out',
      network: 'Network error saving PRD'
    }
  }
} as const;

/** English locale type derived from the bundle (no any). */
export type Locale = typeof en;
