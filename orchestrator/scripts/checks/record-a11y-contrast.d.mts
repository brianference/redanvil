/**
 * Types for record-a11y-contrast.mjs.
 *
 * Without this, `tsc --noEmit` reports TS7016 on the test that imports the
 * module: it has no declaration, so under `noImplicitAny` the import is an
 * error rather than a silent `any`.
 */

export declare function recordA11yContrast(
  appDir: string,
  slug: string,
  opts?: { repoRoot?: string }
): { ok: true } | { ok: false; reason: string };
