import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The twelve shell units moved into `design-system/` in v11, plus the two
 * modules those units import (`theme.ts` for `mountApp`, `useDrawerA11y`
 * for `Page`). A generated app that only received the markdown never had
 * a header, a breadcrumb trail, or a footer it could render.
 */
const SHELL_UNITS = [
  'Breadcrumbs.tsx',
  'Footer.tsx',
  'Header.tsx',
  'Logo.tsx',
  'MobileDrawer.tsx',
  'mountApp.tsx',
  'NavLink.tsx',
  'Page.tsx',
  'shellChromeCss.ts',
  'shellCss.ts',
  'shellStyles.ts',
  'ThemeToggle.tsx',
  'theme.ts',
  'hooks/useDrawerA11y.ts'
] as const;

/**
 * Let a nav item carry the acceptance-suite id.
 *
 * The shared `NavLink` has no test id. The scaffold's acceptance spec clicks
 * `getByTestId('nav-link')`, and the drawer renders the same component. The
 * id is optional so the header can set it and the drawer can omit it —
 * otherwise one label matches two nodes and the click is ambiguous.
 *
 * @param source - Canonical `NavLink.tsx`.
 * @returns The same module, plus an optional `testId` on `NavItem`.
 * @throws {Error} When the canonical file no longer matches the patch points.
 */
function patchNavLink(source: string): string {
  const withField = source.replace(
    '  /** Open in a new tab (external only). */\n  external?: boolean;\n}',
    '  /** Open in a new tab (external only). */\n  external?: boolean;\n  /**\n   * Acceptance-suite id. Header items set `nav-link`; drawer copies omit it\n   * so the same label is not two nodes.\n   */\n  testId?: string;\n}'
  );
  const withLink = withField.replace(
    '<Link\n        to={item.to}\n        className={className}',
    '<Link\n        to={item.to}\n        data-testid={item.testId}\n        className={className}'
  );
  const patched = withLink.replace(
    '<a\n      href={item.href}\n      className={className}',
    '<a\n      href={item.href}\n      data-testid={item.testId}\n      className={className}'
  );
  if (
    patched === source ||
    !patched.includes('testId?: string') ||
    !patched.includes('data-testid={item.testId}')
  ) {
    throw new Error('design-system/NavLink.tsx no longer matches the scaffold test-id patch');
  }
  return patched;
}

/**
 * Read the shared shell into the shape `scaffoldApp` writes.
 *
 * Paths stay `design-system/...` so the units' relative imports
 * (`./NavLink`, `./hooks/useDrawerA11y`, `./theme`) keep working. They are
 * not placed under `src/`, which is what `fe-no-inline-width` scans: the
 * shell's `maxWidth` values are token references, and a second copy under
 * `src/` would be the duplication the extraction exists to stop.
 *
 * @param designSystemDir - Absolute path to the repo `design-system/` directory.
 * @returns Repo-relative path → file contents, for the generated app.
 */
export async function sharedShellFiles(designSystemDir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const rel of SHELL_UNITS) {
    let text = (await readFile(join(designSystemDir, rel), 'utf8')).replace(/\r\n/g, '\n');
    if (rel === 'NavLink.tsx') text = patchNavLink(text);
    files[`design-system/${rel}`] = text;
  }
  return files;
}
