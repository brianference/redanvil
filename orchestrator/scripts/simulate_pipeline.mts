/**
 * End-to-end pipeline simulation: user idea -> PRD -> job -> scaffold -> gate checks.
 *
 * Every number this prints is measured from a real run of the real code. Nothing is
 * asserted or seeded. A stage that throws is recorded as a failure with its message
 * rather than being skipped, because a simulation that hides its own breakage is
 * worse than no simulation.
 *
 * Usage: npx tsx orchestrator/scripts/simulate_pipeline.mts [--keep]
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { generatePrd, evaluatePrdSelfCheck } from '../../app-builder/src/lib/prd';
import { withWizardDefaults, buildJob, type WizardAnswers } from '../../app-builder/src/lib/job';
import { scaffoldFromJobFile } from '../src/commands/scaffold';
import { JobSchema } from '../src/schemas/job';
import { RULES } from '../src/rubric/rules';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES_DIR = join(REPO, 'rules');
const KEEP = process.argv.includes('--keep');

/** Ten distinct product ideas, spanning the app types and scope shapes the wizard offers. */
const IDEAS: Array<Partial<WizardAnswers> & { label: string }> = [
  {
    label: 'field-service-offline',
    prompt: 'a field service app where techs log jobs offline and sync when back online',
    appType: 'Mobile app',
    hasAuth: true,
    entities: 'Job, Tech'
  },
  {
    label: 'dog-care-reminders',
    prompt: 'an app to remind you when your dog needs grooming, vet visits, ear cleaning',
    appType: 'Mobile app',
    hasAuth: false,
    entities: 'Reminder, Pet'
  },
  {
    label: 'b2b-invoice-tracker',
    prompt: 'a B2B invoice tracker with payment status, dunning reminders, and CSV export',
    appType: 'Dashboard',
    hasAuth: true,
    entities: 'Invoice, Client, Payment'
  },
  {
    label: 'parent-coach',
    prompt: 'a parent coach app with daily prompts and shared family goals',
    appType: 'Mobile app',
    hasAuth: true,
    entities: 'Goal, Prompt, Family'
  },
  {
    label: 'trail-conditions',
    prompt: 'a hiking trail conditions app where users post recent trail reports with photos',
    appType: 'Mobile app',
    hasAuth: true,
    entities: 'Trail, Report'
  },
  {
    label: 'inventory-scanner',
    prompt: 'a small warehouse inventory app with barcode scanning and low stock alerts',
    appType: 'Mobile app',
    hasAuth: true,
    entities: 'Item, Location, Alert'
  },
  {
    label: 'reading-log',
    prompt: 'a reading log where I track books, sessions, and notes per chapter',
    appType: 'Mobile app',
    hasAuth: false,
    entities: 'Book, Session'
  },
  {
    label: 'clinic-scheduling',
    prompt: 'a small clinic appointment scheduler with reminders and a waitlist',
    appType: 'Dashboard',
    hasAuth: true,
    entities: 'Appointment, Patient, Waitlist'
  },
  {
    label: 'landing-waitlist',
    prompt: 'a marketing landing page with an email waitlist and launch countdown',
    appType: 'Landing page',
    hasAuth: false,
    entities: 'Signup'
  },
  {
    label: 'expense-splitter',
    prompt: 'an app for splitting shared house expenses and settling up monthly',
    appType: 'Mobile app',
    hasAuth: true,
    entities: 'Expense, Member, Settlement'
  }
];

interface StageResult {
  ok: boolean;
  detail: string;
}
interface RunRecord {
  label: string;
  prd: StageResult & { chars: number; sections: number; selfCheck: string; slices: number };
  job: StageResult & { slug: string };
  scaffold: StageResult & { files: number };
  checks: StageResult & { passed: number; failed: number; na: number; failedIds: string[] };
}

/** Count files recursively, so scaffold output size is measured not assumed. */
function countFiles(dir: string): number {
  let n = 0;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) n += countFiles(p);
    else n++;
  }
  return n;
}

/** Run every deterministic check against a scaffolded app and tally real exit codes. */
function runChecks(appDir: string): RunRecord['checks'] {
  // The rubric is the contract for which rules are machine-checkable, so it drives
  // the sweep rather than a list hard-coded here that could drift from it.
  const ids = RULES.filter((r) => r.method === 'det' || r.method === 'det+judge').map((r) => r.id);
  if (ids.length === 0) {
    return { ok: false, detail: 'rubric exposed no det rules', passed: 0, failed: 0, na: 0, failedIds: [] };
  }
  let passed = 0,
    failed = 0,
    na = 0;
  const failedIds: string[] = [];
  for (const id of ids) {
    const r = spawnSync('node', [join(REPO, 'orchestrator/scripts/checks/check.mjs'), id, appDir], {
      encoding: 'utf8',
      shell: process.platform === 'win32'
    });
    if (r.status === 0) passed++;
    else if (r.status === 3) na++;
    else {
      failed++;
      failedIds.push(id);
    }
  }
  return { ok: failed === 0, detail: `${passed} pass / ${failed} fail / ${na} n-a`, passed, failed, na, failedIds };
}

const root = mkdtempSync(join(tmpdir(), 'redanvil-sim-'));
const records: RunRecord[] = [];

for (const idea of IDEAS) {
  const { label, ...partial } = idea;
  const rec: Partial<RunRecord> = { label };

  // Stage 1 — PRD
  let markdown = '';
  try {
    const answers = withWizardDefaults(partial);
    const out = generatePrd(answers, { iterations: 2, tokens: 400000, confidence: 'low' });
    markdown = out.markdown;
    const sc = evaluatePrdSelfCheck(markdown, {
      entities: (partial.entities ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      hasDomainTables: true
    });
    rec.prd = {
      ok: sc.items.every((i) => i.pass),
      detail: sc.items.filter((i) => !i.pass).map((i) => i.id).join(',') || 'all self-checks pass',
      chars: markdown.length,
      sections: (markdown.match(/^## /gm) ?? []).length,
      selfCheck: `${sc.items.filter((i) => i.pass).length}/${sc.items.length}`,
      slices: (markdown.match(/^### Slice \d+/gm) ?? []).length
    };
  } catch (e) {
    rec.prd = { ok: false, detail: `THREW: ${(e as Error).message}`, chars: 0, sections: 0, selfCheck: '0/0', slices: 0 };
  }

  // Stage 2 — job (must satisfy the real schema)
  const appDir = join(root, label);
  let jobPath = '';
  try {
    const answers = withWizardDefaults(partial);
    const job = buildJob(answers, new Date('2026-07-23T00:00:00.000Z'));
    const parsed = JobSchema.safeParse(job);
    mkdirSync(appDir, { recursive: true });
    jobPath = join(root, `${label}.job.json`);
    writeFileSync(jobPath, JSON.stringify(job, null, 2));
    rec.job = {
      ok: parsed.success,
      detail: parsed.success ? 'schema valid' : JSON.stringify(parsed.error.issues.slice(0, 2)),
      slug: (job as { slug?: string }).slug ?? '(none)'
    };
  } catch (e) {
    rec.job = { ok: false, detail: `THREW: ${(e as Error).message}`, slug: '(none)' };
  }

  // Stage 3 — scaffold
  try {
    const r = await scaffoldFromJobFile(jobPath, appDir, RULES_DIR, '2026-07-23T00:00:00.000Z');
    rec.scaffold = r.ok
      ? { ok: true, detail: `${r.files} files`, files: r.files }
      : { ok: false, detail: r.issues.slice(0, 3).join('; '), files: 0 };
  } catch (e) {
    rec.scaffold = { ok: false, detail: `THREW: ${(e as Error).message}`, files: 0 };
  }

  // Stage 4 — deterministic checks against the scaffold
  try {
    rec.checks = countFiles(appDir) > 0
      ? runChecks(appDir)
      : { ok: false, detail: 'nothing scaffolded to check', passed: 0, failed: 0, na: 0, failedIds: [] };
  } catch (e) {
    rec.checks = { ok: false, detail: `THREW: ${(e as Error).message}`, passed: 0, failed: 0, na: 0, failedIds: [] };
  }

  records.push(rec as RunRecord);
  const r = rec as RunRecord;
  console.log(
    `${label.padEnd(24)} prd:${r.prd.selfCheck.padEnd(6)} ${String(r.prd.chars).padStart(6)}ch  ` +
      `slices:${String(r.prd.slices).padStart(2)}  job:${r.job.ok ? 'ok ' : 'ERR'}  ` +
      `scaffold:${String(r.scaffold.files).padStart(3)}f  checks:${r.checks.detail}`
  );
}

console.log('\n=== aggregate (measured) ===');
const n = records.length;
console.log('runs                :', n);
console.log('PRD self-check clean:', records.filter((r) => r.prd.ok).length, '/', n);
console.log('job schema valid    :', records.filter((r) => r.job.ok).length, '/', n);
console.log('scaffold ok         :', records.filter((r) => r.scaffold.ok).length, '/', n);
console.log('checks all-pass     :', records.filter((r) => r.checks.ok).length, '/', n);
const allFailed = records.flatMap((r) => r.checks.failedIds);
const tally = new Map<string, number>();
for (const id of allFailed) tally.set(id, (tally.get(id) ?? 0) + 1);
console.log('\nmost common failing checks across runs:');
[...tally.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([id, c]) => console.log(`  ${String(c).padStart(2)}/${n}  ${id}`));

const outPath = join(REPO, 'evidence', 'simulation-runs.json');
writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2) + '\n');
console.log('\nwrote', outPath);
if (!KEEP) rmSync(root, { recursive: true, force: true });
else console.log('kept scaffolds at', root);
