import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * A waiver that can be checked, and how to tell whether it is honest.
 *
 * `--na` decides the denominator, which makes it the widest lever on the score.
 * Only the `ci` lane was ever checked against reality; `process` and every
 * individual rule id could be waived with nothing looking. A waiver is a claim
 * that a rule's subject does not exist here, and a claim that can be checked
 * should be.
 */
interface WaiverCheck {
  /** Lane name or rule id the operator may pass to `--na`. */
  id: string;
  /** True when the subject DOES exist, which makes the waiver false. */
  applies: (dir: string) => boolean;
  /** Explanation printed when the waiver is rejected. */
  reason: string;
}

/** Recursively collect files with the given extensions, skipping heavy dirs. */
function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const p = join(dir, name);
    try {
      if (statSync(p).isDirectory()) walk(p, exts, out);
      else if (exts.includes(extname(name))) out.push(p);
    } catch {
      continue;
    }
  }
  return out;
}

/** Read a file, returning '' when unreadable. */
function read(file: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** Concatenated source of the app's Pages Functions. */
function functionSource(dir: string): string {
  return walk(join(dir, 'functions'), ['.ts', '.js'])
    .filter((f) => !/\.(test|spec)\./.test(f))
    .map(read)
    .join('\n');
}

/** Contents of the app's wrangler config, or '' when it has none. */
function wrangler(dir: string): string {
  return read(join(dir, 'wrangler.toml'));
}

const CHECKS: WaiverCheck[] = [
  {
    id: 'ci',
    applies: (dir) => existsSync(join(dir, '.github', 'workflows')),
    reason: 'it has .github/workflows, so the ci lane applies'
  },
  {
    id: 'u-plat-migrations',
    applies: (dir) => /\[\[d1_databases\]\]/.test(wrangler(dir)),
    reason: 'wrangler.toml declares a D1 binding, so the schema must be reproducible'
  },
  {
    id: 'u-plat-runtime-parity',
    applies: (dir) => existsSync(join(dir, 'wrangler.toml')),
    reason: 'it has a wrangler.toml, so it can and must be booted on the real runtime'
  },
  {
    id: 'u-sec-timeouts',
    applies: (dir) => /\bfetch\s*\(/.test(functionSource(dir)),
    reason: 'a function makes an outbound fetch, so it needs an explicit timeout'
  },
  {
    id: 'u-val-input-validation',
    applies: (dir) => /await\s+[\w.]*\.json\(\)|request\.json\(\)/.test(functionSource(dir)),
    reason: 'a handler reads a request body, so it must be validated at the boundary'
  },
  {
    id: 'fe-seo-assets',
    applies: (dir) => existsSync(join(dir, 'public')),
    reason: 'it ships a public/ directory, so its SEO assets are checkable'
  }
];

/**
 * Reject any waiver whose subject demonstrably exists in `dir`.
 *
 * Waivers with no decidable subject (for example the `process` lane, which is
 * about how a change was made rather than what the app contains) are left alone
 * deliberately: inventing a check for them would be worse than leaving them
 * honest-by-convention.
 *
 * @param dir - App directory being gated.
 * @param notApplicable - Lane names and rule ids passed to `--na`.
 * @throws When a waiver contradicts what is on disk. Reports ALL of them.
 */
export function assertWaiversAreReal(dir: string, notApplicable: string[]): void {
  const waived = new Set(notApplicable);
  const bad = CHECKS.filter((c) => waived.has(c.id) && c.applies(dir)).map(
    (c) => `  --na ${c.id}: ${c.reason}`
  );
  if (bad.length === 0) return;
  throw new Error(
    `gate: refusing ${bad.length} waiver(s) for ${dir} that contradict what is on disk:\n` +
      bad.join('\n')
  );
}
