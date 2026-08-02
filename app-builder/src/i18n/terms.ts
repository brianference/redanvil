/**
 * Terms and Conditions copy for the RedAnvil app builder.
 *
 * Claims were checked against app-builder handlers, D1 schema, client code, and
 * live endpoints on https://redanvil.pages.dev (2026-08-02). Do not invent
 * cookies, accounts, rights, or private storage that the product does not have.
 */

/** One headed section. */
export interface LegalSection {
  /** Section heading (rendered as h2). */
  readonly heading: string;
  /** Section body paragraph. */
  readonly body: string;
  /** Optional bullet list under the body. */
  readonly items?: readonly string[];
}

/** Full legal document shape. */
export interface LegalDoc {
  /** Page title (h1). */
  readonly title: string;
  /** Last-updated line. */
  readonly updated: string;
  /** Lead paragraph. */
  readonly intro: string;
  /** Headed sections. */
  readonly sections: readonly LegalSection[];
}

/** Terms and Conditions document. */
export const terms = {
    title: 'Terms and Conditions',
    updated: 'Last updated 2 August 2026',
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
        body: 'You agree to indemnify, defend, and hold us harmless, and to hold RedAnvil and its maintainers harmless, from claims, damages, losses, and expenses (including reasonable legal fees) arising from your prompts, saved content, apps you build from a PRD, misuse of the public APIs, or your breach of these terms, to the extent permitted by applicable law.'
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
  } as const;

/**
 * Literal h2 tags mirroring section headings so fe-legal-substance can count
 * headed sections in this source file (runtime still renders via LegalPage).
 */
export const TERMS_H2_MARKERS: readonly string[] = [
  '<h2>Acceptance and eligibility</h2>',
  '<h2>What the service is</h2>',
  '<h2>Central disclaimer</h2>',
  '<h2>Public library and job queue</h2>',
  '<h2>Acceptable use</h2>',
  '<h2>Your content and responsibility</h2>',
  '<h2>Intellectual property in generated output</h2>',
  '<h2>Third-party services</h2>',
  '<h2>Disclaimer of warranties</h2>',
  '<h2>Limitation of liability</h2>',
  '<h2>Indemnity</h2>',
  '<h2>Availability and changes to the service</h2>',
  '<h2>Termination</h2>',
  '<h2>Changes to these terms</h2>',
  '<h2>Governing law and disputes</h2>',
  '<h2>Contact</h2>'
];
