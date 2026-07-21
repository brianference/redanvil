/**
 * Central English locale bundle for all user-facing copy.
 * Components must reference these keys; no inline UI strings.
 */
export const en = {
  app: {
    name: 'RedAnvil',
    primaryNav: 'Primary',
    footerCopyright: '© RedAnvil'
  },
  pages: {
    home: {
      title: 'Build an app',
      jobReady: (slug: string, threshold: number): string =>
        `Job ready: ${slug} (threshold ${threshold})`
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
          body: 'The fastest way to reach us is to open an issue or discussion on the RedAnvil GitHub repository. We read every one.'
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
      intro: 'RedAnvil is built to collect as little as possible. This policy explains what happens to your data.',
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
      intro: 'By using RedAnvil you agree to these terms. If you do not agree, do not use the service.',
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
