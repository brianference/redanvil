/**
 * The apps this repo gates. Single source of truth for reverify, meets-the-bar,
 * pre-push, CI, and user-refuse stranger expectations. Do not hardcode a
 * parallel list elsewhere.
 *
 * Scaffolded apps are appended from `.redanvil/managed-apps.json` (see
 * registerManagedApp) so the gate and PM see them without a hand-edited list.
 *
 * @typedef {{
 *   path: string,
 *   linkName: string,
 *   headingText: string
 * }} StrangerRequiredPage
 *
 * @typedef {{
 *   purposeSentence: string,
 *   requiredPages: readonly StrangerRequiredPage[],
 *   searchQuery: string
 * }} StrangerExpectations
 *
 * Primary product flow product-judgement harnesses exercise.
 * - `search`: type into search/filter, judge a visible matching result (today's default).
 * - `wizard`: chat → clarifying wizard → Forge PRD, judge a visible PRD result.
 *
 * @typedef {'search' | 'wizard'} CoreFlow
 *
 * @typedef {{
 *   slug: string,
 *   dir: string,
 *   url: string,
 *   designRoutes: string,
 *   widthRoutes: string | null,
 *   e2e: boolean,
 *   wizard: boolean,
 *   coreFlow: CoreFlow,
 *   na: string,
 *   stranger: StrangerExpectations
 * }} GatedApp
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Built-in production apps. Managed (scaffolded) apps are merged at read time.
 *
 * @type {readonly GatedApp[]}
 */
export const CORE_APPS = Object.freeze([
  {
    slug: 'app-builder',
    dir: 'app-builder',
    url: 'https://redanvil.pages.dev',
    designRoutes: '/about,/contact,/terms,/privacy,/saved,/examples,/no-such-page',
    widthRoutes: null,
    e2e: true,
    wizard: true,
    // Core flow is the wizard forge, not search. fe-search-present is waived;
    // qa_visual / user_refuse must drive chat → Forge PRD (see drive_wizard_forge.mjs).
    coreFlow: 'wizard',
    na: 'process',
    // Copied from app-builder/src/i18n: footer labels + page h1 titles (LegalPage).
    // searchQuery: for coreFlow=wizard this is the plain-language forge prompt a
    // stranger types into the composer (same shape as e2e_smoke_app_builder).
    stranger: Object.freeze({
      purposeSentence:
        'RedAnvil turns a plain-language prompt into a complete, downloadable product requirements document (PRD) you can hand to a coding agent.',
      searchQuery:
        'an app to remind you when your dogs ears need cleaned, teeth cleaned, groomed, vet appointments etc',
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
    coreFlow: 'search',
    na: 'process',
    // Copied from az-planting-calendar/src/i18n/en.ts: footer.* link labels +
    // about/terms/privacy/contact page titles (rendered as the page h1).
    // searchQuery: real crop name in the shipped az1005 catalog (API returns
    // "Tomatoes" for q=Tomato).
    stranger: Object.freeze({
      purposeSentence:
        'Arizona low-desert planting calendar: search a crop and see when to plant it (seed or transplant) for Cave Creek / Maricopa County.',
      searchQuery: 'Tomato',
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
    coreFlow: 'search',
    na: 'process',
    // Copied from dashboard/src/i18n/en.ts: app.footer* link labels + pages.*.title
    // (Page shell h1). Not az-planting-calendar copy.
    // searchQuery: a real run slug on the public feed (results/all.json shows
    // "dashboard" and "app-builder") -- what a stranger types after reading the list.
    stranger: Object.freeze({
      purposeSentence:
        'RedAnvil forges full-stack web apps behind an automated quality gate. This site is the public, read-only dashboard for RedAnvil\'s own build run results.',
      searchQuery: 'dashboard',
      requiredPages: Object.freeze([
        Object.freeze({ path: '/about', linkName: 'About', headingText: 'About' }),
        Object.freeze({ path: '/terms', linkName: 'Terms', headingText: 'Terms' }),
        Object.freeze({ path: '/privacy', linkName: 'Privacy', headingText: 'Privacy' }),
        Object.freeze({ path: '/contact', linkName: 'Contact', headingText: 'Contact' })
      ])
    })
  },
  {
    slug: 'pet-sitter',
    dir: 'pet-sitter',
    url: 'https://pet-sitter-vz1.pages.dev',
    designRoutes: '/about,/contact,/terms,/privacy,/sitters,/no-such-page',
    widthRoutes: '/,/about,/contact,/terms,/privacy',
    e2e: false,
    wizard: false,
    coreFlow: 'search',
    na: 'process',
    // Copied from pet-sitter/src/i18n/en.ts page titles (Page shell h1) and
    // claims.searchProbe.query (Leslieville — a real seeded neighbourhood).
    stranger: Object.freeze({
      purposeSentence:
        'Find and book trusted local pet sitters: browse sitters by neighbourhood with verified reviews, per-night rates, and the pet types each sitter accepts.',
      searchQuery: 'Leslieville',
      requiredPages: Object.freeze([
        Object.freeze({
          path: '/about',
          linkName: 'About',
          headingText: 'About Pet Sitter Finder'
        }),
        Object.freeze({
          path: '/terms',
          linkName: 'Terms',
          headingText: 'Terms and conditions'
        }),
        Object.freeze({
          path: '/privacy',
          linkName: 'Privacy',
          headingText: 'Privacy policy'
        }),
        Object.freeze({ path: '/contact', linkName: 'Contact', headingText: 'Contact' })
      ])
    })
  }
]);

/**
 * Placeholder stranger expectations for a freshly scaffolded managed app.
 * Real apps replace these when they graduate into CORE_APPS.
 *
 * @param {string} slug App slug.
 * @returns {StrangerExpectations}
 */
function managedStrangerDefaults(slug) {
  return Object.freeze({
    purposeSentence: `${slug}: managed scaffold — purpose not yet product-judged.`,
    searchQuery: 'test',
    requiredPages: Object.freeze([
      Object.freeze({ path: '/about', linkName: 'About', headingText: 'About' }),
      Object.freeze({ path: '/terms', linkName: 'Terms', headingText: 'Terms' }),
      Object.freeze({ path: '/privacy', linkName: 'Privacy', headingText: 'Privacy' }),
      Object.freeze({ path: '/contact', linkName: 'Contact', headingText: 'Contact' })
    ])
  });
}

/**
 * Read a manifest entry's own stranger expectations, falling back to the
 * placeholder defaults.
 *
 * Same defect as `url` one field over, and with the same consequence. Every
 * managed app was handed `managedStrangerDefaults`, so F1 played a stranger who
 * expected a page titled exactly "About", searched for the word "test", and had
 * been told the app's purpose was "not yet product-judged". `user_refuse.mjs`
 * matches headings with `exact: true`, so a perfectly good "About Sushi Finder"
 * could never match, and a sushi catalogue can never answer "test". Measured
 * 2026-08-12 against the deployed sushi-finder: F1 returned `refuse` citing a
 * missing brand mark, an undiscoverable search and three missing legal headings,
 * while a screenshot of that same page shows a logo, a labelled search box and
 * "About Sushi Finder" rendering fine. The verdict described the fixture, not
 * the app.
 *
 * A partial override is honoured field by field, so an app can name its real
 * headings without also having to restate a search query.
 *
 * @param {Record<string, unknown>} entry Manifest entry.
 * @param {string} slug App slug.
 * @returns {StrangerExpectations}
 */
function managedStranger(entry, slug) {
  const defaults = managedStrangerDefaults(slug);
  const raw = entry.stranger;
  if (raw === null || typeof raw !== 'object') return defaults;
  const s = /** @type {Record<string, unknown>} */ (raw);

  const pages = Array.isArray(s.requiredPages)
    ? s.requiredPages.filter(
        (p) =>
          p !== null &&
          typeof p === 'object' &&
          typeof (/** @type {{path?: unknown}} */ (p).path) === 'string' &&
          typeof (/** @type {{linkName?: unknown}} */ (p).linkName) === 'string' &&
          typeof (/** @type {{headingText?: unknown}} */ (p).headingText) === 'string'
      )
    : null;

  return Object.freeze({
    purposeSentence:
      typeof s.purposeSentence === 'string' && s.purposeSentence.trim().length > 0
        ? s.purposeSentence
        : defaults.purposeSentence,
    searchQuery:
      typeof s.searchQuery === 'string' && s.searchQuery.trim().length > 0
        ? s.searchQuery
        : defaults.searchQuery,
    requiredPages:
      pages !== null && pages.length > 0
        ? Object.freeze(pages.map((p) => Object.freeze({ ...p })))
        : defaults.requiredPages
  });
}

/**
 * Load scaffolded apps from `.redanvil/managed-apps.json` under the monorepo root.
 *
 * @param {string} [repoRoot=process.cwd()] Repository root.
 * @returns {GatedApp[]}
 */
export function loadManagedApps(repoRoot = process.cwd()) {
  const path = join(repoRoot, '.redanvil', 'managed-apps.json');
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (raw?.kind !== 'managed-apps' || !Array.isArray(raw.apps)) return [];
    /** @type {GatedApp[]} */
    const out = [];
    for (const entry of raw.apps) {
      if (!entry || typeof entry.slug !== 'string' || typeof entry.dir !== 'string') {
        continue;
      }
      // Skip if already a core app (core wins).
      if (CORE_APPS.some((a) => a.slug === entry.slug)) continue;
      out.push({
        slug: entry.slug,
        dir: entry.dir,
        // Was hardcoded to ''. Every managed app was therefore born ungateable:
        // no URL means no visual check, no runtime probe, no deploy
        // verification, and reverify reporting "Served: (none) x250" against a
        // production site that was serving correctly. The registry entry is the
        // only place that knows where a scaffolded app lives, so read it.
        url: typeof entry.url === 'string' ? entry.url : '',
        designRoutes: '/about,/contact,/terms,/privacy,/no-such-page',
        widthRoutes: null,
        e2e: false,
        wizard: false,
        coreFlow: 'search',
        na: 'process',
        stranger: managedStranger(entry, entry.slug)
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * All gated apps: core production list plus managed scaffolds.
 *
 * @param {string} [repoRoot=process.cwd()] Repository root.
 * @returns {readonly GatedApp[]}
 */
export function getApps(repoRoot = process.cwd()) {
  const managed = loadManagedApps(repoRoot);
  if (managed.length === 0) return CORE_APPS;
  return Object.freeze([...CORE_APPS, ...managed]);
}

/**
 * Default export used by meets_the_bar / reverify / pre-push.
 * Includes managed apps from cwd so a scaffolded app is visible immediately.
 *
 * @type {readonly GatedApp[]}
 */
export const APPS = getApps();

/**
 * Look up a gated app by slug.
 *
 * @param {string} slug App slug.
 * @param {string} [repoRoot] Optional repo root for a fresh managed-apps read.
 * @returns {GatedApp | undefined}
 */
export function appBySlug(slug, repoRoot) {
  const list = repoRoot === undefined ? APPS : getApps(repoRoot);
  return list.find((a) => a.slug === slug);
}

/**
 * Resolve the primary product flow for a gated app.
 * Defaults to `search` only when the app is known and coreFlow is missing
 * (legacy); unknown slugs throw so harnesses never invent a flow.
 *
 * @param {string} slug App slug.
 * @returns {CoreFlow}
 */
export function coreFlowForSlug(slug) {
  const app = appBySlug(slug);
  if (app === undefined) {
    throw new Error(
      `unknown app slug "${slug}" -- known: ${APPS.map((a) => a.slug).join(', ')}`
    );
  }
  if (app.coreFlow === 'wizard' || app.coreFlow === 'search') {
    return app.coreFlow;
  }
  // Fail closed for a declared app that forgot coreFlow: wizard flag is the
  // historical signal; otherwise search (prior default for every gated app).
  return app.wizard === true ? 'wizard' : 'search';
}
