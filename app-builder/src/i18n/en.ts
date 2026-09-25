/**
 * Central English locale bundle for all user-facing copy.
 * Components must reference these keys; no inline UI strings.
 */
import { jobStatus } from './jobStatus';
import { legalPages } from './legalPages';
import { templates } from './templates';

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
      readyBadge: 'PRD READY',
      referencesHeading: 'Stack documentation',
      referencesIntro: 'Official docs for the technologies this PRD asks the builder to use.',
      referenceOpensNewTab: '(opens in a new tab)'
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
  templates,
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
  jobStatus,
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
