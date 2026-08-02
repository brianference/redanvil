/**
 * Shipped examples: the story of one prompt becoming a deployed app.
 *
 * Every frame referenced here is a REAL screenshot of a REAL deployment,
 * captured by `.github/scripts/capture_example.mjs` against production. Nothing
 * on this page is a mockup, a redraw, or an approximation — an example that
 * shows a screen nobody shipped is the fabricated-evidence failure the rest of
 * this repo exists to prevent.
 *
 * `capture_example.mjs` exits non-zero when any frame fails, so the page cannot
 * ship with a hole in it.
 */

/** One phone screen in the store-style strip. */
export interface ExampleScreen {
  /** Image path under /examples. */
  readonly src: string;
  /** Headline shown above the phone, App Store style. */
  readonly caption: string;
  /** Accessible description of what the screen shows. */
  readonly alt: string;
  /** Intrinsic width of the asset (for layout and CLS). */
  readonly width: number;
  /** Intrinsic height of the asset (for layout and CLS). */
  readonly height: number;
}

/** One end-to-end example: prompt, PRD, shipped app. */
export interface Example {
  /** URL-safe id. */
  readonly slug: string;
  /** Product name. */
  readonly name: string;
  /** One line on what it does. */
  readonly tagline: string;
  /** Short kicker above the title on the card face (optional). */
  readonly kicker?: string;
  /** Filter-chip categories this app belongs to. */
  readonly categories: readonly string[];
  /** Stat chips under the card title (real measured figures only). */
  readonly stats?: readonly string[];
  /** The exact prompt that was typed into the builder. */
  readonly prompt: string;
  /** Wizard answers, as given. */
  readonly answers: readonly { readonly label: string; readonly value: string }[];
  /**
   * Screenshot of the builder's Review step for this prompt.
   * Optional when no production capture exists yet -- omit rather than invent.
   */
  readonly reviewShot?: string;
  /** The generated brand mark for this app. */
  readonly logo: string;
  /** Store-style screens of the deployed app. */
  readonly screens: readonly ExampleScreen[];
  /** Live URL of the deployed app. */
  readonly liveUrl: string;
  /** What the gate said, and where that number comes from -- only real measurements. */
  readonly gate: string;
  /**
   * What the shipped app actually does, grouped by area.
   *
   * Every line must name a control a visitor can operate on the live URL. A
   * feature list is a claim about a deployment, so it carries the same standard
   * as the screenshots: nothing here that is not on the site.
   */
  readonly features: readonly {
    readonly area: string;
    readonly items: readonly string[];
  }[];
  /** Public repository, so the claims above can be checked against the code. */
  readonly repoUrl: string;
}

/**
 * The shipped examples.
 *
 * Add an entry only after `capture_example.mjs` has produced its frames against
 * a live deployment. A hand-written entry pointing at images that do not exist
 * renders as a broken page, by design.
 *
 * AZ Planting Calendar figures were re-read from live production APIs and a
 * local gate run on 2026-08-02. QuickFlight gate numbers keep their original
 * run date (2026-07-27); only the live URL was re-checked as HTTP 200.
 */
export const EXAMPLES: readonly Example[] = [
  {
    slug: 'az-planting-calendar',
    name: 'AZ Planting Calendar',
    kicker: 'Maricopa · low desert',
    tagline:
      'Arizona low-desert planting calendar for Maricopa County -- what to plant now in Cave Creek and seven neighbouring towns.',
    categories: ['Data tools', 'All'],
    stats: ['45 crops', '83 windows', '8 zones', 'az1005'],
    prompt:
      'Show what is plantable in the current half-month window, seed vs transplant marked\nFull year calendar grid: crops down, 24 half-month columns across\nCrop detail page with every planting window and days to harvest\nFilter the calendar by month and by seed or transplant\nEvery planting window cites az1005 with a link to the publication\n(default zone set to Cave Creek Arizona)\nreverse engineer features from this https://www.almanac.com/gardening/planting-calendar/zipcode/85331',
    answers: [
      {
        label: 'Prompt on jobs API',
        value: 'slug show-what-is-plantable-in-the-current-half-month (created 2026-08-01T16:22:01.046Z)'
      },
      { label: 'Live auth model', value: 'No sign-in; plantable/crops/zones APIs are public GETs' },
      {
        label: 'Live data (2026-08-02)',
        value: 'D1 via /api/crops and /api/zones: 45 crops, 83 planting windows, 8 Maricopa zones'
      }
    ],
    logo: '/examples/az-planting-calendar/logo.webp',
    screens: [
      {
        src: '/examples/az-planting-calendar/home-375-light.webp',
        caption: 'What is plantable this half-month',
        alt: 'AZ Planting Calendar home on a phone in light theme, listing plantable crops for the current half-month in Cave Creek',
        width: 390,
        height: 1040
      },
      {
        src: '/examples/az-planting-calendar/home-375-dark.webp',
        caption: 'The same home, dark theme',
        alt: 'AZ Planting Calendar home on a phone in dark theme with the same plantable list and zone chrome',
        width: 390,
        height: 1040
      },
      {
        src: '/examples/az-planting-calendar/home-1280-light.webp',
        caption: 'Desktop width, light theme',
        alt: 'AZ Planting Calendar home at desktop width in light theme showing plantable crops and layout at 1280',
        width: 960,
        height: 750
      },
      {
        src: '/examples/az-planting-calendar/home-1280-dark.webp',
        caption: 'Desktop width, dark theme',
        alt: 'AZ Planting Calendar home at desktop width in dark theme showing plantable crops and layout at 1280',
        width: 960,
        height: 750
      }
    ],
    liveUrl: 'https://az-planting-calendar.pages.dev',
    repoUrl: 'https://github.com/brianference/redanvil/tree/main/az-planting-calendar',
    features: [
      {
        area: 'Planting data (read from live /api on 2026-08-02)',
        items: [
          '45 crops from University of Arizona Cooperative Extension az1005 (Vegetable Planting Calendar for Maricopa County), returned by GET /api/crops',
          '83 planting windows: sum of each crop window_count from the same response; each window is joined to its source with an INNER JOIN on sources, so a window without a citation cannot render',
          '8 Maricopa County low-desert zones from GET /api/zones (Cave Creek default, plus Phoenix, Mesa, Tempe, Scottsdale, Glendale, Chandler, Buckeye)'
        ]
      },
      {
        area: 'Zone lookup and frost dates',
        items: [
          'Zone control matches by zone id, city name, or ZIP (GET /api/zones?q= and the in-app search list)',
          'Frost dates are NOAA 1991-2020 normals as published per town; GET /api/zone for Cave Creek returns last_frost 02-20 (Feb 20) and first_frost 12-06 (Dec 6)',
          'Elevation is carried per zone: Cave Creek is 2,529 ft against Buckeye 1,040 ft, which is why county-level dates run early locally'
        ]
      },
      {
        area: 'What a visitor can operate',
        items: [
          'Half-month timeline selects a half-month and reloads plantable crops for that window (GET /api/plantable?date=)',
          'Live crop name search next to the input: typing "tomato" returns a result count in the first viewport and narrows the year grid',
          'Method and month filters; year grid with crops down and 24 half-month columns across',
          'Crop detail pages with every planting window, harvest days when present, and a working citation link to extension.arizona.edu'
        ]
      },
      {
        area: 'Planting assistant',
        items: [
          'Right-hand rail on desktop and a block under the list on mobile (not a floating button)',
          'Converts a question into filter values only and answers from D1 crop and window rows via /api/assistant -- never from model knowledge alone',
          'Past ten requests in a minute the rate limiter returns HTTP 429 with Retry-After (measured in acceptance tests)'
        ]
      },
      {
        area: 'Honest limits',
        items: [
          'Windows apply to Maricopa County low-desert planning only -- not mid- or high-elevation Arizona',
          'No accounts and no personal garden save on the public API surface checked for this entry'
        ]
      }
    ],
    gate: 'Measured against the local wrangler pages-dev build of az-planting-calendar on 2026-08-02 (after Timeline + rail + Tailwind v4): axe-core reports 0 violations in both themes across 375/1280/1440/1920, 0 console errors and 0 CSP violations across those loads, search input y=212 at 1280 (above the fold), brand mark height 96px at 1280, painted main width 100% at 1440 and 1920, live search result count at y=275 at both 375 and 1280 after typing tomato. Unit suite: 101 passed (vitest). Acceptance: 56 passed (Playwright desktop + mobile). Live production https://az-planting-calendar.pages.dev returned HTTP 200 the same day; crop/window/zone counts re-read from production /api/crops and /api/zones matched 45 / 83 / 8. CSP remains style-src \'self\' with no unsafe-inline.'
  },
  {
    slug: 'quickflight',
    name: 'QuickFlight',
    kicker: 'Travel · fares',
    tagline: 'Finds the lowest-cost airline flight and lets you filter the way you actually fly.',
    categories: ['Travel', 'Mobile', 'All'],
    stats: ['4,162 airports', 'Live fares', 'Dark theme'],
    prompt:
      'a mobile-first app that finds the lowest cost airline flight with nonstop only, maximum one layover, minimum layover duration, arrival time window, total travel time',
    answers: [
      { label: 'App type', value: 'Mobile app' },
      { label: 'Sign-in', value: 'No' },
      { label: 'Entities', value: 'flight' },
      { label: 'Data storage', value: 'Simple D1 tables' }
    ],
    reviewShot: '/examples/quickflight/prd-review.png',
    logo: '/examples/quickflight/logo.png',
    screens: [
      {
        src: '/examples/quickflight/app-home.png',
        caption: 'See the fare before you pick the day',
        alt: 'QuickFlight home screen showing fares as pins on a route arc, with a map and calendar toggle',
        width: 390,
        height: 844
      },
      {
        src: '/examples/quickflight/app-results.png',
        caption: 'Every filter, as a real control',
        alt: 'QuickFlight results screen showing the constraints panel and a stack of boarding-pass style fares',
        width: 390,
        height: 844
      },
      {
        src: '/examples/quickflight/app-results-dark.png',
        caption: 'A real dark theme, not a recolour',
        alt: 'The same QuickFlight results screen rendered in the dark theme',
        width: 390,
        height: 844
      }
    ],
    liveUrl: 'https://quickflight.pages.dev',
    repoUrl: 'https://github.com/brianference/quickflight',
    features: [
      {
        area: 'Departure and arrival',
        items: [
          'Labelled Depart and Arrive fields, each a typeahead over 4,162 airports worldwide',
          'One query matches any form of a name: Phoenix, PHX, Arizona, AZ or Sky Harbor',
          'Swap control reverses the pair',
          'Include nearby airports widens the search to everything within 100km, and says how many it added rather than quietly returning fares from an airport nobody picked'
        ]
      },
      {
        area: 'Calendar and dates',
        items: [
          'Every day shows its cheapest fare, with the cheapest day of the month highlighted',
          'Pick two days to select a range; the whole range highlights as you go',
          'A one-tap plus/minus 3 days expands a chosen day into a seven-day window'
        ]
      },
      {
        area: 'Filters, each a real control',
        items: [
          'Best, cheapest or fastest ranking',
          'Airlines: multi-select, one chip per carrier present in your results',
          'Maximum price, bounded by the cheapest and dearest fare in the set',
          'Nonstop only, max one layover, or a specific connecting airport',
          'Layover length, departure time of day, arrival window, total travel time',
          'Passengers with adults, children and lap infants at real per-airline caps'
        ]
      },
      {
        area: 'Fares you can trace',
        items: [
          'Every fare shows its source and the date it was captured',
          'Live fares come from the Travelpayouts feed; the recorded snapshot is the fallback',
          'When no provider is configured the app says so, rather than rendering an empty list as a successful search'
        ]
      }
    ],
    // Original gate run date retained: full gate numbers not re-measured this session.
    // Live URL re-checked 2026-08-02: HTTP 200.
    gate: 'Scored by the RedAnvil gate against the deployed build on 2026-07-27: axe-core 4.12.1 reports zero violations in both themes, painted content fills at least 97% of the viewport on every route at 1440 and 1920, and 122 acceptance tests drive the real UI in a browser across desktop and mobile. Live URL https://quickflight.pages.dev returned HTTP 200 when re-checked on 2026-08-02; gate figures above keep the 2026-07-27 run date rather than being refreshed without a full re-gate.'
  }
];

/** Unique filter chip labels derived from example categories (All first). */
export const EXAMPLE_FILTERS: readonly string[] = [
  'All',
  ...Array.from(
    new Set(
      EXAMPLES.flatMap((ex) => ex.categories).filter((c) => c !== 'All')
    )
  ).sort()
];
