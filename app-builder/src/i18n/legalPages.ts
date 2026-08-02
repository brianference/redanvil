/**
 * Terms, Privacy, About and Contact copy.
 *
 * Terms and Privacy live in dedicated files (`terms.ts`, `privacy.ts`) so
 * fe-legal-substance can find them by name and count substance there. About and
 * Contact stay here; all four surface through `en.pages`.
 */
import { privacy } from './privacy';
import { terms } from './terms';

export const legalPages = {
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
        body: "The wider RedAnvil project builds apps behind an automated gate: strict typing, tests, accessibility, security checks, and a real visual review. A build passes only when the score meets the threshold (default 90). The companion dashboard at https://redanvil-dashboard.pages.dev lists those gate results for RedAnvil's own builds."
      },
      {
        heading: 'What this is not',
        body: 'This site does not compile, deploy, or host the app you described. A generated PRD is a starting specification. It is not verified engineering advice, a legal review, a security audit, or a guarantee that a build will pass the gate or ship on time.'
      },
      {
        heading: 'Source and stack',
        body: "Source is public at https://github.com/brianference/redanvil. Hosting, storage, and functions use Cloudflare Pages, Pages Functions, and D1. Theme preference is stored only in your browser's localStorage."
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
  privacy,
  terms
} as const;
