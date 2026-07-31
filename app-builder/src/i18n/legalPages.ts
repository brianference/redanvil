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
    updated: 'Last updated 31 July 2026',
    intro:
      'This policy describes how the RedAnvil app builder at https://redanvil.pages.dev handles information. There are no user accounts and no sign-in. PRD text is generated in your browser. Server storage is Cloudflare D1 for optional job rows and for PRDs you choose to save. Saved PRDs and the job list are public API surfaces. We do not run ads or product analytics on this UI.',
    sections: [
      {
        heading: 'Who we are and how to reach us',
        body: 'RedAnvil is a personal open project. There is no company registration page, postal address, or phone line published with this app. The contact route is the public GitHub repository: open an issue at https://github.com/brianference/redanvil/issues. For privacy access, correction, or deletion requests, title the issue "Privacy request" and include enough detail to find the record (public PRD URL, slug, or approximate time). The same Contact page on this site describes what to include in a useful report.'
      },
      {
        heading: 'No accounts',
        body: 'The app builder does not offer registration, login, passwords, session cookies for identity, OAuth, or social sign-in. We do not create a user profile table. Anything stored server-side is tied to the content of a job or PRD row, not to a named account. If you stop using the site, there is no account to close; residual data is limited to what was written to D1 as described below.'
      },
      {
        heading: 'How the product processes your input',
        body: 'The clarifying wizard runs entirely in your browser. The structured PRD (markdown, title, slug) is produced by client-side code when you finish the flow. That generation path does not call a third-party large-language-model API from this app. When you submit the wizard, the browser POSTs a small JSON body to our Pages Function at /api/submit (prompt text, app type, whether the described app needs auth, and an entity count). That request is what can create a job row in D1. Separately, if you choose Save, the browser POSTs the generated slug, title, prompt, and full markdown to /api/prds. If you only download the markdown and never save, the full PRD body is not written to our database by that action.'
      },
      {
        heading: 'What we collect and store',
        body: 'Depending on what you do, the following may be processed or stored:',
        items: [
          'Job rows (when you submit): id, slug derived from the prompt, the prompt string, target type (fullstack-web), gate threshold (90), status (for example queued), and created_at. These live in the D1 jobs table.',
          'Saved PRD rows (when you save): id, slug, title, prompt, full markdown, and created_at in the D1 prds table.',
          'Theme preference on your device only: localStorage key theme with value light or dark (set by the theme toggle).',
          'Request metadata that Cloudflare may log while serving Pages, Functions, and D1 (for example IP address, user agent, path, and timestamps under Cloudflare’s own practices).'
        ]
      },
      {
        heading: 'What is public by design',
        body: 'Several surfaces are intentionally unauthenticated. Treat them as world-readable, not private storage.',
        items: [
          'GET /api/prds returns recent saved PRD metadata (id, slug, title, created_at) for the public Saved page.',
          'GET /api/prd/:id returns the full saved row, including prompt and markdown, to anyone who has the id.',
          'GET /api/jobs returns recent job rows, including the stored prompt text, for the build loop and related tooling.',
          'The Saved UI lists public entries; a share URL of the form /prd/<id> exposes that document to anyone with the link.'
        ]
      },
      {
        heading: 'What we do not collect',
        body: 'We do not ask for your name, email address, password, payment card, phone number, or precise location as part of using the builder. We do not run advertising pixels, third-party product-analytics SDKs, or retargeting scripts in this UI. We do not sell personal data. There is no mailing list and no marketing profile built from your use of this site.',
        items: [
          'No identity or billing fields in the D1 schema for this app',
          'No RedAnvil-set tracking or advertising cookies',
          'No social login or OAuth identity from this app',
          'No server-side copy of the full PRD markdown unless you use Save'
        ]
      },
      {
        heading: 'Why we process it',
        body: 'We process the data above only to run the product features you invoke:',
        items: [
          'Queue a build job when you submit the wizard so the RedAnvil loop or dashboard can pick up work',
          'Persist and list PRDs people chose to publish in the public library',
          'Serve those records over the public API routes above',
          'Remember light/dark theme on the same browser',
          'Operate hosting, routing, and storage on Cloudflare infrastructure'
        ]
      },
      {
        heading: 'Third-party processors and subprocessors',
        body: 'The only infrastructure processor this app is built on is Cloudflare: Pages (static site), Pages Functions (API handlers), and D1 (SQLite-backed database for jobs and prds). Cloudflare receives the request and storage data needed to provide that platform, under Cloudflare’s terms and privacy policy. We do not integrate advertising networks, payment processors, email delivery vendors, or external AI completion APIs into the app-builder request path. Outbound links (for example GitHub for source and issues, or example app URLs) send you to those sites under their own policies; those visits are not a transfer we perform on your behalf unless you follow the link.'
      },
      {
        heading: 'Cookies and local storage',
        body: 'RedAnvil application code does not set tracking cookies and does not use session cookies for accounts (there are no accounts). The only intentional client persistence we implement is localStorage for theme preference under the key theme (values light or dark). Wizard answers and generated PRD text for an in-progress session live in page memory until you leave or reset; they are not written to localStorage by the app. Your browser may still keep ordinary HTTP cache entries for static assets. Clear site data in the browser to remove the theme key.'
      },
      {
        heading: 'Where data lives and international transfers',
        body: 'Application data for this product is stored in Cloudflare D1 bound to this Pages project (database name app-builder-db in configuration). Static assets and Functions run on Cloudflare’s network. Cloudflare operates globally, so request handling and storage may involve processing outside your country. We do not maintain a separate RedAnvil user database outside that stack.'
      },
      {
        heading: 'Retention and deletion',
        body: 'There is no automatic expiry job in the app for jobs or prds. Rows remain until a maintainer deletes them, the database is wiped, or the project is retired. The public APIs expose list and create/read paths; there is no self-service delete endpoint for end users. Theme preference remains on your device until you clear it. Cloudflare edge or access logs, if any, follow Cloudflare’s retention practices, which we do not control from this repository. If you want a specific saved PRD or identifiable job prompt removed, open a GitHub issue titled "Privacy request" with the public URL, id, slug, or enough timing detail to find the row. We will remove what we can identify; we cannot invent or locate records without identifiers, and we cannot erase copies others may have already downloaded from a public URL.'
      },
      {
        heading: 'What you can request and how',
        body: 'Depending on where you live, you may have rights to access, correct, delete, port, or object to certain processing of personal data. For this app those rights mainly concern content you submitted or saved, not an account profile we never created. Exercise them by opening https://github.com/brianference/redanvil/issues with "Privacy request" in the title. There is no SLA; response depends on maintainer availability.',
        items: [
          'Access: public saved PRDs are already readable at their URLs; for a job row, provide time, slug, or prompt fragment so we can search D1',
          'Correction: we can update or replace a saved row if you identify it and supply the corrected content, or remove it if correction is not practical',
          'Deletion: request removal of a saved PRD or job row you can identify',
          'Portability: download markdown yourself from the UI or a public PRD page, or ask for a copy of a row you identify',
          'Objection or restriction: stop using the service and request deletion of stored content you control'
        ]
      },
      {
        heading: 'Children',
        body: 'The app builder is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child submitted data here, open a GitHub issue titled "Privacy request" describing the record. We will delete what we can identify from the details you provide.'
      },
      {
        heading: 'Security practices in this codebase',
        body: 'What this app actually implements: HTTPS is provided by Cloudflare for the hosted site; API handlers validate JSON bodies with Zod and bound string lengths; D1 writes use parameterized statements (no string-concatenated SQL in the handlers); responses set x-content-type-options: nosniff and same-origin CORS rather than a wildcard. What this app does not claim: we do not assert application-layer encryption at rest, a formal SOC 2 report, or that public library content is confidential. Saved PRDs and job prompts on the public APIs are intentionally readable. Do not put secrets, production credentials, private customer data, or regulated personal data into prompts or saved documents. No method of transmission or storage is perfectly secure.'
      },
      {
        heading: 'Changes to this policy',
        body: 'We may update this policy when the product, APIs, or hosting setup changes. The "Last updated" line at the top of this page is the notice mechanism. We do not operate an email list for policy notices. Continued use of the site after the date changes means you accept the revised policy for subsequent use. For material changes, the updated text on this page is the record; check the date when you care about the current rules.'
      },
      {
        heading: 'Contact for privacy',
        body: 'Privacy questions and requests: open an issue at https://github.com/brianference/redanvil/issues with "Privacy request" in the title. Source for the app builder, including this policy text and the D1 migrations, is in the same repository. General product contact details are also summarized on the Contact page of this site.'
      }
    ]
  },
  terms: {
    title: 'Terms and Conditions',
    updated: 'Last updated 31 July 2026',
    intro:
      'These terms cover the RedAnvil app builder at https://redanvil.pages.dev. By using the site you agree to them. If you do not agree, do not use the service. There are no paid plans and no accounts on this product.',
    sections: [
      {
        heading: 'Acceptance and eligibility',
        body: 'You must be able to form a binding agreement under the laws that apply to you. If you use RedAnvil for an organization, you confirm you are allowed to accept these terms for it. There is no registration step; loading the site, running the wizard, submitting a job, or saving a PRD is acceptance of these terms for that use. If you cannot accept them, leave the site and do not submit or save content.'
      },
      {
        heading: 'What the service is',
        body: 'RedAnvil is a free tool that helps you turn a plain-language product idea into a structured product requirements document (PRD). You describe the app, answer a short wizard (app type, auth need, entities, features and related scope), and the browser generates a downloadable markdown PRD with stack choices, data-model guidance, acceptance criteria, test plan, and a paste-ready build prompt. When you submit, the server may queue a job record in Cloudflare D1 for the RedAnvil build loop. When you save, the full PRD is stored in D1 and listed in the public library. The service does not compile, deploy, host, or operate the application you described. It does not process payments, provide managed professional services, or create user accounts.'
      },
      {
        heading: 'Central disclaimer',
        body: 'A generated PRD is a starting specification produced by deterministic client-side templates and rules, not verified engineering, legal, security, accessibility, or product advice. Effort estimates, feature lists, and stack choices can be incomplete or wrong for your case. You are responsible for reviewing every section before you build, ship, or rely on the document. Anything you save to the site is publicly visible on the Saved page, at its share URL, and via the public PRD API. Job prompts stored on submit are also listed on the public jobs API. Do not put confidential product plans, secrets, credentials, or personal data about others into content you submit or save.'
      },
      {
        heading: 'Public library and job queue',
        body: 'The Saved library is a shared, unauthenticated catalogue, not a private vault. Anyone can list recent saves and open a PRD by id. The jobs list endpoint is likewise unauthenticated and returns prompt text for recent jobs. By saving or submitting you understand that content may be read, copied, or linked by others. Maintainers may remove content that violates these terms or the law, or that is abusive or spam, without a private support ticket system.'
      },
      {
        heading: 'Acceptable use',
        body: 'Use the service only for lawful purposes. You agree not to:',
        items: [
          "Break the law or infringe others' rights through prompts, saved PRDs, or apps you build from them",
          'Probe, disrupt, overload, scrape abusively, or reverse-engineer the service beyond ordinary use of the documented public APIs',
          'Submit malware, abuse, harassment, defamation, or content you do not have the right to publish',
          'Treat the public library or job queue as private storage for confidential, regulated, or secret material',
          'Attempt to impersonate maintainers or misrepresent the origin of generated documents'
        ]
      },
      {
        heading: 'Your content and responsibility',
        body: 'You are responsible for the prompts and wizard answers you enter and for any PRD you choose to save. You confirm you have the rights needed to submit that material and to make saved material public. You must not submit content that you are not allowed to publish. If your content causes a complaint or legal demand, you are responsible for the substance of what you published. Download copies you need; we do not guarantee that a public row will remain available forever.'
      },
      {
        heading: 'Intellectual property in generated output',
        body: 'As between you and the maintainers of this personal project, you may use the PRD markdown generated from your own prompts for any purpose, including building software, subject to these terms and to the public nature of anything you save. That does not transfer ownership of RedAnvil branding, site design, or the project source code. Project source is public at https://github.com/brianference/redanvil under whatever licence files the repository states; third-party packages keep their own licences. Do not strip notices from code you reuse from the repository when a licence requires them. Template wording that appears in many generated PRDs is part of the tool’s scaffolding; exclusive ownership of generic scaffold text is not granted to any single user.'
      },
      {
        heading: 'Third-party services',
        body: 'The site is hosted on Cloudflare (Pages, Pages Functions, and D1). It may link to GitHub, the RedAnvil dashboard, example apps, or other external URLs. Those services have their own terms and privacy policies. We are not responsible for third-party content, uptime, security, or practices. Using an external coding agent with a PRD you exported is a relationship between you and that agent’s provider, not a feature we operate inside this privacy boundary.'
      },
      {
        heading: 'Disclaimer of warranties',
        body: 'The service is provided "as is" and "as available," without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that generated PRDs are complete, accurate, non-infringing, or safe to implement without your own review. We do not warrant uninterrupted availability, error-free operation, or that a queued job will ever be executed. Some jurisdictions do not allow certain warranty exclusions; in those places, exclusions apply only to the extent permitted.'
      },
      {
        heading: 'Limitation of liability',
        body: 'To the maximum extent permitted by law, RedAnvil and its maintainers are not liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, lost goodwill, business interruption, or substitute services, arising from your use of the service or reliance on generated output, whether based on contract, tort, or any other theory. Our total liability for any claim relating to the service is limited to zero US dollars, because the service is free and provided without paid consideration. Mandatory rights that cannot be waived in your jurisdiction remain intact.'
      },
      {
        heading: 'Indemnity',
        body: 'You agree to defend and hold harmless RedAnvil and its maintainers from claims, damages, losses, and expenses (including reasonable legal fees) arising from your prompts, saved content, apps you build from a PRD, misuse of the public APIs, or your breach of these terms, to the extent permitted by applicable law.'
      },
      {
        heading: 'Availability and changes to the service',
        body: 'We may change, suspend, or discontinue features -- including the wizard, public library, job queue, or entire site -- without notice and without liability. We do not promise uptime, support response times, or that a queued job will run. Content may be removed for legal compliance, abuse, spam, or operational reasons. The project is maintained on a best-effort basis with no paid support SLA.'
      },
      {
        heading: 'Termination',
        body: 'You may stop using the service at any time. Because there are no accounts, termination of use is simply leaving the site and, if you wish, requesting deletion of identifiable stored rows via a GitHub privacy issue. We may refuse or block further use, remove content, or shut down endpoints if you violate these terms, if continued operation is unlawful, or if we discontinue the project. Provisions that by their nature should survive (including disclaimers, liability limits, indemnity, and intellectual-property notices) continue after your use ends.'
      },
      {
        heading: 'Changes to these terms',
        body: 'We may update these terms when the product or legal needs change. The "Last updated" line at the top of this page is how notice is given; we do not email users. Continued use after the date changes means you accept the new terms for subsequent use. If you do not accept a change, stop using the service and request deletion of any public content you care about removing.'
      },
      {
        heading: 'Governing law and disputes',
        body: 'These terms are conditions of use for a free personal open project; they are not a substitute for advice from a lawyer in your jurisdiction. Before filing a formal claim, open a GitHub issue at https://github.com/brianference/redanvil/issues describing the dispute and allow a reasonable time to respond. Where the law requires a governing jurisdiction to be stated and permits the parties to choose, the laws of the United States apply to the extent they govern a personal project of this kind, without creating a fictional company domicile. Mandatory consumer protections in your place of residence that cannot be waived still apply. Nothing here requires you to waive rights you are legally forbidden to waive.'
      },
      {
        heading: 'Contact',
        body: 'Questions about these terms: open an issue at https://github.com/brianference/redanvil/issues. For privacy-specific requests (access, correction, deletion), title the issue "Privacy request". For security concerns, title it "Security report" and avoid pasting exploit payloads or secrets into a public thread when you can describe impact without them. The Contact page on this site lists the same routes and what to include in a useful report.'
      }
    ]
  }
} as const;
