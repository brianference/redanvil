import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The generalized feature audit shipped into every generated app.
 *
 * Kept as a real `.mjs` file on disk rather than a string in a template: it is
 * ~300 lines of executable JavaScript, and a script that only exists as an
 * escaped string cannot be read, linted, or run in place. `scaffoldApp` copies
 * it verbatim, the same way it copies the design-system guidance the rule pack
 * cites.
 */
const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), 'assets');

/** Paths of the routes the shell ships, mirroring `src/lib/routes.ts`. */
const SHELL_ROUTES = ['/', '/about', '/terms', '/privacy', '/contact'] as const;

/**
 * Source of the control audit script, read from the scaffold asset.
 *
 * @returns Contents of the app's `scripts/feature-audit.mjs`.
 */
export function featureAuditScript(): string {
  return readFileSync(join(ASSET_DIR, 'feature-audit.mjs'), 'utf8');
}

/**
 * The starter control manifest.
 *
 * Every entry describes a control the scaffold REALLY renders and names the
 * starter acceptance test that operates it. A manifest listing controls the app
 * does not render, or tests that do not exist, would be a coverage claim with
 * nothing behind it — which is the exact failure the audit exists to catch, one
 * file over.
 *
 * The builder extends this as it adds controls; the audit fails until it does.
 *
 * @returns Contents of the app's `tests/features.manifest.json`.
 */
export function featureManifestJson(): string {
  const routes = [...SHELL_ROUTES];
  const manifest = {
    _why:
      'Every interactive control on the site and the test that proves it works. ' +
      'scripts/feature-audit.mjs crawls the RUNNING app and fails when a control is ' +
      'not listed here, so a new control is untested-by-default instead of silently ' +
      'unverified. The test field must name a test that OPERATES the control and ' +
      'asserts what it changed -- a visibility assertion is a claim with no evidence ' +
      'behind it. Keep it in sync with the real test title; the gate resolves every ' +
      'claim against the spec files.',
    controls: [
      {
        role: 'button',
        name: 'theme-toggle',
        routes,
        test: 'acceptance.spec.ts > the theme toggle flips the theme and the choice survives a reload'
      },
      {
        role: 'link',
        name: 'nav-link',
        routes,
        test: 'acceptance.spec.ts > primary navigation reaches the required pages'
      },
      {
        role: 'link',
        name: 'brand',
        routes,
        test: 'acceptance.spec.ts > the brand link returns to the home page'
      }
    ]
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * Source of the cold-start check, read from the scaffold asset.
 *
 * Every other check a generated app ships sets up the state it then measures --
 * the acceptance suite seeds a route, the control audit crawls a page that is
 * already populated. None of them observe what a first-time visitor gets, which
 * is how an app shipped a default theme that ignored the operating system and a
 * search that answered an empty list for anything unseeded.
 *
 * @returns Contents of the app's `scripts/cold-visitor.mjs`.
 */
export function coldVisitorScript(): string {
  return readFileSync(join(ASSET_DIR, 'cold-visitor.mjs'), 'utf8');
}
