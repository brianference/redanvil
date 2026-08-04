/**
 * All user-facing copy for AZ Planting Calendar (English).
 * Legal pages are structured sections so Terms/Privacy stay real documents.
 */

export interface LegalSectionCopy {
  heading: string;
  body: string;
  items?: readonly string[];
}

export const en = {
  appName: 'AZ Planting Calendar',
  appTagline: 'Low desert · Maricopa County',

  nav: {
    home: 'Home',
    grid: 'Year grid',
    about: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
    contact: 'Contact',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    menuOpen: 'Menu',
    // Short by necessity: "Close menu" was wide enough to starve the brand
    // column at 375px and clip the app name. The button carries aria-expanded
    // and aria-controls, so the state stays clear to assistive tech.
    menuClose: 'Close',
    /** Accessible name for the header theme control (includes current mode). */
    themeToggleAria: (modeLabel: string) => `Theme: ${modeLabel}. Click to switch light, dark, or system.`,
    skipToContent: 'Skip to content'
  },

  hero: {
    kicker: 'Plantable now',
    title: 'What can I plant right now?',
    subtitle:
      'Arizona low desert, Maricopa County. Seed and transplant windows from UA Cooperative Extension az1005.',
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
    sourceNote:
      'Planting windows: UA Cooperative Extension az1005 (Maricopa County low desert). Frost dates: NOAA 1991-2020 normals (30% probability).',
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
    search: 'Search crops',
    /** Short enough to fit at 375 without ellipsis (old: "Find a crop by name"). */
    searchPlaceholder: 'Crop name',
    /** Visible submit control next to the search input. */
    searchButton: 'Search',
    /** Accessible name for the suggestion listbox. */
    searchSuggestions: 'Crop suggestions',
    /**
     * When more API matches exist than the visible suggestion cap.
     *
     * @param n - Number of matches not shown in the list.
     */
    searchMore: (n: number) => (n === 1 ? '1 more match' : `${n} more matches`),
    /**
     * Live search match count next to the input.
     *
     * @param n - Number of matching crops.
     * @param q - Query fragment the visitor typed.
     */
    searchCount: (n: number, q: string) =>
      n === 1 ? `1 crop matches ${q}` : `${n} crops match ${q}`,
    /**
     * Zero-match live search status (distinct from a failed request).
     *
     * @param q - Query fragment.
     */
    searchEmpty: (q: string) => `0 crops match ${q}`,
    searchEmptyHint: 'No crops match that name. Try another spelling or a shorter fragment.',
    searching: 'Searching crops…',
    searchError: 'Could not search crops.',
    searchRetry: 'Retry search',
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

  timeline: {
    title: 'Half-month timeline',
    lede: 'Pick a half-month to see what is plantable. Counts are crops with an active seed or transplant window.',
    listLabel: 'Half-months with plantable crop counts',
    loadingCounts: 'Loading half-month counts…',
    now: 'Now',
    /**
     * Heading for the plantable list under the timeline.
     *
     * @param label - Half-month label such as "Aug 1".
     */
    plantableHeading: (label: string) => `Plantable in ${label}`
  },

  grid: {
    title: 'Full-year grid',
    pageTitle: 'Full-year planting grid',
    pageLede:
      'Crops down the side, 24 half-months across. Windows from UA Cooperative Extension az1005 for Maricopa County.',
    subtitle: 'Crops down the side, 24 half-months across. S = seed, T = transplant.',
    loading: 'Loading grid…',
    error: 'Could not load the planting grid.',
    crop: 'Crop',
    legendS: 'S seed',
    legendT: 'T transplant',
    legendBoth: 'Both',
    empty: 'No crops match these filters.',
    searchError: 'Could not search crops.',
    searchRetry: 'Retry search'
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
    retrieved: 'Retrieved',
    granularityMonth:
      'Source lists this window by whole month; half-month cells are both halves of that month, not finer precision.',
    granularityHalf: 'Source supports half-month columns (az1005 chart headers).',
    /** Growing-how section (spacing, depth) separate from when-to-plant windows. */
    guide: 'How to plant',
    guideDepth: 'Planting depth',
    guideSpacingInRow: 'Spacing in row',
    guideSpacingBetweenRows: 'Spacing between rows',
    guideSun: 'Sun',
    guideWater: 'Water',
    guideHarvest: 'Harvest note',
    guideCitation: 'Guide source',
    guideMissing:
      'No sourced growing guide for this crop yet. Planting windows above are still from az1005; depth, spacing, and care notes will appear here only when a University of Arizona Cooperative Extension publication is transcribed for this crop.',
    guidePartial:
      'Fields below are taken only from the cited Extension publication. Missing fields were not stated in that source -- not omitted as a product feature.'
  },

  zone: {
    label: 'Zone',
    /** Label that states the coverage boundary before search. */
    switchLabel: 'Planning zone (Maricopa County low desert)',
    /** Accessible name for the zone combobox. */
    comboboxLabel: 'Planning zone',
    searchPlaceholder: 'City, ZIP, county, or state',
    /** Accessible name for the zone listbox. */
    listLabel: 'Available planning zones',
    /** Group heading inside the open list. */
    groupMaricopa: 'Maricopa County low desert · UA Extension az1005',
    /**
     * Generic zero-filter explanation (always names coverage + covered towns).
     *
     * @param query - What the visitor typed.
     */
    noMatch: (query: string) =>
      `No planning zone matches “${query}”. This calendar covers Maricopa County low desert only, with planting windows from University of Arizona Cooperative Extension az1005 (Vegetable Planting Calendar for Maricopa County). Covered towns: Buckeye, Cave Creek, Chandler, Glendale, Mesa, Phoenix, Scottsdale, and Tempe. Open the list below to pick one of those zones.`,
    /**
     * Specific explanation when the query names a known out-of-coverage Arizona place.
     *
     * @param place - Display name of the place (e.g. Sierra Vista).
     */
    noMatchOutside: (place: string) =>
      `${place}, Arizona is outside this calendar’s coverage. Planting windows here are for the Maricopa County low desert only (UA Cooperative Extension az1005) and do not apply in ${place}. Covered towns: Buckeye, Cave Creek, Chandler, Glendale, Mesa, Phoenix, Scottsdale, and Tempe.`,
    /** Hint shown under zero-match copy; full list remains visible for discovery. */
    noMatchHint: 'Zones that are covered stay listed below -- pick one, or clear the search.',
    coverageHint:
      'Covers Maricopa County low desert only (az1005). Open the list to browse covered towns, or type a city, ZIP, county, or state.',
    lastFrost: 'Avg. last spring frost (32°F)',
    firstFrost: 'Approx. first fall frost',
    /** Compact frost labels for the zone bar. */
    lastFrostShort: 'Last frost',
    firstFrostShort: 'First frost',
    zip: 'ZIP',
    /**
     * Header / context line for the active zone.
     *
     * @param zone - Selected zone row.
     */
    contextLine: (zone: { name: string; zip: string }) => {
      const short = zone.name.replace(/\s*\(.*?\)\s*/g, '').trim();
      return `Low desert · ${short} ${zone.zip}`;
    },
    /**
     * Elevation display for planning context.
     *
     * @param ft - Feet above sea level (station or town).
     */
    elevation: (ft: number) => `${ft.toLocaleString('en-US')} ft elev.`,
    loading: 'Loading planning zones…',
    error: 'Could not load planning zones.',
    retry: 'Retry'
  },

  footer: {
    brandBlurb:
      'Free low-desert planting calendar for Cave Creek, Arizona 85331. Seed and transplant windows by half-month for home garden planning.',
    // Group labels, deliberately NOT the name of any link inside them. The old
    // "About" heading sat directly above an "About" link, which read as the same
    // destination twice, and Contact appeared in both the nav and this column.
    colCalendar: 'Explore',
    colAbout: 'Resources',
    colLegal: 'Legal',
    sourceLabel: 'Source',
    sourceLine:
      'UA Cooperative Extension az1005 · NOAA 1991–2020 frost normals',
    copyright: '© 2026 AZ Planting Calendar',
    home: 'Home',
    yearGrid: 'Year grid',
    plantable: 'Plantable now',
    about: 'About',
    contact: 'Contact',
    terms: 'Terms of use',
    privacy: 'Privacy',
    dataTitle: 'UA Cooperative Extension az1005',
    dataBlurb:
      'Vegetable Planting Calendar for Maricopa County by Kai Umeda. Forty-five crops with character-verified windows.',
    dataLinkLabel: 'Open az1005 PDF (extension.arizona.edu)',
    dataLinkHref:
      'https://extension.arizona.edu/sites/default/files/2024-08/az1005-2018.pdf',
    sources: 'Data sources',
    rights: 'Not affiliated with the University of Arizona. For home garden planning only.'
  },

  assistant: {
    open: 'Ask the calendar',
    openAria: 'Open planting assistant',
    close: 'Close assistant',
    title: 'Planting assistant',
    subtitle:
      'Ask about crops and windows in this app\'s database (az1005 for the low desert). Answers are grounded in D1, not general knowledge.',
    /** Short enough for the rail input; long copy truncated as "…plant ir". */
    placeholder: 'What can I plant now?',
    submit: 'Ask',
    thinking: 'Looking up planting data…',
    error: 'Assistant could not answer. Try again or use the crop grid.',
    empty: 'Type a question about what to plant in Cave Creek.',
    you: 'You',
    reply: 'Assistant',
    cropsHeading: 'Matching crops',
    noCrops: 'No crops matched those filters in this database.'
  },

  aboutBrand: {
    alt: 'AZ Planting Calendar brand art: saguaro and seedling on a calendar grid',
    caption: 'Brand mark for this calendar (saguaro, seedling, half-month grid).'
  },

  about: {
    title: 'About this calendar',
    description:
      'Why this app exists, which zone it covers, and how planting windows are sourced from University of Arizona Extension.',
    updated: 'Last updated 1 August 2026',
    intro:
      'AZ Planting Calendar is a free, public web tool for Arizona low-desert home gardeners. It answers one practical question: what can I plant right now in the Cave Creek area, as seed or as transplant, using half-month windows from a published University of Arizona Cooperative Extension calendar—not invented dates.',
    sections: [
      {
        heading: 'What the app does',
        body: 'The home page opens on a “plantable now” view for a chosen calendar date. That date maps to one of twenty-four half-months used by the Extension table (early and late halves of each month). Crops with an active seed or transplant window for that half-month appear first, with method chips and a path into crop detail. Below the fold, a full-year grid lists crops down the side and the twenty-four half-months across, so you can scan an entire season without guessing from a monthly list alone.'
      },
      {
        heading: 'Coverage boundary: Maricopa County low desert only',
        body: 'This calendar’s planting windows apply only to the Maricopa County low desert. They are transcribed from University of Arizona Cooperative Extension publication az1005 (“Vegetable Planting Calendar for Maricopa County,” Kai Umeda). Selectable planning zones today are eight Maricopa towns: Buckeye, Cave Creek, Chandler, Glendale, Mesa, Phoenix, Scottsdale, and Tempe. Mid-elevation and high-elevation Arizona places (for example Flagstaff, Pinetop, Prescott, Sedona, Sierra Vista) and other counties (for example Tucson in Pima County, or Yuma) are not covered -- not because the software is missing a feature, but because this app has not transcribed an authoritative planting-window table for those elevations or counties. Using Maricopa low-desert dates there would be actively wrong advice. A search that finds no zone is a stated coverage limit, not a broken lookup.'
      },
      {
        heading: 'Default zone: Cave Creek, Arizona 85331',
        body: 'The default planning zone is Cave Creek in Maricopa County (ZIP 85331), on the northern edge of the Phoenix low desert. The planting windows themselves come from county-level Maricopa guidance, not a custom microclimate model for every hillside. Cave Creek sits higher than central Phoenix, so the same published county windows can run early or late relative to your yard. Frost date fields shown with the zone are approximate planning aids from public frost-date references; they are not a substitute for local weather, soil, or water rules.'
      },
      {
        heading: 'Where the planting data comes from',
        body: 'Crop names, seed versus transplant methods, and half-month windows are transcribed from the University of Arizona Cooperative Extension publication “Vegetable Planting Calendar for Maricopa County” (publication az1005, Kai Umeda). The seed dataset ships forty-five crops whose marker sequences were verified character-for-character against the az1005 PDF text stream. The app does not invent or interpolate a planting date when the source is silent. Each window carries source metadata so you can open the publisher page and verify the table yourself. Per-crop growing guidance (depth, spacing, sun, water) is added only when a separate Extension publication states those figures for that crop; crops without a transcribed guide show windows only. This project is not affiliated with, endorsed by, or sponsored by the University of Arizona or Maricopa County.'
      },
      {
        heading: 'Crops deliberately excluded',
        body: 'Eight crops that appear in some draft or partial parses of the calendar were deliberately left out of the shipped database because their planting-marker sequences could not be verified against the published az1005 text (or the crop name was not found in the source PDF). A missing crop is better than a wrong one. Gardeners should not assume those crops are unsuitable for the low desert—only that this app will not invent windows for them until a character-verified sequence is available. The excluded names are:',
        items: [
          'Basil',
          'Broccoli',
          'Brussel Sprouts',
          'Cabbage',
          'Cabbage, Chinese',
          'Kohlrabi',
          'Melons, Cantaloupe/Honeydews, etc.',
          'Onions, Green'
        ]
      },
      {
        heading: 'How half-months work',
        body: 'The Extension calendar labels columns as early and late halves of each month (for example Jan. 1 and Jan. 15 through Dec. 15). This app uses the same twenty-four indices: days 1–14 of a month map to the early half; day 15 through the end of the month map to the late half. Optional filters let you view seed only, transplant only, or narrow the year grid to a calendar month. A search field on the crop grid narrows visible rows by crop name. An optional date query in the URL sets the “as of” day for plantable-now results so a shared link opens the same half-month view.'
      },
      {
        heading: 'What this is not',
        body: 'This is not professional agricultural consulting, not a soil lab, not irrigation design, and not a pest or disease diagnosis tool. It is not affiliated with the University of Arizona, the Cooperative Extension system, or Maricopa County. University branding appears only as citation of a public educational publication. Garden outcomes still depend on weather, soil, water quality and quantity, seed quality, and care. Always check the original publication and your microclimate before planting.'
      },
      {
        heading: 'How the site is built',
        body: 'The interface is a static single-page application hosted on Cloudflare Pages. Planting data for the app is served from Cloudflare Pages Functions backed by a Cloudflare D1 database that holds crops, planting windows, sources, and the default zone record. There are no user accounts and no visitor profiles in that database. The public JSON APIs expose plantable crops, the year grid, crop detail, crop list with optional name search, zone metadata, a health check for operators, and an optional planting assistant. The assistant loads crop and window rows from D1, then sends your question plus that grounded context to Cloudflare Workers AI so the reply is based on this app’s dataset rather than general knowledge. A model failure returns a visible error, not an empty success.'
      },
      {
        heading: 'Honesty about limits',
        body: 'County tables cannot encode every microclimate, shade pattern, or HOA water rule. Cave Creek sits higher than central Phoenix, so local timing for a given half-month can run early relative to the county table—treat windows as planning ranges, not guarantees for your yard. Heat is the hard bound for much of the low desert, not only frost. When the source table is coarse, the app stays coarse rather than fabricating precision. If you find a wrong window or a broken citation link, use the Contact page and include the crop name, the half-month you expected, and a URL to the publication you are citing.'
      }
    ] as const satisfies readonly LegalSectionCopy[]
  },

  terms: {
    title: 'Terms of use',
    description:
      'Terms for using the AZ Planting Calendar web app: planning tool only, sourced Extension data, no accounts, no warranties for garden outcomes.',
    updated: 'Last updated 1 August 2026',
    intro:
      'These terms govern use of the AZ Planting Calendar website and its public JSON API (the “Service”), a free planning tool for Arizona low-desert home gardening focused on Cave Creek, Arizona 85331. By loading the site, following its routes, or calling its API, you agree to these terms. If you do not agree, do not use the Service. There are no paid plans and no user accounts on this product.',
    sections: [
      {
        heading: 'Acceptance and eligibility',
        body: 'You must be able to form a binding agreement under the laws that apply to you. If you use the Service on behalf of an organization, you confirm you are allowed to accept these terms for that organization. There is no registration step, no sign-in, and no age-gated account flow because the product does not create accounts. Loading pages, changing filters, opening crop detail, or requesting /api routes is acceptance of these terms for that use. If you cannot accept them, leave the site and stop calling the API.'
      },
      {
        heading: 'What the service is',
        body: 'AZ Planting Calendar is an informational web application that shows which vegetable crops are listed as plantable (by seed or by transplant) in a given half-month for the default Maricopa County low-desert zone represented in the dataset, with Cave Creek 85331 as the default planning context. The home page presents a plantable-now list driven by a calendar date, a full-year half-month grid, filters for method and month, and crop detail pages that include days-to-harvest ranges when present in the seed data and citations to the source publication. The Service also exposes read-only JSON endpoints under /api for plantable crops, grid data, crop detail, zone metadata, and health. The Service does not sell seeds, take orders, book landscaping labor, manage irrigation hardware, or provide live weather forecasts.'
      },
      {
        heading: 'No accounts and no paid product',
        body: 'The Service does not offer registration, login, passwords, session cookies for identity, OAuth, social sign-in, billing, or subscription tiers. There is no user profile table for visitors and no authenticated write path for planting data through this UI. Because there are no accounts, there is nothing to close when you stop visiting; residual state is limited to what your browser keeps (for example a theme preference in localStorage) and optional filter or date parameters you place in a URL you share.'
      },
      {
        heading: 'Central disclaimer — garden planning, not professional advice',
        body: 'Planting windows, method labels (seed versus transplant), days-to-harvest ranges, frost date fields, and zone labels are planning aids derived from published public materials and approximate frost references. They are not a warranty that a crop will germinate, survive summer heat, avoid frost, meet HOA rules, or produce a harvest on any schedule. They are not a substitute for local Extension agents, licensed professionals, soil tests, water-quality tests, or on-site observation. The windows are county-level Maricopa low-desert guidance, not a site-specific prescription for every elevation or microclimate. Cave Creek sits higher than central Phoenix, so local timing often runs early relative to the published county table; heat and frost can arrive on different schedules than the half-month labels imply. County tables cannot encode every microclimate in Cave Creek, Phoenix, or surrounding communities. You remain solely responsible for what you plant, when you plant it, and how you irrigate and care for it.'
      },
      {
        heading: 'Source data, verification limits, and intellectual property',
        body: 'Crop calendars displayed by the Service are transcribed from the University of Arizona Cooperative Extension publication “Vegetable Planting Calendar for Maricopa County” (az1005, Kai Umeda). The shipped dataset contains forty-five crops with marker sequences verified against the az1005 PDF text stream. Eight crops were deliberately excluded because their sequences could not be verified (Basil; Broccoli; Brussel Sprouts; Cabbage; Cabbage, Chinese; Kohlrabi; Melons, Cantaloupe/Honeydews, etc.; and Onions, Green)—they are not listed as plantable here, and that absence is a known limitation, not proof those crops cannot grow in the low desert. The University of Arizona and Cooperative Extension retain their intellectual property and other rights in those publications, including copyright in the original table. This project is not affiliated with, endorsed by, or sponsored by the University of Arizona or Maricopa County. Display of sourced windows for personal planning is not a transfer of ownership in the underlying publication, and it is not permission to scrape, bulk-redistribute, or rebrand third-party content as your own commercial dataset without checking the publisher’s terms and applicable law. App branding, layout, trademarks in the product name and mark, and original code remain with their owners under the repository licence that applies to this project.'
      },
      {
        heading: 'Acceptable use',
        body: 'Use the Service only for lawful purposes. You agree not to:',
        items: [
          'Probe, disrupt, overload, or abuse the hosted site or API in a way that harms availability for others',
          'Scrape or automate access at a volume or manner that degrades the Service or violates the terms of the host or of the original data publishers',
          'Misrepresent listed planting windows as a certified agricultural prescription, a government order, or a guarantee of yield',
          'Attempt to inject, forge, or alter crop or window data through this UI or API (the public surface is read-only by design)',
          'Use the Service to break the law, harass others, or distribute malware'
        ]
      },
      {
        heading: 'API and bulk use',
        body: 'The public JSON API is provided so the same plantable, grid, crop, and zone data that power the UI can be inspected programmatically for personal garden planning and for honest interoperability. Rate limits or edge protections applied by the host (Cloudflare) may block abusive traffic. Bulk redistribution of third-party Extension content, or presentation of API output as an official University of Arizona product, is not authorized by these terms. If you need rights beyond personal planning use, contact the original publisher of the calendar table and respect its licensing and citation requirements.'
      },
      {
        heading: 'Third-party services and outbound links',
        body: 'The site is hosted on Cloudflare Pages. Data for crops and windows is stored in Cloudflare D1 and read by Pages Functions. Citation links may send you to extension.arizona.edu or other publisher hosts. Those services have their own terms and privacy policies. We are not responsible for third-party content, uptime, security, or practices. Following a citation link leaves this site and is governed by that destination’s rules.'
      },
      {
        heading: 'Disclaimer of warranties',
        body: 'The Service is provided “as is” and “as available,” without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the transcribed windows match every revision of the publisher’s PDF or HTML table at every moment, that frost dates are exact for your yard, that the API will remain reachable, that filters will always match your mental model of a season, or that any crop will succeed. Some jurisdictions do not allow certain warranty exclusions; in those places, exclusions apply only to the extent permitted.'
      },
      {
        heading: 'Limitation of liability',
        body: 'To the maximum extent permitted by law, the maintainers of AZ Planting Calendar are not liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost crops, lost data, lost goodwill, business interruption, or substitute services, arising from your use of the Service or reliance on listed windows, frost fields, or citations, whether based on contract, tort, or any other theory. Total liability for any claim relating to this free Service is limited to zero US dollars, because the Service is free and provided without paid consideration. Mandatory rights that cannot be waived in your jurisdiction remain intact.'
      },
      {
        heading: 'Indemnity',
        body: 'You agree to indemnify, defend, and hold the maintainers harmless from claims, damages, losses, and expenses (including reasonable legal fees) arising from your misuse of the Service, your misrepresentation of listed planting data, damage to plants or property after you plant, or your breach of these terms, to the extent permitted by applicable law.'
      },
      {
        heading: 'Availability and changes to the service',
        body: 'We may change, suspend, or discontinue the website, the API, the default zone, the seed dataset, or any part of the UI without notice and without liability. Windows may be corrected when a transcription error is found, re-seeded when a source revision is incorporated, or temporarily unavailable when the host or database has a problem. There is no uptime SLA and no paid support commitment. The project is maintained on a best-effort basis for home gardeners.'
      },
      {
        heading: 'Termination',
        body: 'You may stop using the Service at any time by leaving the site and stopping API calls. Because there are no accounts, there is no account termination step. We may refuse further automated access or shut down endpoints if you violate these terms, if continued operation is unlawful, or if we discontinue the project. Provisions that by their nature should survive (including disclaimers, liability limits, indemnity, and intellectual-property notices) continue after your use ends.'
      },
      {
        heading: 'Changes to these terms',
        body: 'We may update these terms when the product or legal needs change. The “Last updated” line at the top of this page is how notice is given; we do not operate an email list for term notices. Continued use after the date changes means you accept the new terms for subsequent use. If you do not accept a change, stop using the Service.'
      },
      {
        heading: 'Governing law and disputes',
        body: 'These terms are conditions of use for a free personal garden-planning project; they are not a substitute for advice from a lawyer in your jurisdiction. Before filing a formal claim, contact the maintainer using the route on the Contact page and allow a reasonable time to respond. Where the law requires a governing jurisdiction to be stated and permits the parties to choose, the laws of the State of Arizona and the United States apply to the extent they govern a personal project of this kind, without creating a fictional company domicile. Mandatory consumer protections in your place of residence that cannot be waived still apply. Nothing here requires you to waive rights you are legally forbidden to waive.'
      },
      {
        heading: 'Contact about these terms',
        body: 'Questions about these terms: use the Contact page on this site and open a GitHub issue as described there. For privacy-specific requests, say so in the issue title. For security concerns, describe impact without pasting secrets into a public channel when you can avoid it. Data-error reports about a crop window should include the crop name, half-month, and a citation URL as described on Contact.'
      }
    ] as const satisfies readonly LegalSectionCopy[]
  },

  privacy: {
    title: 'Privacy',
    description:
      'Privacy practices for AZ Planting Calendar: no accounts, no tracking cookies set by the app, theme preference on your device only, planting data from public Extension sources.',
    updated: 'Last updated 1 August 2026',
    intro:
      'This privacy notice applies to the AZ Planting Calendar website and its public JSON API. The product is a free garden-planning tool. There are no user accounts and no sign-in. Visitors do not submit forms that create a profile. Planting windows come from public University of Arizona Cooperative Extension materials stored as application data, not from private profiles about you. We do not run ads or third-party product-analytics trackers in this UI.',
    sections: [
      {
        heading: 'Who we are and how to reach us',
        body: 'AZ Planting Calendar is a small personal open project for low-desert home gardeners, with a default planning context of Cave Creek, Arizona 85331. There is no company registration page, postal address, data-protection officer listing, or phone line published with this app. Contact is via a public GitHub issue on the RedAnvil repository that hosts the app, as described on the Contact page. For privacy access, correction, or deletion questions, start the issue title with “AZ Planting Calendar: privacy request” and include enough detail to investigate (for example a path you visited, approximate time, and what you saw).'
      },
      {
        heading: 'No accounts',
        body: 'This app does not offer registration, login, passwords, session cookies for identity, OAuth, or social sign-in. There is no users table for visitors. Cloudflare D1 in this project stores crops, planting windows, sources, and zone metadata used to answer planting questions—not visitor identities. Server-side code for visitor-facing traffic is limited to static Pages assets plus read-only Pages Functions under /api that return planting data or a health status. Nothing in that path creates a login session for you.'
      },
      {
        heading: 'What application data the site shows',
        body: 'The UI and API show public educational planting information: crop names, seed or transplant methods, half-month window indices, optional days-to-harvest ranges, notes when present, citation fields (title, author, publisher, URL, retrieved date), and default zone fields (name, ZIP, approximate last and first frost). That content is application data derived from University of Arizona Cooperative Extension publication az1005 (Vegetable Planting Calendar for Maricopa County). Forty-five crops are included; eight crops were deliberately excluded as unverifiable against the az1005 text stream (Basil; Broccoli; Brussel Sprouts; Cabbage; Cabbage, Chinese; Kohlrabi; Melons, Cantaloupe/Honeydews, etc.; Onions, Green). The dataset is not a private dossier about any visitor. Visitors do not write planting rows through this UI. The project is not affiliated with the University of Arizona.'
      },
      {
        heading: 'What we collect from visitors',
        body: 'From visitors, this app does not collect names, email addresses, passwords, payment details, phone numbers, or form fields that create a user profile. There is no newsletter signup, checkout, or registration form on the site. Optional contact happens when you open a public GitHub issue; that traffic is handled by GitHub under GitHub’s terms, not by an in-app message store in this product.',
        items: [
          'Theme preference on your device only: localStorage key theme with value light, dark, or system, set when you use the theme control—nothing else is written to localStorage by this app',
          'Optional view state you put in the page URL (for example date, method, month, or search query parameters) so a shared link opens the same plantable or filter view—these are not stored as a server-side profile',
          'Assistant questions you choose to submit: the free-text sentence is POSTed to this app’s /api/assistant function, which loads crop and window rows from D1 and sends your sentence plus that context to Cloudflare Workers AI for a single response. This app does not keep a chat archive of those messages',
          'Request metadata that Cloudflare may log while serving Pages and Functions (for example IP address, user agent, path, and timestamps under Cloudflare’s own practices)',
          'Ordinary browser behaviour such as HTTP cache entries for static assets you load'
        ]
      },
      {
        heading: 'What we do not collect',
        body: 'We do not run advertising pixels, third-party product-analytics SDKs, heatmaps, or retargeting scripts in this UI. We do not sell personal data. There is no mailing list and no marketing profile built from your use of this calendar.',
        items: [
          'No identity or billing fields collected by this app',
          'No RedAnvil- or app-set tracking or advertising cookies',
          'No social login or OAuth identity from this app',
          'No server-side store of visitor browsing history in a visitor profile table (the project does not have one)'
        ]
      },
      {
        heading: 'Cookies and local storage — only what this app actually uses',
        body: 'Application code for AZ Planting Calendar does not set advertising cookies and does not use session cookies for accounts (there are no accounts). The only intentional client persistence this app implements is localStorage for theme preference under the key theme (values light, dark, or system). Your browser may still keep ordinary HTTP cache entries for CSS, JavaScript, images, and API responses. Clear site data in the browser to remove the theme key and cached assets. We do not claim cookie banners for cookies we do not set. If the hosting platform or your browser stores technical cookies for security or load balancing, those follow the host’s or browser’s practices, not a first-party analytics product in this codebase.'
      },
      {
        heading: 'Why we collect and how we use information',
        body: 'Why we collect and process the limited data above is only to run the features the site actually provides. How we use that information is limited to these purposes of collection:',
        items: [
          'Render plantable-now lists, year grids, and crop detail from the sourced window database',
          'Remember light, dark, or system theme on the same browser after you change it',
          'Allow optional date and filter query parameters so you can bookmark or share a view',
          'Answer health and data API requests so the UI and operators can confirm the runtime is up',
          'Operate hosting and edge delivery on Cloudflare infrastructure'
        ]
      },
      {
        heading: 'Third-party processors and outbound destinations',
        body: 'Infrastructure and outbound destinations this product actually uses:',
        items: [
          'Cloudflare Pages hosts static assets and runs Pages Functions for /api routes; Cloudflare D1 stores crop, window, source, and zone rows for the app. Cloudflare receives the request metadata needed to serve those resources under Cloudflare’s terms and privacy policy.',
          'Cloudflare Workers AI receives the assistant sentence you submit (only when you use the assistant) together with crop/window context loaded from D1, so a model can return a grounded answer. We do not send theme preference or a user account (there is none).',
          'Citation links may open University of Arizona Cooperative Extension pages (for example extension.arizona.edu) when you choose to follow them; those hosts process that request under their own policies.',
          'Contact via public GitHub issues is handled by GitHub under GitHub’s terms and privacy policy; this app does not operate an in-app ticket database.'
        ]
      },
      {
        heading: 'Where data lives and international transfers',
        body: 'Static assets, Pages Functions, and D1 for this app run on Cloudflare’s network. Cloudflare operates globally, so request handling and database access may involve processing outside your country. Planting content in D1 is application data for the calendar, not a private profile about you. We do not maintain a separate visitor identity database for this product.'
      },
      {
        heading: 'Retention and deletion',
        body: 'Theme preference remains on your device until you clear site data or remove the theme key. URL query parameters last only as long as the link or history entry that contains them. Crop and window rows remain in the application database until maintainers update the seed data; there is no automatic per-visitor expiry job because there is no per-visitor store. Cloudflare edge or access logs, if any, follow Cloudflare’s retention practices, which this repository does not control. Clearing your own browser storage is how you delete the theme preference. GitHub issues you open follow GitHub’s retention rules for that account and repository.'
      },
      {
        heading: 'Your rights and requests',
        body: 'Your rights under privacy law vary by place of residence. Depending on where you live, you may have rights to access, correct, delete, port, or object to certain processing of personal data, including the right to make an access request or a request for deletion or export of data that relates to you. For this app those rights mainly concern the minimal data described above, not an account profile we never created. Exercise them by opening a GitHub issue titled with “privacy request” as described on the Contact page. There is no SLA; response depends on maintainer availability.',
        items: [
          'Access: planting pages and public API responses are already world-readable application data; theme data lives only in your browser',
          'Correction: report a wrong crop window with the crop name, half-month, and source URL so maintainers can fix the seed data if the error is real',
          'Deletion: clear localStorage for theme; host-log deletion is subject to Cloudflare practices; GitHub issue deletion is subject to GitHub’s tools and policies',
          'Portability: copy public pages or call the public JSON API yourself',
          'Objection: stop using the site; there is no marketing list to opt out of'
        ]
      },
      {
        heading: 'Children',
        body: 'This app is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has submitted personal information through a GitHub issue about this app, open a privacy request with enough detail to find the message. We will address what we can identify from the details you provide.'
      },
      {
        heading: 'Security practices in this codebase',
        body: 'What this app actually implements: HTTPS is provided by Cloudflare for the hosted site; API helpers set content-type nosniff, a same-origin referrer policy, and frame denial headers; database access for crops and windows uses parameterized queries rather than string-concatenated SQL; the public surface does not accept visitor writes to planting tables. What this notice does not claim: we do not assert a formal SOC 2 report, application-layer encryption at rest for a visitor database we do not operate, or that public planting tables are confidential. No method of transmission or storage is perfectly secure. Do not email secrets when reporting problems.'
      },
      {
        heading: 'Changes to this policy',
        body: 'We may update this notice when the product, API surface, or hosting setup changes. The “Last updated” line at the top of this page is the notice mechanism. We do not operate an email list for policy notices. Continued use of the site after the date changes means you accept the revised notice for subsequent use. For material changes, the updated text on this page is the record; check the date when you care about the current rules.'
      },
      {
        heading: 'Contact for privacy',
        body: 'Privacy questions and requests: open a GitHub issue as described on the Contact page, with “privacy request” in the title. Source for this app, including this notice text, the Pages Functions, and the client theme storage key, lives in the project repository that ships this site. General product and data-error contact details are summarized on the Contact page.'
      }
    ] as const satisfies readonly LegalSectionCopy[]
  },

  contact: {
    title: 'Contact',
    description:
      'How to report a wrong planting window, broken citation, or privacy question for AZ Planting Calendar.',
    updated: 'Last updated 1 August 2026',
    intro:
      'This page explains how to reach the maintainer of AZ Planting Calendar. The product is a small free tool, not a commercial support desk. There is no in-app ticket system, no chat widget, and no user accounts through which to send messages. Contact is open via the project’s public GitHub repository.',
    sections: [
      {
        heading: 'How to reach the maintainer',
        body: 'Open an issue on the public RedAnvil GitHub repository that hosts this app (github.com/brianference/redanvil). Use a clear title so the report can be sorted: start with “AZ Planting Calendar: data error”, “AZ Planting Calendar: privacy request”, or “AZ Planting Calendar: security report” as appropriate. Do not put secrets in a public issue; for sensitive security notes, describe impact without credentials and ask for a private channel in the first message.'
      },
      {
        heading: 'Reporting a wrong planting window',
        body: 'If a crop shows the wrong half-month, the wrong seed versus transplant method, or a broken citation link, include enough detail to fix the seed data without guessing:',
        items: [
          'Crop name exactly as shown in the app',
          'The half-month or calendar date you checked',
          'What you expected to see and what the app showed',
          'A URL to the University of Arizona Cooperative Extension page or publication you are citing (az1005 PDF or the Maricopa vegetable planting calendar page)'
        ]
      },
      {
        heading: 'What we will and will not add',
        body: 'We only add or change windows that can be traced to a character-verified public source for this zone. We do not invent dates from experience, social media, or frost calculators alone. The shipped set is forty-five verified crops from az1005. Eight crops were deliberately excluded as unverifiable (Basil; Broccoli; Brussel Sprouts; Cabbage; Cabbage, Chinese; Kohlrabi; Melons, Cantaloupe/Honeydews, etc.; Onions, Green). A request to add one of those—or any other crop—needs a citable, verifiable sequence from the published table before it will ship.'
      },
      {
        heading: 'Accuracy context for Cave Creek',
        body: 'The default zone is Cave Creek, Arizona 85331, using Maricopa County low-desert half-month windows. Cave Creek sits higher than central Phoenix, so local timing can run early relative to the county table. When you report a timing mismatch, say whether you are comparing to central Phoenix, a higher elevation site, or the az1005 table itself—that context matters for whether the bug is transcription or microclimate.'
      },
      {
        heading: 'Privacy and security messages',
        body: 'For privacy access, correction, or deletion questions, put “privacy request” in the issue title and describe what you believe is stored and where you saw it. This app has no user accounts; theme preference lives only in your browser localStorage under the key theme (values light, dark, or system). Clearing site data removes it without contacting anyone. For security concerns, describe impact and steps to reproduce without pasting live secrets into a public thread.'
      },
      {
        heading: 'Response expectations',
        body: 'This is a best-effort home-garden project. Replies may take time. There is no uptime or support SLA. A transcription error with a solid citation is more likely to be acted on than a general request for a crop with no verifiable source. The project is not affiliated with the University of Arizona; cite Extension publications directly when you need official guidance.'
      }
    ] as const satisfies readonly LegalSectionCopy[]
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
    gridTitle: 'Year grid — AZ Planting Calendar',
    gridDescription:
      'Full-year half-month planting grid for Maricopa County low desert: crops × 24 columns from UA Cooperative Extension az1005.',
    aboutTitle: 'About — AZ Planting Calendar',
    aboutDescription:
      'How planting windows are sourced for the Arizona low desert and Cave Creek 85331 from University of Arizona Extension.',
    termsTitle: 'Terms — AZ Planting Calendar',
    termsDescription:
      'Terms of use for the free AZ Planting Calendar planning tool: no accounts, sourced Extension data, garden planning only.',
    privacyTitle: 'Privacy — AZ Planting Calendar',
    privacyDescription:
      'Privacy practices for AZ Planting Calendar: no accounts, no tracking cookies set by the app, theme on device only.',
    contactTitle: 'Contact — AZ Planting Calendar',
    contactDescription:
      'Report data errors or privacy questions for the Maricopa low-desert planting calendar.'
  }
} as const;

export type Copy = typeof en;
