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
const findings = report.findings ?? {};
const ruleIds = Object.keys(findings);
if (ruleIds.length === 0) {
  console.error(`${reportPath} recorded no findings — nothing measured, so nothing to seed`);
  process.exit(1);
}

const existing = existsSync(verdictsPath) ? JSON.parse(readFileSync(verdictsPath, 'utf8')) : [];
const known = new Set(existing.map((v) => v.ruleId));
const now = new Date().toISOString();

let added = 0;
for (const ruleId of ruleIds) {
  if (known.has(ruleId)) continue;
  const f = findings[ruleId];
  existing.push({
    ruleId,
    passed: f.ok === true,
    method: 'visual',
    evidence: [reportPath],
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
