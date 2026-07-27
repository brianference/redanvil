/**
 * Terms, Privacy, About and Contact copy.
 *
 * Split out of `en.ts` because the real documents (R30) took the locale bundle
 * past the 600-line file limit. A four-document legal corpus is its own concern,
 * and keeping it here leaves `en.ts` navigable.
 */
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
        body: "Application data for this product lives in Cloudflare's network, including D1 for jobs and saved PRDs. Cloudflare operates globally, so request handling and storage may involve transfers outside your country. We do not run a separate RedAnvil user database outside that stack."
      },
      {
        heading: 'Retention',
        body: "Queued jobs and saved PRDs remain until a maintainer removes them or the storage is wiped. We do not promise a fixed auto-delete schedule. Host access logs follow Cloudflare's retention practices. Theme preference stays on your device until you clear it."
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
        body: "We rely on Cloudflare's platform controls for transport and edge protection. Saved PRDs are intentionally public once published -- treat that as a confidentiality boundary, not a bug. No method of transmission or storage is perfectly secure. Do not submit secrets, production credentials, or private customer data into prompts or saved documents."
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
          "Break the law or infringe others' rights through prompts, saved PRDs, or apps you build from them",
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
} as const;
