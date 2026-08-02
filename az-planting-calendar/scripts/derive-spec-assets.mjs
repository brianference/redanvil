/**
 * Spec asset derivation — delegates to derive-brand-assets.mjs.
 * Kept so older docs that call this path still produce correct assets.
 *
 * Run: node scripts/derive-spec-assets.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [join(root, 'scripts/derive-brand-assets.mjs')], {
  cwd: root,
  stdio: 'inherit'
});
process.exit(result.status ?? 1);
