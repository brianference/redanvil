/**
 * Central English locale bundle for all user-facing copy.
 * Components must reference these keys; no inline UI strings.
 */
export const en = {
  nav: {
    skipToContent: 'Skip to content',
    home: 'Home',
    sitters: 'Sitters',
    about: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
    contact: 'Contact',
    login: 'Sign in',
    sitterDetail: 'Sitter'
  },
  footer: {
    explore: 'Explore',
    company: 'Company',
    legal: 'Legal',
    siblingProduct: 'RedAnvil'
  },
  home: {
    title: 'Find a trusted pet sitter',
    intro:
      'Browse local sitters by neighbourhood, pet types, nightly rates, and verified reviews. Search narrows the catalog from our database.',
    searchLabel: 'Search sitters',
    searchPlaceholder: 'Neighbourhood, pet type, or name',
    searchSubmit: 'Search',
    loading: 'Loading sitters…',
    loadError: 'Could not load sitters. Try again.',
    errorCount: 'Results unavailable',
    empty: 'No sitters matched. Widen the search or clear filters.',
    perNight: '/night',
    reviews: 'reviews',
    browseAll: 'Browse all sitters',
    resultCountLabel: 'sitters found'
  },
  sitters: {
    title: 'Sitters',
    intro: 'Full catalog of sitters in the Pet Sitter Finder database.',
    loadError: 'Could not load sitters.'
  },
  detail: {
    loadingTitle: 'Loading sitter',
    notFoundTitle: 'Sitter not found',
    notFound:
      'That sitter is not in the catalog. It may have been removed or the link is wrong.',
    errorTitle: 'Something went wrong',
    loadError: 'Could not load this sitter.',
    backToList: 'Back to sitters',
    petTypes: 'Pet types',
    availability: 'Availability',
    sourceLink: 'Industry reference',
    reviewsHeading: 'Reviews',
    noReviews: 'No reviews yet for this sitter.',
    rating: 'Rating'
  },
  login: {
    title: 'Account',
    intro:
      'Register or sign in. Passwords are hashed with PBKDF2 in the Worker; sessions use HTTP-only cookies.',
    signIn: 'Sign in',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    displayName: 'Display name',
    working: 'Working…',
    failed: 'Sign-in failed. Check your details and try again.',
    registered: 'Account created. You are signed in.',
    signedIn: 'You are signed in.'
  },
  notFound: {
    title: 'Page not found',
    body: 'That address is not part of Pet Sitter Finder.',
    home: 'Back to home'
  },
  assistant: {
    open: 'Ask about sitters',
    close: 'Close assistant',
    openLabel: 'Open the sitters assistant',
    region: 'Sitters assistant',
    hint: "Ask about neighbourhoods, pet types, or rates. Answers come from this app's sitter data.",
    inputLabel: 'Your question',
    submit: 'Ask',
    loading: 'Thinking…',
    error: 'The assistant could not answer. Try again.'
  },
  app: {
    name: 'Pet Sitter Finder',
    primaryNav: 'Primary',
    footerCopyright: '© Pet Sitter Finder'
  },
  pages: {
    home: {
      title: 'Pet Sitter Finder',
      intro:
        'Find and book trusted local pet sitters: browse sitters by neighbourhood with verified reviews, per-night rates, the pet types each sitter accepts, and real availability, then request a booking for specific dates.',
      sections: [
        {
          heading: 'What this app does',
          body: 'Pet Sitter Finder is a marketplace for connecting pet owners with local sitters. Search and filter the sitter directory, open a profile for rates and reviews, manage pets on your account, and request bookings for the dates you need. An in-app assistant can answer questions grounded in the sitters stored in this product’s own database.'
        }
      ],
      updated: '2026-08-06'
    },
    about: {
      title: 'About Pet Sitter Finder',
      updated: '2026-08-06',
      intro:
        'Pet Sitter Finder is a web marketplace that helps pet owners find local sitters, compare rates and reviews, and request care for specific dates. This page describes what the product does, how it is built, and what it deliberately does not do.',
      sections: [
        {
          heading: 'What this product is',
          body: 'Pet Sitter Finder is a marketplace for pet sitting. Owners can browse sitters by neighbourhood, see per-night rates, the pet types each sitter accepts, availability, and reviews, then request a booking for a date range. Sitters and owners create accounts so bookings, pets, and reviews stay tied to the right person. The product is free to use in its current form: there is no in-app payment processing, no checkout, and no fees charged through the site. Any money that changes hands for sitting is arranged between owner and sitter outside this application.'
        },
        {
          heading: 'Who it is for',
          body: 'The app is for pet owners who need temporary care and for people who offer sitting. Owners use search, filters, sitter detail pages, pet profiles, and booking requests. Sitters maintain profiles that show neighbourhood, rates, accepted pet types, and availability. Reviews help later visitors judge fit. Both sides need an account for actions that change data on their behalf. Anyone can read public marketing and legal pages without signing in.'
        },
        {
          heading: 'Core features',
          body: 'The product ships as a single web application with these capabilities in scope:',
          items: [
            'Text search and filters over the sitter directory (neighbourhood, rates, pet types, availability)',
            'Sitter list and detail pages with reviews and booking context',
            'User accounts with register, sign-in, and sign-out',
            'Pets linked to an owner account',
            'Booking requests for specific date ranges and statuses',
            'Reviews associated with sitters',
            'An AI assistant that answers from this app’s own sitter data, not general web search',
            'Light and dark themes with a preference stored in the browser'
          ]
        },
        {
          heading: 'How the stack works',
          body: 'The interface is a React and TypeScript single-page app hosted on Cloudflare Pages. API routes run as Cloudflare Pages Functions. Persistent data lives in Cloudflare D1, a SQL database bound to those functions. Requests are validated at the boundary before they touch storage. Passwords are hashed with PBKDF2 via the Web Crypto API; sessions use HMAC-SHA256 tokens delivered as session cookies. There is no long-running Node server, no Express process, and no Supabase project. The AI assistant runs on Cloudflare Workers AI inside a Pages Function and reads sitters from D1 so answers stay grounded in this product’s catalogue.'
        },
        {
          heading: 'Where the data comes from',
          body: 'Sitter profiles, pets, bookings, and reviews are stored in this application’s D1 database. Seed and operator-maintained sitter records power search and the assistant. User-created accounts, pets, booking requests, and reviews are written when you use those features. The assistant does not invent sitters that are not in the database; if a lookup fails or the model call fails, the app surfaces an error rather than a fake success. Rates, availability, and review text reflect what is stored at the time of the request and can change when records are updated.'
        },
        {
          heading: 'Accounts and security posture',
          body: 'Accounts are real. You register with an email and password. Passwords are never stored in plain text; they are hashed with PBKDF2 (SHA-256, a high iteration count) and a per-user salt using Web Crypto on the Worker. After sign-in, a session token is issued and checked with HMAC-SHA256. Session state is held with cookies appropriate for authentication, and session rows live in D1. Signing out ends the session. Traffic is served over HTTPS on Cloudflare. These measures reduce risk; they do not make any system impossible to attack.'
        },
        {
          heading: 'What this app is not',
          body: 'Pet Sitter Finder is not a payment processor, escrow service, insurance product, veterinary service, or emergency dispatch. It does not move money between owners and sitters. It does not guarantee that a sitter will accept a request, appear on time, or care for a pet in any particular way. It is not legal advice, medical advice for animals, or a substitute for meeting a sitter, checking references, or following local rules about animals and boarding. Public sitter information may be incomplete or outdated; confirm anything that matters to your pet’s safety before you rely on it.'
        },
        {
          heading: 'Honest limitations',
          body: 'Listings and reviews depend on what people enter and what operators maintain. Automated ranking and the assistant can be wrong. Search results are only as good as the data behind them. Availability can change after you view a page. Booking requests are requests: status updates depend on how the product and the parties use them, not on a guarantee of care. If something looks incorrect, it may be. Use the contact page to report problems, and treat in-person judgment as part of any real sitting arrangement.'
        },
        {
          heading: 'Contact and feedback',
          body: 'Questions about the product, privacy, security reports, and account data requests go through the contact page. Include enough detail to reproduce an issue when you report one. There is no promised response time on this small project, but messages are read and handled as capacity allows.'
        }
      ]
    },
    contact: {
      title: 'Contact',
      updated: '2026-08-06',
      intro:
        'Use this page to reach the operators of Pet Sitter Finder. Say what you need, give enough context to act on it, and mark privacy or security requests clearly so they can be handled with the right priority.',
      sections: [
        {
          heading: 'General questions and product feedback',
          body: 'For questions about how search, bookings, accounts, sitters, pets, reviews, or the assistant work, use the contact route published with this deployment (or the contact form if one is shown on this page). Describe what you were trying to do, what you expected, and what you saw instead. Product feedback about missing filters, confusing copy, or accessibility issues is welcome and helps improve the marketplace for owners and sitters alike.'
        },
        {
          heading: 'What to include in a report',
          body: 'A message with concrete detail gets a useful answer faster. When something failed, include:',
          items: [
            'The page or URL you were on (for example /sitters or a specific sitter detail path)',
            'Whether you were signed in, and which role you were acting as (owner or sitter) if relevant',
            'What you expected to happen',
            'What actually happened, including any error text shown in the UI',
            'Approximate date and time (with timezone if you know it)',
            'Browser name and version, and whether you were on phone or desktop'
          ]
        },
        {
          heading: 'Account and booking issues',
          body: 'If you cannot sign in, need help with a booking request status, or believe another user’s content is abusive or false, contact us with the account email you registered, the booking or sitter identifiers if you have them, and a short description of the problem. Do not send your password. Operators will never ask for your password by email or chat. Session fixes may require you to sign out, clear site cookies for this origin, and sign in again after the issue is addressed.'
        },
        {
          heading: 'Privacy and data requests',
          body: 'To request a copy of personal data we hold about you, to correct it, or to delete an account and related personal records, send a message and mark it explicitly as a privacy request. Name the email address on the account. You do not need to give a legal theory or a reason. We will verify that we are talking to the account holder before exporting or deleting data. See the privacy policy for retention, processors, and how session and theme storage work.'
        },
        {
          heading: 'Reporting a security problem',
          body: 'If you believe you have found a vulnerability in Pet Sitter Finder (for example a way to read another user’s bookings, bypass session checks, or inject scripts), report it privately through the contact channel rather than posting full details in a public forum first. Include steps to reproduce, the impact you expect, and whether you have a proof concept. Give us a reasonable chance to investigate and fix before public disclosure. Do not access other people’s data beyond what is needed to demonstrate the issue, and do not disrupt the service for other users while testing.'
        },
        {
          heading: 'Assistant and search quality',
          body: 'The AI assistant answers from sitters stored in this app’s D1 database via Cloudflare Workers AI. If it invents a sitter, misses an obvious match, or fails with an error state, tell us the exact question you asked and what the UI showed. For search, include the query text and filters you used and which sitters you expected to see. That information helps fix grounding and ranking issues without guessing.'
        },
        {
          heading: 'Response times',
          body: 'This is a small project operated without a dedicated 24-hour support desk. We read every message and reply when we reasonably can. There is no contractual service level, no guaranteed first-response time, and no phone support. Urgent pet welfare emergencies are not handled through this form -- contact local emergency or animal services directly.'
        },
        {
          heading: 'What we will not do by contact alone',
          body: 'Contact messages do not create insurance coverage, payment disputes, or binding mediation between an owner and a sitter. We may remove content that violates the terms, suspend accounts that abuse the service, or correct data errors we can verify. We do not transfer funds, reverse cash payments made outside the app, or settle disagreements about the quality of sitting that happened offline. For those matters, resolve them with the other party or through appropriate local channels.'
        }
      ]
    },
    terms: {
      title: 'Terms and conditions',
      updated: '2026-08-06',
      intro:
        'These terms and conditions (“Terms”) govern access to and use of Pet Sitter Finder, a marketplace web application for finding local pet sitters, viewing rates and reviews, managing pets, and requesting bookings. The product is operated as a Cloudflare Pages site with Pages Functions and a Cloudflare D1 database. By creating an account, signing in, submitting content, or otherwise using the service, you agree to these Terms. If you do not agree, do not use Pet Sitter Finder. These Terms work together with the privacy policy; if you need detail on personal data, read that policy as well.',
      sections: [
        {
          heading: 'Acceptance of these terms',
          body: 'You accept these Terms when you use Pet Sitter Finder in any way that reaches our servers or stores data on your device for the app’s features. That includes browsing public pages, registering, signing in, searching sitters, opening sitter detail, creating or editing pets, requesting bookings, posting or reading reviews, or using the in-app AI assistant. If you use the service on behalf of an organisation, you represent that you have authority to bind that organisation. Continued use after we post an updated version of these Terms (with a new “Last updated” date on this page) means you accept the updated Terms. If a court finds one clause unenforceable, the rest remain in effect to the extent allowed by law.'
        },
        {
          heading: 'Eligibility and age',
          body: 'You must be at least 13 years old to use Pet Sitter Finder. If you are under 18, you may use the service only with the consent and supervision of a parent or legal guardian who agrees to these Terms on your behalf. You must be able to form a binding contract where you live. You may not use the service if you are barred under applicable law or if we have previously suspended or terminated your account for breach. Pet sitting often involves real animals and real homes; you are responsible for complying with local laws about animals, boarding, zoning, and any licences that apply to you as an owner or as a sitter. Meeting the age rule does not mean every feature is appropriate for every minor; guardians remain responsible for how a minor uses an account.'
        },
        {
          heading: 'Accounts and authentication',
          body: 'Pet Sitter Finder provides user accounts. Registration requires an email address and a password. Passwords are hashed with PBKDF2 using the Web Crypto API on Cloudflare Pages Functions; we store a hash and salt in Cloudflare D1, not the plain password. After successful sign-in, the service issues a session authenticated with HMAC-SHA256 session tokens and delivers them using session cookies appropriate for authentication. Session records are stored in D1 and checked on protected API routes. You must provide accurate registration information, keep your password confidential, and tell us promptly if you believe your account was used without permission. You are responsible for activity that occurs under your account while your session is valid, except where we caused unauthorised access through a proven failure on our side. We may refuse registration, require re-authentication, expire sessions, or revoke sessions when we detect abuse, credential stuffing, or risk to other users. Signing out ends the current session on the server when the sign-out flow completes successfully. There is no social login, no OAuth provider, and no password recovery promise beyond what the product actually implements at the time you use it; if a recovery path is not present in the product, contact us through the contact page for account help.'
        },
        {
          heading: 'Description of the service',
          body: 'Pet Sitter Finder is a marketplace information and request tool. Owners can search and filter sitters (including by neighbourhood, rates, pet types, and availability as exposed in the product), open sitter profiles, manage pets on their account, request bookings for date ranges, and read or leave reviews as the product allows. Sitters appear in the directory with profile data stored in D1. An AI assistant, reached from the application shell, calls Cloudflare Workers AI from a Pages Function and grounds answers in sitter data from this app’s database rather than open-ended general knowledge. The service runs on Cloudflare Pages (static assets), Cloudflare Pages Functions (API and assistant), and Cloudflare D1 (SQL storage). The service does not process payments, charge cards, hold deposits, or pay sitters. Any fee agreement, cash payment, or transfer between owner and sitter happens outside Pet Sitter Finder and is solely between those parties. We may add, change, or remove features, rate limits, or seed data as the product evolves.'
        },
        {
          heading: 'Marketplace role and no payments',
          body: 'We provide software that helps people discover sitters and request care. We are not a party to the sitting arrangement itself. We do not employ sitters shown in the directory unless a listing expressly says otherwise (and the product’s ordinary model is independent sitters and owners). We do not guarantee that a sitter will accept a booking request, complete a stay, or meet any quality standard. Because the app has no payment integration, we do not collect sitting fees, process refunds, provide escrow, or issue invoices for sitting services. Disputes about money, keys, damage, or the quality of care must be resolved between the people involved or through appropriate external channels. Listing a per-night rate is informational only; it is not a binding offer from us and does not create a charge through this website.'
        },
        {
          heading: 'Acceptable use',
          body: 'You may use Pet Sitter Finder for its intended purpose: finding and offering pet sitting through the features we provide. You may not use the service to harm people, animals, or systems. Without limiting that rule, you agree not to:',
          items: [
            'Break the law, or use the app to help anyone else do so, including animal cruelty, fraud, or unauthorised access to property',
            'Scrape, bulk-download, harvest, or resell directory content, reviews, or personal data outside normal interactive use',
            'Overload, disrupt, probe, or circumvent rate limits, authentication, or access controls on Pages Functions or D1-backed APIs',
            'Attempt to access another user’s account, bookings, pets, or sessions',
            'Submit malware, automated spam, or content designed to harass, defame, or threaten',
            'Impersonate another person, misrepresent your identity, qualifications, home, or the pets you own or will sit',
            'Use the assistant or APIs to extract training data at scale or to reverse engineer non-public system prompts beyond ordinary use',
            'Interfere with reviews in bad faith (for example fake reviews, review bribery schemes, or coercion)',
            'Create accounts by automated means without our written permission'
          ]
        },
        {
          heading: 'User content',
          body: 'User content means anything you submit to the service that is stored or displayed, including account profile fields, sitter profile text you control, pet names and descriptions, booking notes or status-related messages the product stores, review text and ratings, and prompts you send to the assistant (which may be processed to produce a reply and may be logged only as needed to operate and secure the service). You retain ownership of your user content to the extent you already own it. You grant us a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, display, and process that content solely to operate, secure, improve, and provide Pet Sitter Finder, including showing sitters in search results, showing reviews to other users, grounding assistant answers in catalogue data, and making backups on Cloudflare infrastructure. You represent that you have the rights needed to submit the content and that it does not violate law or third-party rights. We may remove or restrict content that violates these Terms, appears unlawful, endangers animals or people, or harms the integrity of the marketplace. We are not obliged to pre-screen every submission. Booking requests and statuses are operational records; altering them outside the product’s intended flows (for example by attacking the API) is prohibited.'
        },
        {
          heading: 'Intellectual property',
          body: 'The Pet Sitter Finder application, including its design, layout, original text (other than user content), logos, and code, is owned by its operators and licensors and is protected by intellectual property laws. These Terms do not transfer ownership of the software or brand to you. You receive a limited, revocable, non-transferable right to access the service for personal or internal use in line with these Terms. You may not copy the product, create derivative works from our non-user materials, or remove proprietary notices. Third-party names, including Cloudflare and other marks that appear for descriptive reasons, belong to their owners and do not imply endorsement. Sitter names and review text contributed by users remain subject to the user content rules above. If you believe content on the service infringes your copyright, contact us through the contact page with enough detail to locate the material and verify your claim.'
        },
        {
          heading: 'AI assistant',
          body: 'The in-app assistant is an optional feature. It runs on Cloudflare Workers AI inside our Pages Functions. It is designed to answer questions using sitters and related records from this application’s D1 database, not to replace your judgment about animal care. Answers can be incomplete, outdated, or wrong. The assistant may refuse some requests or return an error state if the model call fails or if grounding data is unavailable; an empty success is not the intended failure mode. You must not rely on the assistant alone for emergency decisions about a pet’s health or safety. Do not paste secrets, full payment card numbers, or other people’s sensitive data into the assistant. We may rate-limit or disable the assistant to control cost and abuse.'
        },
        {
          heading: 'Disclaimers of warranty',
          body: 'Pet Sitter Finder is provided free of charge and on an “as is” and “as available” basis, without warranties of any kind, whether express, implied, or statutory, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement, to the maximum extent permitted by law. We do not warrant that the service will be uninterrupted, secure, or free of errors; that sitters, rates, availability, or reviews are accurate or complete; that booking requests will be accepted; that the assistant’s answers are correct; or that defects will be corrected. Information shown in search results and profiles may lag behind real-world changes. You use the marketplace and any offline sitting arrangement at your own risk. Some jurisdictions do not allow certain warranty disclaimers; in those places, disclaimers apply only to the extent allowed.'
        },
        {
          heading: 'Limitation of liability',
          body: 'To the fullest extent permitted by law, the operators of Pet Sitter Finder and their suppliers (including infrastructure providers such as Cloudflare acting in their capacity as host and processor) are not liable for any indirect, incidental, special, consequential, exemplary, or punitive damages; for lost profits, lost data, lost goodwill, or business interruption; or for personal injury or property damage arising from sitting arrangements arranged after using the service, even if advised of the possibility of such damages. To the fullest extent permitted by law, our total liability for all claims relating to the service is limited to the greater of (a) the amount you paid us specifically for use of Pet Sitter Finder in the three months before the claim (which is zero if the product remains free and without paid plans) or (b) fifty US dollars (USD $50). Nothing in these Terms limits liability that cannot be limited under applicable law, including liability for fraud or for death or personal injury caused by negligence where such a limit is prohibited. You acknowledge that the free marketplace model and the absence of payment processing are part of the bargain reflected in these limits.'
        },
        {
          heading: 'Indemnification',
          body: 'You agree to defend, indemnify, and hold harmless the operators of Pet Sitter Finder and their officers, agents, and contractors from and against claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or related to: your misuse of the service; your breach of these Terms; your user content; your interactions with other users offline, including sitting arrangements, payments outside the app, property access, and care of animals; or your violation of law or third-party rights. We may assume exclusive defence of a matter subject to indemnification; if we do, you will cooperate reasonably. This clause survives termination of your account and of these Terms.'
        },
        {
          heading: 'Termination and suspension',
          body: 'You may stop using Pet Sitter Finder at any time and may request account deletion through the contact page as described in the privacy policy. We may suspend or terminate access, delete or restrict content, or revoke sessions immediately if you breach these Terms, if required by law, if your use creates risk for other users or animals, or if we discontinue the service. We may also suspend accounts involved in credential stuffing, spam reviews, scraping, or attempts to access D1-backed data without authorisation. On termination, your right to use the service ends. Provisions that by their nature should survive (including intellectual property ownership, disclaimers, liability limits, indemnity, and governing law) survive termination. We may retain certain records as described in the privacy policy when retention is required for security, dispute resolution, or law.'
        },
        {
          heading: 'Changes to the service and to these terms',
          body: 'We may change features, interfaces, seed data, rate limits, assistant behaviour, and infrastructure settings as needed to run the product on Cloudflare Pages, Pages Functions, Workers AI, and D1. We may update these Terms when the product or the law changes. The “Last updated” date at the bottom of this page shows the current version. For material changes, we will make the update reasonably visible in the product or on this page rather than relying only on a silent edit. If you continue to use the service after Terms change, you accept the new Terms. If you do not accept them, stop using the service and request account closure if you have an account.'
        },
        {
          heading: 'Governing law and disputes',
          body: 'These Terms are governed by the laws of England and Wales, without regard to conflict-of-law rules that would apply another jurisdiction’s laws, except that mandatory consumer protections in your country of residence continue to apply where they cannot be waived. Courts in England and Wales have exclusive jurisdiction over disputes arising out of or relating to these Terms or the service, except that you may bring qualifying consumer claims in your local courts where the law requires that option to remain open. Before filing a claim, you agree to try to resolve the dispute informally by contacting us through the contact page and allowing a reasonable time for a reply. Nothing in this section prevents either party from seeking interim injunctive relief for misuse of intellectual property or unauthorised access to systems. If you are a consumer, this section does not deprive you of non-waivable rights under the law of your habitual residence.'
        },
        {
          heading: 'Privacy cross-reference',
          body: 'Our handling of personal data is described in the privacy policy on this site. That policy explains what we collect (including account data, pets, bookings, reviews, session cookies, and theme preference in localStorage), how Cloudflare acts as infrastructure processor, how PBKDF2 and HTTPS protect credentials in transit and at rest as hashes, retention, and your rights to access or delete data. The privacy policy is part of how we operate the service under these Terms. If these Terms and the privacy policy conflict on a pure privacy disclosure point, the privacy policy controls for that point; if they conflict on use of the service or allocation of risk, these Terms control.'
        },
        {
          heading: 'Contact about these terms',
          body: 'Questions about these Terms, notices under them, and formal complaints about the service should be sent through the contact page of Pet Sitter Finder. Include your account email if you have one, and mark legal or terms questions clearly in the subject or first line so they can be routed correctly. Do not use the contact channel to send passwords or full payment card numbers. For privacy-specific requests, follow the privacy policy’s instructions and label the message as a privacy request.'
        }
      ]
    },
    privacy: {
      title: 'Privacy policy',
      updated: '2026-08-06',
      intro:
        'This privacy policy explains how Pet Sitter Finder collects, uses, stores, and shares personal data when you use our marketplace for pet sitters. The product runs on Cloudflare Pages, Cloudflare Pages Functions, and Cloudflare D1. Authentication uses Web Crypto (PBKDF2 password hashing and HMAC-SHA256 session tokens) with session cookies. Theme preference is stored in your browser’s localStorage. We do not run advertising trackers, analytics pixels, or third-party ad networks in the application. This policy is meant to be read end to end; it is written for this product as built, not as a generic template.',
      sections: [
        {
          heading: 'Who we are and scope',
          body: 'Pet Sitter Finder is a web application that lets people browse and search pet sitters, manage pets, request bookings, leave or read reviews, create accounts, and ask an assistant questions grounded in sitter data from our own database. This policy applies to personal data processed when you visit the site, create or use an account, submit content, or contact us. It does not cover independent websites you reach through external links, and it does not cover how a sitter or owner treats data they collect from each other offline after they meet. If you do not agree with this policy, do not use the service. For contract terms about acceptable use and liability, see the terms and conditions.'
        },
        {
          heading: 'What we collect',
          body: 'We collect categories of data needed to run a marketplace with accounts and bookings. Exact fields depend on what you submit and what features you use, and include:',
          items: [
            'Account data: email address, password hash and salt (never the plain password), account identifiers, and timestamps such as created_at',
            'Session data: session identifiers, token hashes, expiry times, and linkage to your user id in D1, plus the session cookie set in your browser after sign-in',
            'Profile and marketplace content: sitter profile fields you control (for example name, neighbourhood, rate per night, pet types, availability-related fields), pet records (name, species, and related fields), booking requests (dates, status, and related fields), and reviews (rating and body text)',
            'Assistant inputs: the text of questions you send to the AI assistant so the Worker can retrieve relevant sitters from D1 and call Cloudflare Workers AI',
            'Technical data generated by use: standard HTTP request metadata processed by Cloudflare (such as IP address, user agent, and security logs) as part of hosting and protecting the site',
            'Device preference: your light or dark theme choice in localStorage under a theme key on this origin (this does not leave your device as part of our server database)',
            'Contact messages: whatever you choose to send through the contact channel, including privacy or security reports'
          ]
        },
        {
          heading: 'What we do not collect',
          body: 'We do not integrate advertising identifiers, third-party marketing pixels, or behavioural ad trackers in the Pet Sitter Finder front end. We do not sell personal data. We do not require payment card numbers because the app does not process payments; please do not send card numbers through forms or the assistant. We do not use your device GPS for tracking; any location-like information is what you or a sitter type into profile fields such as neighbourhood text. We do not require government ID upload in the current product. If a future feature changes this list, this policy and its date will change first.'
        },
        {
          heading: 'How we use personal data',
          body: 'We use personal data for the following purposes, and not for unrelated profiling for ads:',
          items: [
            'Provide the service: authenticate you, keep you signed in with session cookies, show search and sitter detail, store pets and booking requests, display reviews, and run the assistant against D1 sitter data',
            'Secure the service: verify passwords with PBKDF2, validate HMAC session tokens, expire or revoke sessions, detect abuse, and protect APIs with validation and parameterized queries',
            'Operate infrastructure: host static assets on Cloudflare Pages, execute Pages Functions, and persist records in D1',
            'Communicate about your requests: respond to contact messages, privacy requests, and security reports',
            'Improve reliability: diagnose errors, fix bugs, and understand feature failures (for example assistant model errors) without building an advertising profile',
            'Meet legal duties: comply with applicable law, lawful requests, and enforcement of our terms'
          ]
        },
        {
          heading: 'Legal bases for processing',
          body: 'Where the UK GDPR or EU GDPR applies, we rely on these legal bases as appropriate to each processing activity: (1) Contract -- processing needed to provide the account, search, bookings, reviews, and assistant features you request; (2) Legitimate interests -- securing the service, preventing abuse, maintaining backups on our infrastructure provider, and improving reliability in ways that do not override your rights; (3) Consent -- where we ask for consent for a specific optional use (the theme preference is stored locally on your device at your control; marketing email is not part of the current product); (4) Legal obligation -- when we must keep or disclose data to comply with law. Where CCPA/CPRA or similar US state laws apply, we process personal information to provide the business services you request, for security, and for short-term transient use. We do not sell personal information or share it for cross-context behavioural advertising. You may have the right to know, delete, correct, and opt out of sale or sharing; because we do not sell or share for ads, the opt-out of sale is already aligned with our practices, and you can still request access or deletion through the contact page.'
        },
        {
          heading: 'Cookies and local storage',
          body: 'Pet Sitter Finder uses cookies that are required for authentication after you sign in. Session cookies carry or reference the session established with HMAC-SHA256 tokens so Pages Functions can recognise your logged-in requests. These are not advertising cookies. If you block all cookies, sign-in and account features that depend on sessions will not work correctly. Separately, your theme choice (light or dark) is stored in the browser’s localStorage on this site’s origin and is read only in your browser to set the theme attribute; it is not used as an ad identifier and is not sent to D1 as a tracking profile. We do not set third-party advertising cookies. Browser controls let you delete cookies and localStorage; deleting the session cookie signs you out of that browser until you sign in again. There is no non-essential analytics cookie banner requirement created by ad trackers we do not load; essential session cookies are used to provide the account feature you request.'
        },
        {
          heading: 'Sharing and processors',
          body: 'We do not sell your personal data. We share data with service providers only as needed to run Pet Sitter Finder. Cloudflare is our infrastructure processor and host: Cloudflare Pages serves the front end, Pages Functions run the API and assistant, D1 stores application data, and Workers AI runs the model call for the assistant. Data therefore passes through and rests on Cloudflare’s systems under Cloudflare’s terms and data processing terms applicable to our use. Prompt text and retrieved sitter context are sent to the Workers AI binding to generate a reply. We do not use a separate third-party analytics SaaS, payment processor, or customer-support SaaS in the current architecture. If you contact us through an email path that depends on your own mail provider, that provider processes the message under its terms. Law enforcement or regulators may receive data when the law requires disclosure. Other users see the marketplace content you choose to make public (for example sitter profile fields and reviews); they do not receive your password hash or session token.'
        },
        {
          heading: 'Data location and international transfers',
          body: 'Cloudflare operates a global network. Using Pet Sitter Finder means personal data may be processed in countries other than the one where you live, including locations where Cloudflare runs data centres or edge sites. Where GDPR-style transfer rules apply, transfers rely on the safeguards Cloudflare provides for customers (such as standard contractual clauses or equivalent mechanisms described in Cloudflare’s documentation for the services we use), combined with our configuration of Pages, Functions, and D1. We do not operate a separate multi-region application stack outside Cloudflare for this product. If you are uncomfortable with international processing on a global edge network, do not use the service.'
        },
        {
          heading: 'Retention',
          body: 'We keep personal data only as long as needed for the purposes above, unless a longer period is required by law. In practice:',
          items: [
            'Account records remain while the account is active and for a short period after deletion requests are completed, so we can finish deletion safely and handle disputes or abuse investigations',
            'Session rows in D1 remain until they expire, are revoked on sign-out, or are cleaned up as part of session maintenance',
            'Pets, bookings, and reviews remain while associated accounts and marketplace records need them; if you delete an account, we delete or anonymise personal fields we control, subject to residual copies in backups for a limited time',
            'Assistant prompts are processed to produce answers; we do not build a long-term advertising history from them. Operational logs on Cloudflare may retain request metadata for security and debugging according to Cloudflare’s and our retention settings',
            'Theme preference remains in your localStorage until you clear site data or change the theme',
            'Contact messages are kept long enough to respond and to maintain a record of privacy or security reports'
          ]
        },
        {
          heading: 'Security measures',
          body: 'We apply technical and organisational measures appropriate to a small Cloudflare-hosted app with accounts. Traffic is served over HTTPS. Passwords are hashed with PBKDF2 (SHA-256, high iteration count) and a unique salt via Web Crypto inside Pages Functions; plain passwords are not stored in D1. Session tokens are handled with HMAC-SHA256 and stored as hashes or equivalent server-side secrets rather than as reusable clear passwords. API handlers validate input (including with schema validation such as Zod at the boundary) and use parameterized D1 queries to reduce injection risk. Access to production infrastructure is limited to operators with Cloudflare credentials. No method of transmission or storage is perfectly secure. You can help by choosing a strong unique password, signing out on shared devices, and reporting suspected unauthorised access through the contact page. We will never ask you to email your password.'
        },
        {
          heading: 'Your rights',
          body: 'Depending on where you live, you may have rights under regimes such as the UK GDPR, EU GDPR, and CCPA/CPRA. Subject to legal limits and verification, those rights commonly include:',
          items: [
            'Access: receive a copy of personal data we hold about you',
            'Correction: fix inaccurate account or profile data',
            'Deletion: request deletion of your account and related personal data (deletion rather than mere hiding, for data we control)',
            'Portability: receive certain data in a common machine-readable form when the law provides that right',
            'Restriction or objection: limit certain processing where the law allows',
            'Withdraw consent: where processing is based on consent',
            'Non-discrimination: we will not deny the core service merely because you exercised a privacy right',
            'Complaint: lodge a complaint with a supervisory authority in your country or region'
          ]
        },
        {
          heading: 'How to exercise your rights',
          body: 'Send a message through the contact page and mark it clearly as a privacy request. State which right you want to exercise and the email address on your account. We may need to verify that you control the account before exporting or deleting data (for example by requiring a signed-in confirmation or a reply from the registered email). You do not have to pay a fee for ordinary requests. We will respond within the time required by applicable law, or explain if we need more time or cannot fulfil a request in full (for example when data must be kept for security logs or legal claims). Exercising a right will not be used as a reason to reduce marketplace features beyond what is technically necessary when data is removed (for example, deleted reviews you authored will no longer appear).'
        },
        {
          heading: 'Children',
          body: 'Pet Sitter Finder is not directed at children under 13, and we do not knowingly collect personal data from children under 13. If you are a parent or guardian and believe a child under 13 created an account or submitted data, contact us with enough detail to find the account. We will delete the data when we have verified the request. Users between 13 and 18 should use the service only with parental or guardian permission as described in the terms. Sitting arrangements involving minors’ pets still require adult judgment offline; the app does not replace that duty.'
        },
        {
          heading: 'Automated processing and the assistant',
          body: 'Search ranking and the AI assistant involve automated processing. The assistant uses Cloudflare Workers AI with retrieval from our D1 sitter records so answers stay tied to this product’s catalogue. It is not used to make legal or similarly significant decisions about you without human involvement in the sense of credit scoring or employment. You can choose not to use the assistant. If an automated output seems wrong, use human review: open the sitter detail page, contact the sitter, and use the contact page to report systematic errors. We do not use assistant chats to build third-party ad profiles.'
        },
        {
          heading: 'Changes to this policy',
          body: 'If we change what we collect, how we use it, or who processes it in a material way -- for example if we added a payment provider or an analytics tool -- we will update this page and the “Last updated” date. For significant changes we will make the update reasonably obvious in the product or on this page rather than only editing quietly. Continued use after an update means you acknowledge the revised policy. If you need a previous version for a dispute, contact us and we will provide what we reasonably can from our records.'
        },
        {
          heading: 'Contact for privacy questions',
          body: 'Privacy questions, data access requests, deletion requests, and concerns about this policy go through the Pet Sitter Finder contact page. Label the message as a privacy request and include the email address associated with your account when relevant. Do not include passwords. For security vulnerabilities, follow the security reporting guidance on the contact page and avoid public disclosure until we have had a reasonable chance to respond. If you are in the EEA or UK and remain unsatisfied, you may contact your local data protection authority; we will cooperate with lawful investigations.'
        }
      ]
    }
  }
} as const;
