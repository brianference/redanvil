/**
 * The apps this repo gates. Single source of truth for reverify, meets-the-bar,
 * pre-push, CI, and user-refuse stranger expectations. Do not hardcode a
 * parallel list elsewhere.
 *
 * @typedef {{
 *   path: string,
 *   linkName: string,
 *   headingText: string
 * }} StrangerRequiredPage
 *
 * @typedef {{
 *   purposeSentence: string,
 *   requiredPages: readonly StrangerRequiredPage[]
 * }} StrangerExpectations
 *
 * @typedef {{
 *   slug: string,
 *   dir: string,
 *   url: string,
 *   designRoutes: string,
 *   widthRoutes: string | null,
 *   e2e: boolean,
 *   wizard: boolean,
 *   na: string,
 *   stranger: StrangerExpectations
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
    na: 'process',
    // Copied from app-builder/src/i18n: footer labels + page h1 titles (LegalPage).
    stranger: Object.freeze({
      purposeSentence:
        'RedAnvil turns a plain-language prompt into a complete, downloadable product requirements document (PRD) you can hand to a coding agent.',
      requiredPages: Object.freeze([
        Object.freeze({ path: '/about', linkName: 'About', headingText: 'About RedAnvil' }),
        Object.freeze({ path: '/terms', linkName: 'Terms', headingText: 'Terms and Conditions' }),
        Object.freeze({ path: '/privacy', linkName: 'Privacy', headingText: 'Privacy Policy' }),
        Object.freeze({ path: '/contact', linkName: 'Contact', headingText: 'Contact' })
      ])
    })
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
    na: 'process',
    // Copied from az-planting-calendar/src/i18n/en.ts: footer.* link labels +
    // about/terms/privacy/contact page titles (rendered as the page h1).
    stranger: Object.freeze({
      purposeSentence:
        'Arizona low-desert planting calendar: search a crop and see when to plant it (seed or transplant) for Cave Creek / Maricopa County.',
      requiredPages: Object.freeze([
        Object.freeze({ path: '/about', linkName: 'About', headingText: 'About this calendar' }),
        Object.freeze({
          path: '/terms',
          linkName: 'Terms of use',
          headingText: 'Terms of use'
        }),
        Object.freeze({ path: '/privacy', linkName: 'Privacy', headingText: 'Privacy' }),
        Object.freeze({ path: '/contact', linkName: 'Contact', headingText: 'Contact' })
      ])
    })
  },
  {
    slug: 'dashboard',
    dir: 'dashboard',
    url: 'https://redanvil-dashboard.pages.dev',
    designRoutes: '/about,/contact,/terms,/privacy,/no-such-page',
    widthRoutes: '/,/about,/contact,/terms,/privacy',
    e2e: false,
    wizard: false,
    na: 'process',
    // Copied from dashboard/src/i18n/en.ts: app.footer* link labels + pages.*.title
    // (Page shell h1). Not az-planting-calendar copy.
    stranger: Object.freeze({
      purposeSentence:
        'RedAnvil forges full-stack web apps behind an automated quality gate. This site is the public, read-only dashboard for RedAnvil\'s own build run results.',
      requiredPages: Object.freeze([
        Object.freeze({ path: '/about', linkName: 'About', headingText: 'About' }),
        Object.freeze({ path: '/terms', linkName: 'Terms', headingText: 'Terms' }),
        Object.freeze({ path: '/privacy', linkName: 'Privacy', headingText: 'Privacy' }),
        Object.freeze({ path: '/contact', linkName: 'Contact', headingText: 'Contact' })
      ])
    })
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
