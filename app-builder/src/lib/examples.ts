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
}

/** One end-to-end example: prompt, PRD, shipped app. */
export interface Example {
  /** URL-safe id. */
  readonly slug: string;
  /** Product name. */
  readonly name: string;
  /** One line on what it does. */
  readonly tagline: string;
  /** The exact prompt that was typed into the builder. */
  readonly prompt: string;
  /** Wizard answers, as given. */
  readonly answers: readonly { readonly label: string; readonly value: string }[];
  /** Screenshot of the builder's Review step for this prompt. */
  readonly reviewShot: string;
  /** The generated brand mark for this app. */
  readonly logo: string;
  /** Store-style screens of the deployed app. */
  readonly screens: readonly ExampleScreen[];
  /** Live URL of the deployed app. */
  readonly liveUrl: string;
  /** What the gate said, and where that number comes from. */
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
 */
export const EXAMPLES: readonly Example[] = [
  {
    slug: 'quickflight',
    name: 'QuickFlight',
    tagline: 'Finds the lowest-cost airline flight and lets you filter the way you actually fly.',
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
        alt: 'QuickFlight home screen showing fares as pins on a route arc, with a map and calendar toggle'
      },
      {
        src: '/examples/quickflight/app-results.png',
        caption: 'Every filter, as a real control',
        alt: 'QuickFlight results screen showing the constraints panel and a stack of boarding-pass style fares'
      },
      {
        src: '/examples/quickflight/app-results-dark.png',
        caption: 'A real dark theme, not a recolour',
        alt: 'The same QuickFlight results screen rendered in the dark theme'
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
    gate: 'Scored by the RedAnvil gate against the deployed build on 2026-07-27: axe-core 4.12.1 reports zero violations in both themes, painted content fills at least 97% of the viewport on every route at 1440 and 1920, and 122 acceptance tests drive the real UI in a browser across desktop and mobile.'
  }
];
