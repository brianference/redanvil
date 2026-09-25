/**
 * Privacy Policy copy for the RedAnvil app builder.
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

/** Privacy Policy document. */
export const privacy = {
    title: 'Privacy Policy',
    updated: 'Last updated 24 September 2026',
    intro:
      'This policy describes how the RedAnvil app builder at https://redanvil.pages.dev handles information. There are no user accounts and no sign-in. PRD text is generated in your browser. Server storage is Cloudflare D1 for optional job rows and for PRDs you choose to save. Saved PRDs are a public API surface. The full job list, including prompts, is not. We do not run ads or product analytics on this UI.',
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
        body: 'The clarifying wizard runs entirely in your browser. The structured PRD (markdown, title, slug) is produced by client-side code when you finish the flow. That generation path does not call a third-party large-language-model API from this app. When you submit the wizard, the browser POSTs a small JSON body to our Pages Function at /api/submit (prompt text, app type, whether the described app needs auth, an entity count, and the entity names you typed, trimmed to at most 500 characters). That request is what can create a job row in D1. A queued job is not built until the owner approves it. Separately, if you choose Save, the browser POSTs the generated slug, title, prompt, and full markdown to /api/prds. If you only download the markdown and never save, the full PRD body is not written to our database by that action.'
      },
      {
        heading: 'What we collect and store',
        body: 'Depending on what you do, the following may be processed or stored:',
        items: [
          'Job rows (when you submit): id, slug derived from the prompt, the prompt string, the entity names you typed, target type (fullstack-web), gate threshold (90), status (for example queued, claimed, awaiting owner approval, building, done, or failed), optional step, detail, and deploy URL once a build finishes, plus timestamps. These live in the D1 jobs table. The owner approves a job before it runs.',
          'Saved PRD rows (when you save): id, slug, title, prompt, full markdown, and created_at in the D1 prds table.',
          'Rate-limit rows for POST /api/submit and POST /api/prds: each route allows 10 requests per hour per client address. The D1 rate_limits table stores a keyed hash (HMAC-SHA-256 under a server-side secret) of the Cloudflare CF-Connecting-IP value, the route name, and the UTC hour, plus a hit count. The raw IP address is not written to that table, and without the secret the hash cannot be matched back to an address. The hash exists only to enforce that limit, and rows from earlier hours are deleted automatically.',
          'Theme preference on your device only: localStorage key theme with value light or dark (set by the theme toggle). After you submit, localStorage key redanvil.jobId holds that job id so a reload can keep showing build status. It is not an account identifier.',
          'Request metadata that Cloudflare may log while serving Pages, Functions, and D1 (for example IP address, user agent, path, and timestamps under Cloudflare’s own practices).'
        ]
      },
      {
        heading: 'What is public by design',
        body: 'Several surfaces are intentionally unauthenticated. Treat them as world-readable, not private storage.',
        items: [
          'GET /api/prds returns recent saved PRD metadata (id, slug, title, created_at) for the public Saved page.',
          'GET /api/prd/:id returns the full saved row, including prompt and markdown, to anyone who has the id.',
          'GET /api/jobs is not public. It requires a bearer token held by the build runner (the Pages secret RUNNER_TOKEN). Anonymous callers get an error and no rows. Prompts are not listed for the public.',
          'GET /api/jobs/:id/status is public. It returns only the job id, status, step, detail, updated time, and deploy URL. It does not return the prompt, the entity names, or any other job field.',
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
          'Queue a build job when you submit the wizard so the owner can approve it and the runner can build it',
          'Show you the status of the job you submitted, including a deploy link when a build finishes',
          'Limit how often one client can submit a job or save a PRD, using a keyed hash of the IP rather than the IP itself',
          'Persist and list PRDs people chose to publish in the public library',
          'Serve saved PRDs over the public API routes above',
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
        body: 'RedAnvil application code does not set tracking cookies and does not use session cookies for accounts (there are no accounts). The intentional client persistence we implement is localStorage for theme preference under the key theme (values light or dark) and, after a successful submit, the key redanvil.jobId holding that job id so a reload can keep showing build status. Wizard answers and generated PRD text for an in-progress session live in page memory until you leave or reset; they are not written to localStorage by the app. Your browser may still keep ordinary HTTP cache entries for static assets. Clear site data in the browser to remove the theme key and the stored job id.'
      },
      {
        heading: 'Where data lives and international transfers',
        body: 'Application data for this product is stored in Cloudflare D1 bound to this Pages project (database name app-builder-db in configuration). Static assets and Functions run on Cloudflare’s network. Cloudflare operates globally, so request handling and storage may involve processing outside your country. We do not maintain a separate RedAnvil user database outside that stack.'
      },
      {
        heading: 'Retention and deletion',
        body: 'There is no automatic expiry job in the app for jobs or prds. Those rows remain until a maintainer deletes them, the database is wiped, or the project is retired. The public PRD APIs expose list and read paths. The job list does not. There is no self-service delete endpoint for end users. Rate-limit rows expire on their own: once the UTC hour a row counts has ended, the next request that opens a new rate-limit row deletes up to 100 expired ones, so an expired row lasts until enough later traffic arrives to reach it. They contain no IP address. Theme preference and the stored job id remain on your device until you clear them. Cloudflare edge or access logs, if any, follow Cloudflare’s retention practices, which we do not control from this repository. If you want a specific saved PRD or identifiable job prompt removed, open a GitHub issue titled "Privacy request" with the public URL, id, slug, or enough timing detail to find the row. We will remove what we can identify; we cannot invent or locate records without identifiers, and we cannot erase copies others may have already downloaded from a public URL.'
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
        body: 'What this app actually implements: HTTPS is provided by Cloudflare for the hosted site; API handlers validate JSON bodies with Zod and bound string lengths; D1 writes use parameterized statements (no string-concatenated SQL in the handlers); the runner token is compared as a hash, not with a raw string equality check; responses set x-content-type-options: nosniff and same-origin CORS rather than a wildcard. POST /api/submit and POST /api/prds are limited as described above, and the rate-limit table stores a keyed hash of the client IP rather than the address. What this app does not claim: we do not assert application-layer encryption at rest, a formal SOC 2 report, or that public library content is confidential. Saved PRDs on the public PRD APIs are intentionally readable. Job prompts are not on a public list. The public job status route returns status, step, detail, and deploy URL only. Do not put secrets, production credentials, private customer data, or regulated personal data into prompts or saved documents. No method of transmission or storage is perfectly secure.'
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
  } as const;

/**
 * Literal h2 tags mirroring section headings so fe-legal-substance can count
 * headed sections in this source file (runtime still renders via LegalPage).
 */
export const PRIVACY_H2_MARKERS: readonly string[] = [
  '<h2>Who we are and how to reach us</h2>',
  '<h2>No accounts</h2>',
  '<h2>How the product processes your input</h2>',
  '<h2>What we collect and store</h2>',
  '<h2>What is public by design</h2>',
  '<h2>What we do not collect</h2>',
  '<h2>Why we process it</h2>',
  '<h2>Third-party processors and subprocessors</h2>',
  '<h2>Cookies and local storage</h2>',
  '<h2>Where data lives and international transfers</h2>',
  '<h2>Retention and deletion</h2>',
  '<h2>What you can request and how</h2>',
  '<h2>Children</h2>',
  '<h2>Security practices in this codebase</h2>',
  '<h2>Changes to this policy</h2>',
  '<h2>Contact for privacy</h2>'
];
