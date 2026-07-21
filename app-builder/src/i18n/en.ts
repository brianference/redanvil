/**
 * Central English locale bundle for all user-facing copy.
 * Components must reference these keys; no inline UI strings.
 */
export const en = {
  app: {
    name: 'app-builder',
    primaryNav: 'Primary',
    footerCopyright: '© app-builder'
  },
  pages: {
    home: {
      title: 'Build an app',
      jobReady: (slug: string, threshold: number): string =>
        `Job ready: ${slug} (threshold ${threshold})`
    },
    about: {
      title: 'About',
      body: 'About content.'
    },
    contact: {
      title: 'Contact',
      body: 'Contact content.'
    },
    privacy: {
      title: 'Privacy',
      body: 'Privacy content.'
    },
    terms: {
      title: 'Terms',
      body: 'Terms content.'
    }
  },
  wizard: {
    formLabel: 'App build wizard',
    stepOf: (step: number): string => `Step ${step} of 3`,
    promptLabel: 'What app do you want?',
    promptHint: (minLength: number): string =>
      `Describe the product in a short sentence (at least ${minLength} characters).`,
    appTypeLabel: 'App type',
    appTypePlaceholder: 'e.g. marketplace, dashboard, content site',
    authLabel: 'Authentication needed',
    entitiesLabel: 'Main entities',
    entitiesPlaceholder: 'e.g. User, Recipe, Favorite',
    entitiesHint: 'Comma-separated domain nouns the app will store or manage.',
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
    submit: 'Submit',
    submitting: 'Submitting…',
    errors: {
      invalidResponse: 'Invalid response from server',
      submitFailed: (status: number): string => `Submit failed (${status})`,
      invalidJobPayload: 'Invalid job payload from server',
      network: 'Network error submitting job',
      timeout: 'Request timed out'
    }
  }
} as const;

/** English locale type derived from the bundle (no any). */
export type Locale = typeof en;
