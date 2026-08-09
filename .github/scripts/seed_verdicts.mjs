#!/usr/bin/env node
/**
 * Seed a first-run app's verdict list FROM its measured design report.
 *
 * reverify re-derives existing verdicts from evidence but never creates any, so
 * a brand-new app had no verdicts file, an empty one failed the schema (min 1),
 * and the only remaining route was hand-authoring outcomes -- which is exactly
 * the fabrication this whole system exists to prevent.
 *
 * Every verdict written here cites the machine report that decided it and copies
 * that report's own outcome, pass or fail. Nothing is invented, and a failing
 * measurement seeds a FAILING verdict.
 *
 * Usage: node seed_verdicts.mjs <slug>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: node seed_verdicts.mjs <slug>');
  process.exit(2);
}

const reportPath = `evidence/design-${slug}.json`;
const verdictsPath = `evidence/verdicts-${slug}.json`;

if (!existsSync(reportPath)) {
  console.error(`no measured report at ${reportPath} — run the design audit first; seeding without a measurement would be inventing results`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));

/*
  Several fail-closed visual rules are measured by their OWN report, not the
  design audit: fe-cold-visitor by cold-<slug>.json, fe-desktop-width by
  width-<slug>.json. Seeding only from the design report left the gate refusing
  the push for rules that HAD been measured, just somewhere else.
*/
// Track WHICH report decided each rule. Attaching all three to every verdict
// made fe-desktop-width cite the cold-visitor report, and the schema rightly
// refused: "evidence/cold-sushi-finder.json is not a desktop_width report".
// Evidence has to point at the measurement that actually decided the rule.
const findings = { ...(report.findings ?? {}) };
/** @type {Record<string,string>} */
const source = {};
for (const k of Object.keys(findings)) source[k] = reportPath;

const cold = `evidence/cold-${slug}.json`;
if (existsSync(cold)) {
  const c = JSON.parse(readFileSync(cold, 'utf8'));
  for (const [k, v] of Object.entries(c.findings ?? {})) {
    if (!findings[k]) {
      findings[k] = v;
      source[k] = cold;
    }
  }
}

const width = `evidence/width-${slug}.json`;
if (existsSync(width)) {
  const w = JSON.parse(readFileSync(width, 'utf8'));
  findings['fe-desktop-width'] = {
    ok: w.ok === true,
    detail: `painted content >= ${w.minPct}% at ${(w.widths ?? []).join('/')}`
  };
  source['fe-desktop-width'] = width;
}
const ruleIds = Object.keys(findings);
if (ruleIds.length === 0) {
  console.error(`${reportPath} recorded no findings — nothing measured, so nothing to seed`);
  process.exit(1);
}

/**
 * Rules whose method is `visual` in the rubric -- the only ones a verdict may
 * supply. A `det` rule is decided by its own check, and the schema rejects any
 * verdict claiming to answer one. Seeding those turned a legitimate list into an
 * invalid one: "fe-light-dark: method 'det' is decided by a check".
 */
const VISUAL_RULES = new Set([
  'fe-a11y-contrast',
  'fe-premium-nav',
  'fe-required-pages',
  'fe-no-attribution',
  'fe-responsive-375',
  'fe-product-completeness',
  'fe-visual-review-recorded',
  'fe-design-archetype',
  'fe-cold-visitor',
  'fe-seo-og',
  // The gate names these in its refusal as "fail-closed visual rule <id> has no
  // recorded verdict", so it demands a verdict for each. My first list was
  // derived from a regex over the rubric that missed them, and the push was
  // refused for rules the design report had already measured.
  'fe-touch-targets',
  'fe-type-floor',
  'fe-noncolor-state',
  'fe-safe-areas',
  'fe-cross-link',
  'fe-desktop-width'
]);

const existing = existsSync(verdictsPath) ? JSON.parse(readFileSync(verdictsPath, 'utf8')) : [];
const known = new Set(existing.map((v) => v.ruleId));
const now = new Date().toISOString();

let added = 0;
for (const ruleId of ruleIds) {
  if (known.has(ruleId)) continue;
  // det rules are decided by their check; a verdict may not answer one.
  if (!VISUAL_RULES.has(ruleId)) continue;
  const f = findings[ruleId];
  existing.push({
    ruleId,
    passed: f.ok === true,
    method: 'visual',
    evidence: [source[ruleId] ?? reportPath],
    note: String(f.detail ?? '').slice(0, 300),
    reviewedAt: now,
    reviewedCommit: 'unstamped'
  });
  added += 1;
}

writeFileSync(verdictsPath, `${JSON.stringify(existing, null, 2)}\n`);
const failing = existing.filter((v) => !v.passed).map((v) => v.ruleId);
console.log(
  `seeded ${added} verdict(s) into ${verdictsPath} from ${reportPath} (${existing.length} total)` +
    (failing.length ? ` — FAILING: ${failing.join(', ')}` : ' — all measured rules passed')
);
