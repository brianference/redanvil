/**
 * All user-facing copy for AZ Planting Calendar (English).
 */
export const en = {
  appName: 'AZ Planting Calendar',
  appTagline: 'Low desert · Cave Creek 85331',

  nav: {
    home: 'Home',
    about: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
    contact: 'Contact',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    skipToContent: 'Skip to content'
  },

  hero: {
    kicker: 'Plantable now',
    title: 'What can I plant right now?',
    subtitle:
      'Arizona low desert for Cave Creek (Maricopa County). Seed or transplant windows from University of Arizona Cooperative Extension.',
    asOf: 'As of',
    halfMonth: 'Half-month',
    empty: 'Nothing in the calendar for this half-month with the current filters.',
    loading: 'Loading plantable crops…',
    error: 'Could not load plantable crops.',
    retry: 'Retry',
    seed: 'Seed',
    transplant: 'Transplant',
    daysHarvest: 'Days to harvest',
    source: 'Source',
    viewCrop: 'Crop detail',
    count: (n: number) => (n === 1 ? '1 crop' : `${n} crops`)
  },

  filters: {
    title: 'Filters',
    method: 'Method',
    methodAll: 'Seed + transplant',
    methodSeed: 'Seed only',
    methodTransplant: 'Transplant only',
    month: 'Month',
    monthAll: 'All months',
    date: 'Date (for plantable now)',
    clear: 'Clear filters',
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ] as const
  },

  grid: {
    title: 'Full-year grid',
    subtitle: 'Crops down the side, 24 half-months across. S = seed, T = transplant.',
    loading: 'Loading grid…',
    error: 'Could not load the planting grid.',
    crop: 'Crop',
    legendS: 'S seed',
    legendT: 'T transplant',
    legendBoth: 'Both',
    empty: 'No crops match these filters.'
  },

  detail: {
    back: 'Back to home',
    windows: 'Planting windows',
    noWindows: 'No planting windows on file for this crop.',
    harvest: 'Days to harvest',
    notes: 'Notes from source',
    citation: 'Citation',
    method: 'Method',
    window: 'Window',
    loading: 'Loading crop…',
    error: 'Crop not found or failed to load.',
    retrieved: 'Retrieved'
  },

  zone: {
    label: 'Zone',
    lastFrost: 'Avg. last spring frost (32°F)',
    firstFrost: 'Approx. first fall frost',
    zip: 'ZIP'
  },

  footer: {
    sources: 'Data sources',
    rights: 'Not affiliated with the University of Arizona. For home garden planning only.'
  },

  about: {
    title: 'About this calendar',
    description:
      'Why this app exists, which zone it covers, and how planting windows are sourced.',
    body: [
      'AZ Planting Calendar answers one question for Arizona low-desert home gardeners: what can I plant right now, and as seed or transplant?',
      'The default zone is Cave Creek, Arizona 85331 (Maricopa County low desert). Planting windows come from the University of Arizona Cooperative Extension publication “Vegetable Planting Calendar for Maricopa County” (az1005, Kai Umeda), read from the HTML table that labels each half-month in text (Jan. 1 through Dec. 15).',
      'We never invent or estimate a planting date. If a crop is not on a citable source for this zone, it is omitted. A missing crop is better than a wrong one.',
      'Half-months are the 24 periods used by the Extension calendar: early and late halves of each month (days 1–14 and 15–end).',
      'Frost dates shown for Cave Creek are approximate planning aids from public frost-date references and are not a substitute for local weather.'
    ]
  },

  terms: {
    title: 'Terms of use',
    description: 'Terms for using the AZ Planting Calendar web app.',
    body: [
      'This app is a free planning tool for personal home gardening. It is not professional agricultural advice, and it is not a substitute for local conditions, soil tests, water rules, or pest pressure.',
      'Planting windows are reproduced from cited public Extension materials for informational purposes. Always verify against the original publication and your microclimate before planting.',
      'You may use the app for personal, non-commercial garden planning. Do not scrape the API for bulk redistribution of third-party content without checking the source publisher’s terms.',
      'The service is provided as-is, without warranty of fitness for a particular crop or season. Garden outcomes depend on weather, soil, water, and care.',
      'We may change or discontinue the app at any time. Continued use after changes means you accept the updated terms.'
    ]
  },

  privacy: {
    title: 'Privacy',
    description: 'What this app collects and what it does not.',
    body: [
      'AZ Planting Calendar does not create user accounts and does not ask for your name, email, or address on the public pages.',
      'Theme preference (light, dark, or system) is stored in your browser’s localStorage on this device only. We do not sync it to a server.',
      'Optional date and filter choices may appear in the page URL so you can share a view. They are not stored as a profile.',
      'This app does not set advertising cookies and does not include third-party ad trackers. Standard web server or edge logs (IP, user agent, path) may be recorded by the host for security and reliability.',
      'Contact messages you send by email go through your own mail client to the address on the Contact page; we do not operate an in-app message store.',
      'If this policy changes in a way that affects how data is handled, we will update this page.'
    ]
  },

  contact: {
    title: 'Contact',
    description: 'How to reach the maintainer about data errors or the app.',
    body: [
      'Found a wrong window, a broken citation link, or a crop that should be added from a citable Maricopa County source? Please write.',
      'Email: planting@redanvil.example (replace with your real inbox before production use).',
      'Include the crop name, the half-month you expected, and a URL to the Extension page or publication you are citing. We only add windows that can be traced to a source.',
      'This is a small home-garden tool, not a commercial support desk. Replies may take time.'
    ]
  },

  notFound: {
    title: 'Page not found',
    body: 'That route does not exist. Return home to see what you can plant now.',
    home: 'Home'
  },

  meta: {
    homeTitle: 'AZ Planting Calendar — what to plant now in Cave Creek',
    homeDescription:
      'Arizona low-desert planting calendar for Cave Creek AZ 85331. Seed and transplant windows from UA Cooperative Extension.',
    aboutTitle: 'About — AZ Planting Calendar',
    aboutDescription:
      'How planting windows are sourced for the Arizona low desert and Cave Creek 85331.',
    termsTitle: 'Terms — AZ Planting Calendar',
    termsDescription: 'Terms of use for the AZ Planting Calendar planning tool.',
    privacyTitle: 'Privacy — AZ Planting Calendar',
    privacyDescription: 'Privacy practices for AZ Planting Calendar: no accounts, local theme only.',
    contactTitle: 'Contact — AZ Planting Calendar',
    contactDescription: 'Report data errors or suggest citable crops for the Maricopa low desert.'
  }
} as const;

export type Copy = typeof en;
