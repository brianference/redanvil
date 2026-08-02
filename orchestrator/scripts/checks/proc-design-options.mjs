#!/usr/bin/env node
/**
 * proc-design-options — the chosen design was picked from three distinct options.
 *
 * Usage: node proc-design-options.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = n/a (no frontend surface).
 *
 * §7.3a called the three-option design step "not optional". It lived only as
 * prose, so a single mockup shipped with no record of alternatives.
 *
 * Requires:
 *   - design-refs/design-options/ with ≥ 3 option artifacts (HTML or image)
 *   - design-refs/design-options/DECISION.md (or design-refs/DECISION.md)
 *     naming which was chosen, why, and how the three differ structurally
 *   - no unwritten markers (TBD, Fill this in, TODO) in DECISION.md
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Minimum distinct option artifacts required. */
export const MIN_OPTIONS = 3;

/** Extensions that count as option artifacts. */
const OPTION_EXT = new Set([
  '.html',
  '.htm',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.pdf'
]);

/** Scaffold / unwritten markers that mean the decision was never finished. */
export const UNWRITTEN_MARKERS = [
  /\bTBD\b/i,
  /Fill this in/i,
  /\bTODO\b/i,
  /\[UNWRITTEN/i,
  /THIS DOCUMENT HAS NOT BEEN WRITTEN/i
];

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never
 * }} DesignOptionsIo
 */

/**
 * Whether the app has a frontend surface worth requiring design options for.
 *
 * @param {string} appDir App root.
 * @returns {boolean}
 */
function hasFrontendSurface(appDir) {
  for (const name of ['src', 'public', 'index.html', 'package.json']) {
    if (existsSync(join(appDir, name))) return true;
  }
  return false;
}

/**
 * Resolve the design-options directory (standard or nested layout).
 *
 * @param {string} appDir App root.
 * @returns {string | null}
 */
export function resolveOptionsDir(appDir) {
  const candidates = [
    join(appDir, 'design-refs', 'design-options'),
    join(appDir, 'design-refs', 'options')
  ];
  for (const p of candidates) {
    if (existsSync(p) && statSync(p).isDirectory()) return p;
  }
  // An app legitimately has options for more than one surface, and names the
  // directory after what they are options FOR -- `home-options`, `examples-options`.
  // Hardcoding one name failed an app that had done the §7.3a step properly,
  // which is a false negative: it teaches people the rule is broken rather than
  // that the work is missing. Accept any design-refs/*options* directory; the
  // bar (>= 3 artifacts and a written DECISION.md) is unchanged.
  const refs = join(appDir, 'design-refs');
  if (!existsSync(refs) || !statSync(refs).isDirectory()) return null;
  const named = readdirSync(refs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /options/i.test(e.name))
    .map((e) => join(refs, e.name))
    .sort();
  return named[0] ?? null;
}

/**
 * Resolve DECISION.md next to options or under design-refs/.
 *
 * @param {string} appDir App root.
 * @param {string | null} optionsDir Options directory when present.
 * @returns {string | null}
 */
export function resolveDecisionPath(appDir, optionsDir) {
  const candidates = [
    optionsDir ? join(optionsDir, 'DECISION.md') : null,
    join(appDir, 'design-refs', 'DECISION.md'),
    join(appDir, 'design-refs', 'design-options', 'DECISION.md')
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(/** @type {string} */ (p))) return /** @type {string} */ (p);
  }
  return null;
}

/**
 * List option artifact files under a directory (non-recursive file names only,
 * plus one level of subdirs that hold a primary artifact).
 *
 * @param {string} optionsDir Absolute path.
 * @returns {string[]} Relative names of option artifacts.
 */
export function listOptionArtifacts(optionsDir) {
  /** @type {string[]} */
  const out = [];
  if (!existsSync(optionsDir)) return out;
  for (const name of readdirSync(optionsDir)) {
    if (name.startsWith('.') || /^DECISION\.md$/i.test(name) || /^README/i.test(name)) {
      continue;
    }
    const full = join(optionsDir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isFile()) {
      if (OPTION_EXT.has(extname(name).toLowerCase())) out.push(name);
      continue;
    }
    if (st.isDirectory()) {
      // A folder per option (option-a/index.html) counts as one artifact.
      try {
        const kids = readdirSync(full);
        const hit = kids.find((k) => OPTION_EXT.has(extname(k).toLowerCase()));
        if (hit) out.push(`${name}/${hit}`);
      } catch {
        // skip
      }
    }
  }
  return out;
}

/**
 * Detect the first unwritten marker in DECISION.md.
 *
 * @param {string} doc Document text.
 * @returns {string | null}
 */
export function findUnwrittenMarker(doc) {
  for (const re of UNWRITTEN_MARKERS) {
    if (re.test(doc)) return re.source.slice(0, 40);
  }
  return null;
}

/**
 * Whether DECISION.md names a chosen option and a structural distinctness line.
 *
 * @param {string} doc Document text.
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function evaluateDecisionDoc(doc) {
  /** @type {string[]} */
  const failures = [];
  const trimmed = doc.trim();
  if (trimmed.length < 40) {
    failures.push('DECISION.md is empty or near-empty — not a completed design decision');
    return { ok: false, failures };
  }
  const marker = findUnwrittenMarker(trimmed);
  if (marker) {
    failures.push(
      `DECISION.md still contains an unwritten marker (/${marker}/) — complete the decision before shipping`
    );
  }
  // Must name a choice: chosen / selected / picked / we chose / option A|B|C.
  const namesChoice =
    /\b(chosen|selected|picked|we chose|chose option|choice\s*:|selected option)\b/i.test(
      trimmed
    ) || /\boption\s*[ABC1-3]\b/i.test(trimmed);
  if (!namesChoice) {
    failures.push(
      'DECISION.md must name which option was chosen (e.g. "Chosen: option B" or "we selected …")'
    );
  }
  // Must state why (because / reason / why / trade-off).
  const hasWhy =
    /\b(because|reason|why|trade-?off|prefer|better for|wins on)\b/i.test(trimmed);
  if (!hasWhy) {
    failures.push('DECISION.md must state why the option was chosen');
  }
  // Structural distinctness: one line about structure/layout/architecture.
  const hasStructure =
    /\b(structur|layout|architecture|component skeleton|tile grid|timeline|hero card|data table|split|sidebar|tab bar|bottom nav|chronicle)\b/i.test(
      trimmed
    );
  if (!hasStructure) {
    failures.push(
      'DECISION.md must state in one line how the three options differ structurally ' +
        '(layout architecture, not only colours) — a reviewer can challenge it'
    );
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Evaluate design-options evidence without exiting.
 *
 * @param {string} appDir App root.
 * @returns {{ status: 'pass'|'fail'|'na', messages: string[], artifacts?: string[] }}
 */
export function evaluateDesignOptions(appDir) {
  if (!hasFrontendSurface(appDir)) {
    return { status: 'na', messages: ['no frontend surface'] };
  }
  const optionsDir = resolveOptionsDir(appDir);
  if (!optionsDir) {
    return {
      status: 'fail',
      messages: [
        'missing design-refs/design-options/ — §7.3a requires at least three distinct design options before shipping'
      ]
    };
  }
  const artifacts = listOptionArtifacts(optionsDir);
  /** @type {string[]} */
  const messages = [];
  if (artifacts.length < MIN_OPTIONS) {
    messages.push(
      `design-refs/design-options/ has ${artifacts.length} option artifact(s); need ≥ ${MIN_OPTIONS} ` +
        `(HTML or image). Found: ${artifacts.length === 0 ? '(none)' : artifacts.join(', ')}`
    );
  }
  const decisionPath = resolveDecisionPath(appDir, optionsDir);
  if (!decisionPath) {
    messages.push(
      'missing DECISION.md (expected under design-refs/design-options/ or design-refs/) — ' +
        'name which option was chosen and why'
    );
  } else {
    const doc = readFileSync(decisionPath, 'utf8');
    const evalDoc = evaluateDecisionDoc(doc);
    messages.push(...evalDoc.failures);
  }
  if (messages.length > 0) {
    return { status: 'fail', messages, artifacts };
  }
  return {
    status: 'pass',
    messages: [
      `${artifacts.length} option artifacts and DECISION.md present with choice, why, and structural distinctness`
    ],
    artifacts
  };
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {DesignOptionsIo} io Exit helpers.
 */
export function runDesignOptions(appDir, io) {
  const result = evaluateDesignOptions(appDir);
  if (result.status === 'na') {
    io.notApplicable(result.messages[0] ?? 'not applicable');
  }
  if (result.status === 'fail') {
    io.fail(result.messages.join('\n'));
  }
  console.log(`proc-design-options PASS: ${result.messages[0]}`);
  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node proc-design-options.mjs <appDir>');
    process.exit(2);
  }
  runDesignOptions(dir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  });
}
