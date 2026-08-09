/**
 * All user-facing copy for Sushi Finder (sushi-finder).
 * No hardcoded product strings in components.
 */
export const en = {
  brand: {
    name: 'Sushi Finder',
    tagline: 'Sushi places you can search, open, and manage — public catalog on D1.'
  },
  nav: {
    home: 'Board',
    sushis: 'Catalog',
    about: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
    contact: 'Contact',
    skip: 'Skip to main content'
  },
  theme: {
    toggle: 'Toggle theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System'
  },
  home: {
    title: 'Sushi Finder',
    lead: 'Browse seeded restaurants by photos, map, or seating policy. Every row comes from Cloudflare D1 — never invented client-side sample data.',
    ctaList: 'Open full catalog',
    ctaAdd: 'Add a sushi place',
    viewNav: 'Discovery views',
    viewPhotos: 'Photos',
    viewMap: 'Map',
    liveResults: 'Live results from Google Places for this search.',
    editorialEyebrow: "Tonight's find",
    viewSeating: 'List',
    mapLabel: 'Catalog places on a simple map board',
    mapCityLabel: 'Find by city or title',
    mapCityPlaceholder: 'City or title…',
    mapEmpty: 'No place with coordinates is selected.',
    seatingLead:
      'Seating board uses static walk-in and style fields from D1 — not live table inventory or reservation APIs.',
    seatingSlots: 'Catalog seating filters',
    slotNow: 'Now',
    walkInLabel: 'walk-in in catalog',
    reserveLabel: 'reserve-leaning',
    walkInYes: 'Walk-in',
    walkInNo: 'Reserve',
    zoneLabel: 'Filter zone or title',
    zonePlaceholder: 'City or title…',
    seatingEmpty: 'No places match this seating filter.',
    seatingEmptyHint: 'Counts are catalog attributes in D1, not live open seats.',
    kpiPlaces: 'Places in catalog',
    kpiPublic: 'Auth required',
    kpiPublicValue: 'None',
    kpiSearch: 'Search',
    kpiSearchValue: 'By title',
    coverageTitle: 'Coverage boundary',
    coverageBody:
      'This app’s data is the sushis table in Cloudflare D1 for this deployment. Photos and coordinates are seed fields we host or curate. There is no live map tile vendor as a restaurant data source, no live seating inventory, payment, or third-party review feed. A miss is “not in this catalog,” not “no sushi exists in that city.”'
  },
  sushis: {
    title: 'Catalog',
    searchLabel: 'Search sushis by title',
    searchPlaceholder: 'Find by title…',
    add: 'Add sushi',
    createTitle: 'Create sushi',
    editTitle: 'Edit sushi',
    fieldTitle: 'Name',
    fieldDescription: 'Description',
    save: 'Save',
    create: 'Create',
    cancel: 'Cancel',
    loading: 'Loading sushis…',
    empty: 'No sushis yet. Use Add sushi above to put a place in the catalog.',
    emptyMatch: 'No results match this search. Try a different title fragment.',
    emptyMatchHint:
      'Search only looks at titles in this deployment’s D1 catalog. It does not query Google Places, Yelp, or a worldwide index.',
    emptyHint: 'Seed data may not be applied, or all rows were deleted from this D1 binding.',
    error: 'Something went wrong loading sushis.',
    retry: 'Retry',
    kpiTotal: 'Total',
    kpiShowing: 'Showing',
    kpiQuery: 'Query',
    tableTitle: 'Title',
    tableDescription: 'Description',
    openDetail: 'Open detail'
  },
  detail: {
    back: 'Back to list',
    loading: 'Loading sushi…',
    notFound: 'Sushi not found',
    notFoundHint:
      'That id is not in this deployment’s D1 catalog. It may have been deleted, never existed, or belongs to another environment.',
    error: 'Failed to load this sushi.',
    retry: 'Retry',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: 'Delete this sushi permanently?',
    confirmYes: 'Yes',
    confirmNo: 'Cancel',
    descriptionLabel: 'Description',
    emptyDescription: 'No description provided.'
  },
  form: {
    loading: 'Loading sushi for edit…',
    saveError: 'Could not save this sushi. Check the fields and try again.',
    notFound: 'Cannot edit — that sushi is not in the catalog.'
  },
  assistant: {
    open: 'Assistant',
    close: 'Close',
    openLabel: 'Open assistant',
    closeLabel: 'Close panel',
    region: 'Sushi assistant',
    hint: 'Questions are answered from this app’s sushi catalog in D1 — not general web knowledge.',
    coverageHint:
      'Out of coverage: cities, maps, live seats, and reviews that are not stored as rows here cannot be answered as facts.',
    inputLabel: 'Your question',
    submit: 'Send',
    loading: 'Thinking…',
    error: 'The assistant is unavailable.',
    emptyMessage: 'Enter a message before sending.',
    emptyAnswer: 'No grounded answer was returned. Try a title from the catalog.'
  },
  footer: {
    blurb: 'Sushi Finder is a public sushi catalog. No accounts. Data lives in Cloudflare D1 for this deployment.',
    rights: 'Built as a RedAnvil marketplace MVP.'
  },
  about: {
    title: 'About Sushi Finder',
    body: 'Sushi Finder helps people discover sushi restaurants in a curated public catalog. Search by title, open a place for its description, and manage rows when you need to correct or add data. Answers from the in-app assistant are grounded in the same D1 rows — not inventing restaurants.',
    howTitle: 'How it works',
    howBody:
      'The UI is a Vite + React SPA on Cloudflare Pages. Pages Functions expose JSON under /api. The sushis table in D1 holds id, title, description, created_at, and updated_at. Seed rows name real, well-known restaurants for first paint. GET /api/health is for operators.',
    coverageTitle: 'What this catalog does not cover',
    coverageBody:
      'There is no structured worldwide directory, no geolocation ranking, no map tiles as a data source, no photo gallery service, no live seating or reservation API, and no third-party review aggregation. Free-text descriptions may mention style or price in prose, but the schema does not enforce conveyor vs counter, price band, or walk-in columns. A search miss means no matching title in this D1 binding.',
    publicTitle: 'Public by design',
    publicBody:
      'There is no login. List, detail, create, edit, and delete are public for this MVP. Treat anything you type into title or description as published. Theme preference is stored only in localStorage under the key theme.'
  },
  contact: {
    title: 'Contact',
    body: 'This deployment has no outbound mail form. For product issues, open an issue on the project repository associated with this Cloudflare Pages site.',
    emailLabel: 'Project contact',
    email: 'contact@example.invalid',
    privacyHint: 'For privacy requests, start with “privacy request” and include the deployment URL and sushi id or text concerned.',
    dataHint: 'For catalog corrections, include the place title, what is wrong, and a public source you are citing.'
  },
  terms: {
    title: 'Terms of use',
    updated: 'Last updated 7 August 2026'
  },
  privacy: {
    title: 'Privacy policy',
    updated: 'Last updated 7 August 2026'
  },
  notFound: {
    title: 'Page not found',
    body: 'That route does not exist in this app. Try the catalog or home board.',
    home: 'Back home'
  },
  breadcrumb: {
    nav: 'Breadcrumb'
  }
} as const;
