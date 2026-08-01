/**
 * The apps this repo gates. Single source of truth for reverify, meets-the-bar,
 * pre-push, and CI. Do not hardcode a parallel list elsewhere.
 *
 * @typedef {{
 *   slug: string,
 *   dir: string,
 *   url: string,
 *   designRoutes: string,
 *   widthRoutes: string | null,
 *   e2e: boolean,
 *   wizard: boolean,
 *   na: string
 * }} GatedApp
 */

/** @type {readonly GatedApp[]} */
export const APPS = Object.freeze([
  {
    slug: 'app-builder',
    dir: 'app-builder',
    url: 'https://redanvil.pages.dev',
    designRoutes: '/about,/contact,/terms,/privacy,/saved,/examples,/no-such-page',
    widthRoutes: null,
    e2e: true,
    wizard: true,
    na: 'process'
  },
  {
    // Added because it was NOT here, and that omission is why its visual review
    // never ran. app-builder and dashboard were audited on every cycle without
    // anyone deciding to; this app relied on me remembering, and it shipped with
    // a text-label theme toggle instead of an icon and an unrun acceptance
    // suite. The deploy hook fired eight times that day saying what to run. An
    // advisory reminder loses to momentum; a scripted step does not.
    slug: 'az-planting-calendar',
    dir: 'az-planting-calendar',
    url: 'https://az-planting-calendar.pages.dev',
    designRoutes: '/about,/contact,/terms,/privacy,/no-such-page',
    widthRoutes: '/,/about,/contact,/terms,/privacy',
    e2e: false,
    wizard: false,
    na: 'process'
  },
  {
    slug: 'dashboard',
    dir: 'dashboard',
    url: 'https://redanvil-dashboard.pages.dev',
    designRoutes: '/about,/contact,/terms,/privacy,/no-such-page',
    widthRoutes: '/,/about,/contact,/terms,/privacy',
    e2e: false,
    wizard: false,
    na: 'process'
  }
]);

/**
 * Look up a gated app by slug.
 *
 * @param {string} slug App slug.
 * @returns {GatedApp | undefined}
 */
export function appBySlug(slug) {
  return APPS.find((a) => a.slug === slug);
}
