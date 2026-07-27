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
    gate: 'Scored by the RedAnvil gate against the deployed build: axe-core reports zero violations in both themes, and painted content fills at least 96% of the viewport on every route at 1440 and 1920.'
  }
];
