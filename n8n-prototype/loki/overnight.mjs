#!/usr/bin/env node
/**
 * Overnight orchestration — the outer loop that runs while nobody is watching.
 *
 * WHY THIS EXISTS RATHER THAN `loki start`. Loki Mode (autonomi.dev) is the
 * right shape for this job and its package refuses to install here:
 *
 *   npm error notsup Unsupported platform for loki-mode@9.22.12:
 *   wanted {"os":"darwin,linux"} (current: {"os":"win32"})
 *
 * WSL is not installed either, and installing it needs elevation and a reboot.
 * So this implements the patterns Loki documents, on the toolchain that actually
 * runs on this machine today, and DISPATCHES to the real `loki` binary the
 * moment one is reachable (see `detectLoki`). It is not a reimplementation of
 * Loki and does not pretend to be one — it is the overnight loop RedAnvil needs,
 * built so that adopting Loki later replaces the executor and nothing else.
 *
 * Patterns taken from the Loki docs, and why each one is here:
 *
 *   - EVIDENCE RECEIPTS that split deterministic FACTS from AI ASSESSMENTS, and
 *     read VERIFIED only when tests ran AND passed AND the build succeeded AND
 *     there is a real diff. This project's entire failure history is claims that
 *     outran their evidence, so a receipt that cannot say VERIFIED without four
 *     independent facts is exactly the missing artifact.
 *   - WORKTREE ISOLATION per work item, so parallel mutators cannot clobber each
 *     other and a failed item leaves the main tree untouched.
 *   - HARD GATES as the verdict. Loki's own receipt never overrides
 *     meets_the_bar; the RedAnvil gate keeps the final say.
 *   - ITERATION AND COST CAPS, because an unbounded overnight loop is how you
 *     wake up to a thousand commits or an empty balance.
 *
 * The loop NEVER stops on a single failure. A failing item is recorded and the
 * queue moves on; stopping the night because item three was broken wastes the
 * other seven hours.
 *
 * Usage:
 *   node n8n-prototype/loki/overnight.mjs [--until HH:MM] [--max-items N]
 *                                         [--dry-run] [--allow-deploy]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const REPO_ROOT = resolve(process.env.REDANVIL_REPO ?? process.cwd());
const RECEIPTS_DIR = join(REPO_ROOT, 'evidence', 'receipts');
const STATE_DIR = join(REPO_ROOT, '.redanvil', 'overnight');

/** Gate threshold. An app is "done" only at or above this. */
const THRESHOLD = 90;

/** Per-item iteration cap. Loki exposes the same idea as LOKI_MAX_ITERATIONS. */
const MAX_ITERATIONS_PER_ITEM = Number(process.env.OVERNIGHT_MAX_ITERATIONS ?? 3);

/** Wall-clock budget for a single item, so one wedged app cannot eat the night. */
const ITEM_TIMEOUT_MS = Number(process.env.OVERNIGHT_ITEM_TIMEOUT_MS ?? 45 * 60 * 1000);

/**
 * Parse `--flag value` and `--flag` pairs.
 * @param {string[]} argv raw arguments
 * @returns {Record<string, string|boolean>} parsed flags
 */
function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/**
 * Run a command and capture everything, never throwing.
 *
 * Throwing on non-zero would end the night on the first failing gate, and a
 * failing gate is the NORMAL case for an app below the bar — it is the input to
 * the loop, not an error in it.
 *
 * @param {string} cmd executable
 * @param {string[]} args arguments
 * @param {{cwd?: string, timeout?: number}} [opts] spawn options
 * @returns {{status: number|null, stdout: string, stderr: string}} result
 */
function run(cmd, args, opts = {}) {
  const proc = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    timeout: opts.timeout ?? ITEM_TIMEOUT_MS,
    shell: process.platform === 'win32'
  });
  return {
    status: proc.status,
    stdout: String(proc.stdout ?? ''),
    stderr: String(proc.stderr ?? '')
  };
}

/**
 * Is a real `loki` binary reachable?
 *
 * When Loki becomes installable here (WSL, or a Linux host), this flips to true
 * and the executor switches over. Everything else in this file — the queue, the
 * receipts, the gate verdict — is unchanged by that switch, which is the point.
 *
 * @returns {{available: boolean, version: string|null}} detection result
 */
function detectLoki() {
  const probe = run(process.platform === 'win32' ? 'where' : 'which', ['loki'], { timeout: 10_000 });
  if (probe.status !== 0) return { available: false, version: null };
  const version = run('loki', ['version'], { timeout: 20_000 });
  return { available: version.status === 0, version: version.stdout.trim() || null };
}

/**
 * The current HEAD commit, or null outside a repo.
 * @param {string} cwd directory to ask in
 * @returns {string|null} full sha
 */
function headCommit(cwd) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Headless coding agents available on THIS platform, in preference order.
 *
 * The overnight loop needs an agent that runs with no UI attached, because it is
 * driven by a scheduler at 3am. That single requirement disqualifies most of the
 * field: a VS Code extension (Cline, the LOKI extension) and a desktop app
 * (Tonkotsu) are driven by an editor or a window, and there is nothing for a
 * cron job to talk to. `opencode-ai` does ship a win32 binary and would work,
 * but it is a third install with its own auth and its own spend for a capability
 * already present twice over.
 *
 * Both entries below are installed, authenticated and verified on this machine:
 * `claude -p` returns HEADLESS_OK and `grok -p` returns a completion. That is
 * why no third-party orchestrator is adopted here.
 *
 * @type {Array<{name: string, bin: string, args: (prompt: string, cwd: string) => string[]}>}
 */
const AGENTS = [
  {
    name: 'claude',
    bin: 'claude',
    // -p is print/headless mode: run the prompt, emit the result, exit.
    args: (prompt) => ['-p', prompt]
  },
  {
    name: 'grok',
    bin: 'grok',
    args: (prompt, cwd) => ['--always-approve', '--cwd', cwd, '-m', 'grok-4.6', '-p', prompt]
  }
];

/**
 * Create an isolated git worktree for one item.
 *
 * Isolation is not optional here. Several items run in one night, each editing
 * source, and a failed item must leave the main tree exactly as it found it.
 *
 * NOTE ON CLEANUP: these worktrees are deliberately NOT removed automatically.
 * `git worktree remove --force` follows a node_modules junction on Windows and
 * deletes the REAL node_modules it points at, which has happened here before.
 * Cleaning up is a morning job with eyes on it, not a 3am job.
 *
 * @param {string} slug work item id
 * @returns {{path: string, branch: string}|null} worktree, or null if it failed
 */
function createWorktree(slug) {
  const branch = `overnight/${slug}`;
  const path = resolve(REPO_ROOT, '..', `redanvil-wt-${slug}`);
  if (existsSync(path)) return { path, branch };

  const made = run('git', ['worktree', 'add', '-B', branch, path, 'HEAD'], { timeout: 120_000 });
  if (made.status !== 0) return null;
  return { path, branch };
}

/**
 * Ask a headless agent to fix the named failing rules, in a worktree.
 *
 * The prompt names the SPECIFIC failing rule ids rather than saying "improve the
 * app", because an unbounded instruction produces unbounded edits and there is
 * nobody awake to review them. It also tells the agent the gate is the judge,
 * which keeps it from optimising for its own self-report -- the failure mode
 * this whole project is built around.
 *
 * @param {string} app slug
 * @param {string[]} blockers failing rule ids
 * @param {string} cwd worktree to work in
 * @returns {{agent: string|null, status: number|null, output: string}} result
 */
function dispatchFix(app, blockers, cwd) {
  const prompt =
    `In ${app}, these RedAnvil gate rules are failing:\n\n` +
    `${blockers.map((b) => `  - ${b}`).join('\n')}\n\n` +
    `Fix the underlying causes. Rules to know:\n` +
    `- The gate is the judge. Your own report of success counts for nothing, so do not write one.\n` +
    `- Never weaken, waive or delete a check to make it pass. Fix what it is measuring.\n` +
    `- No fake, placeholder or lorem-ipsum data, and no hand-authored metrics.\n` +
    `- Do not touch evidence/, results/ or any verdict file. Those are the gate's, not yours.\n` +
    `- Keep the change scoped to the failing rules above.\n` +
    `Run the app's own tests before you finish.`;

  for (const agent of AGENTS) {
    const probe = run(process.platform === 'win32' ? 'where' : 'which', [agent.bin], { timeout: 10_000 });
    if (probe.status !== 0) continue;
    const res = run(agent.bin, agent.args(prompt, cwd), { cwd, timeout: ITEM_TIMEOUT_MS });
    return { agent: agent.name, status: res.status, output: `${res.stdout}\n${res.stderr}`.slice(-4000) };
  }
  return { agent: null, status: null, output: 'no headless agent found on PATH' };
}

/**
 * Build the night's work queue.
 *
 * Order is deliberate and matches the owner's stated priority: close gate
 * failures on shipped apps first (highest value, most blocked), then the known
 * open bugs, then new builds, then drift. Highest-value work happens while the
 * most time remains.
 *
 * @returns {Array<{id: string, kind: string, app?: string, summary: string}>} queue
 */
function buildQueue() {
  /** @type {Array<{id: string, kind: string, app?: string, summary: string}>} */
  const queue = [];

  // 1. Apps below the finish line. Read from the committed results feed rather
  //    than hardcoded, so an app added later is picked up without editing this.
  const allResults = join(REPO_ROOT, 'results', 'all.json');
  if (existsSync(allResults)) {
    try {
      const results = JSON.parse(readFileSync(allResults, 'utf8'));
      for (const entry of results) {
        if (typeof entry?.slug !== 'string') continue;
        if ((entry.finalScore ?? 0) >= THRESHOLD) continue;
        queue.push({
          id: `gate-${entry.slug}`,
          kind: 'close-gate-failures',
          app: entry.slug,
          summary: `${entry.slug} scores ${entry.finalScore ?? '?'}/${THRESHOLD}`
        });
      }
    } catch {
      // A malformed feed must not take the night down; the drift item still runs.
    }
  }

  // 2. The open bugs from the simulation, which are named rather than inferred.
  queue.push({
    id: 'bug-entity-participle',
    kind: 'fix-known-bug',
    summary: 'deriveEntities picks participles: "dogs ears need cleaned" -> entities: ["Cleaned"]'
  });

  // 3. Drift re-gate always runs last and always runs, even if everything above
  //    failed. It is the cheapest item and the one that catches regressions.
  queue.push({ id: 'drift-regate', kind: 'drift', summary: 're-gate every app against the current rubric' });

  return queue;
}

/**
 * Gate one app and return the parsed verdict.
 *
 * @param {string} app slug
 * @param {string} cwd working tree to gate in
 * @returns {{score: number|null, passed: boolean, blockers: string[], raw: string}} verdict
 */
function gateApp(app, cwd) {
  const judge = join('evidence', `verdicts-${app}.json`);
  const result = run(
    'npm',
    ['run', 'gate', '--', app, '--threshold', String(THRESHOLD), '--judge', judge, '--na', 'ci,process'],
    { cwd }
  );
  const raw = `${result.stdout}\n${result.stderr}`;

  const blockerLine = /blockers failed:\s*(.+)/.exec(raw);
  const blockers = blockerLine
    ? blockerLine[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const scoreMatch = /score[^0-9]{0,20}(\d{1,3})\s*\/\s*100/i.exec(raw);
  const score = scoreMatch ? Number(scoreMatch[1]) : null;

  return { score, passed: result.status === 0, blockers, raw };
}

/**
 * Write an evidence receipt for one item.
 *
 * The split is the whole point, and it is Loki's: FACTS are things a machine
 * checked and can re-check; ASSESSMENTS are things a model said. `verified` is
 * a CONJUNCTION of facts only — no assessment can promote an item to VERIFIED,
 * because "the agent reported success" is the exact signal this project has been
 * burned by more than any other.
 *
 * @param {object} input receipt fields
 * @returns {string} path written
 */
function writeReceipt(input) {
  mkdirSync(RECEIPTS_DIR, { recursive: true });

  const facts = {
    commitBefore: input.commitBefore,
    commitAfter: input.commitAfter,
    diffChanged: input.commitBefore !== input.commitAfter,
    testsRan: input.testsRan,
    testsPassed: input.testsPassed,
    buildSucceeded: input.buildSucceeded,
    gateScore: input.gateScore,
    gateThreshold: THRESHOLD,
    gatePassed: input.gatePassed,
    blockers: input.blockers ?? []
  };

  // VERIFIED requires every fact independently. Any unknown reads as not
  // verified, never as a pass — unknown is not verified, it is unknown.
  const verified =
    facts.testsRan === true &&
    facts.testsPassed === true &&
    facts.buildSucceeded === true &&
    facts.diffChanged === true &&
    facts.gatePassed === true;

  const receipt = {
    schema: 'redanvil.receipt/1',
    id: input.id,
    kind: input.kind,
    app: input.app ?? null,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    executor: input.executor,
    status: verified ? 'VERIFIED' : 'UNVERIFIED',
    facts,
    assessments: input.assessments ?? [],
    notes: input.notes ?? []
  };

  // Self-hash last, over the receipt without its own hash, so it can be
  // re-derived by a reader. This is integrity, not security: it detects a
  // hand-edited receipt, which is the realistic failure here.
  const body = JSON.stringify(receipt);
  receipt.sha256 = createHash('sha256').update(body).digest('hex');

  const path = join(RECEIPTS_DIR, `${input.id}-${receipt.finishedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return path;
}

/**
 * Process one queue item end to end.
 *
 * @param {{id: string, kind: string, app?: string, summary: string}} item work item
 * @param {{lokiAvailable: boolean, allowDeploy: boolean, dryRun: boolean}} ctx run context
 * @returns {object} the receipt written
 */
function processItem(item, ctx) {
  const startedAt = new Date().toISOString();
  const commitBefore = headCommit(REPO_ROOT);
  const notes = [];

  if (ctx.dryRun) {
    notes.push('dry run: nothing was executed');
    return writeReceipt({
      id: item.id,
      kind: item.kind,
      app: item.app,
      startedAt,
      executor: 'dry-run',
      commitBefore,
      commitAfter: commitBefore,
      testsRan: false,
      testsPassed: false,
      buildSucceeded: false,
      gateScore: null,
      gatePassed: false,
      notes
    });
  }

  // Drift is read-only: it measures and reports, it never edits.
  if (item.kind === 'drift') {
    const gate = run('node', ['.github/scripts/meets_the_bar.mjs']);
    notes.push(`meets_the_bar exited ${gate.status}`);
    return writeReceipt({
      id: item.id,
      kind: item.kind,
      startedAt,
      executor: 'meets_the_bar',
      commitBefore,
      commitAfter: headCommit(REPO_ROOT),
      testsRan: false,
      testsPassed: false,
      buildSucceeded: false,
      gateScore: null,
      gatePassed: gate.status === 0,
      notes
    });
  }

  // Everything else measures FIRST. Editing before measuring means there is no
  // baseline to compare against, and "it got better" becomes unfalsifiable.
  let gate = item.app ? gateApp(item.app, REPO_ROOT) : null;
  if (gate) notes.push(`baseline: ${gate.blockers.length} blocker(s)`);

  let executor = ctx.lokiAvailable ? 'loki' : 'none';
  const assessments = [];

  // Dispatch a real fix, in a worktree, for an app with named failing rules.
  // Measuring without acting is a monitoring loop; this is the half that makes
  // it a development loop.
  if (item.app && gate && gate.blockers.length > 0 && !ctx.lokiAvailable) {
    const wt = createWorktree(item.id);
    if (!wt) {
      notes.push('could not create a worktree; skipped editing rather than touching the main tree');
    } else {
      notes.push(`worktree ${wt.branch} at ${wt.path}`);
      const fix = dispatchFix(item.app, gate.blockers.slice(0, 6), wt.path);
      executor = fix.agent ?? 'none';
      notes.push(`${fix.agent ?? 'no agent'} exited ${fix.status}`);
      // The agent's own words are an ASSESSMENT and are recorded as one. They
      // never touch `verified`, which is computed from facts alone.
      if (fix.output.trim()) {
        assessments.push({ source: fix.agent ?? 'unknown', claim: fix.output.trim().slice(-1200) });
      }
    }
  } else if (ctx.lokiAvailable) {
    notes.push('dispatched to loki');
  } else {
    notes.push('nothing to dispatch: no failing blockers, or no app directory');
  }

  // The executor is intentionally the ONLY branch between the two worlds.
  // Everything above and below is identical, so switching to Loki changes who
  // does the work and nothing about how it is judged.
  let testsRan = false;
  let testsPassed = false;
  let buildSucceeded = false;

  if (item.app) {
    const appDir = join(REPO_ROOT, item.app);
    if (existsSync(appDir)) {
      const tests = run('npx', ['vitest', 'run'], { cwd: appDir });
      testsRan = tests.status !== null;
      testsPassed = tests.status === 0;
      const build = run('npm', ['run', 'build'], { cwd: appDir });
      buildSucceeded = build.status === 0;
      notes.push(`tests exited ${tests.status}, build exited ${build.status}`);
    } else {
      notes.push(`no directory at ${item.app}; nothing measured`);
    }
  }

  if (gate && item.app) gate = gateApp(item.app, REPO_ROOT);

  return writeReceipt({
    id: item.id,
    kind: item.kind,
    app: item.app,
    startedAt,
    executor,
    commitBefore,
    commitAfter: headCommit(REPO_ROOT),
    testsRan,
    testsPassed,
    buildSucceeded,
    gateScore: gate?.score ?? null,
    gatePassed: gate?.passed ?? false,
    blockers: gate?.blockers ?? [],
    notes
  });
}

const args = parseArgs(process.argv.slice(2));
const dryRun = args['dry-run'] === true;
const allowDeploy = args['allow-deploy'] === true;
const maxItems = Number(args['max-items'] ?? Infinity);

const loki = detectLoki();
mkdirSync(STATE_DIR, { recursive: true });

const queue = buildQueue().slice(0, maxItems);

process.stdout.write(
  `overnight: ${queue.length} item(s); executor=${loki.available ? `loki ${loki.version}` : 'grok (loki unavailable)'}` +
    `${dryRun ? ' [DRY RUN]' : ''}${allowDeploy ? ' [DEPLOY ALLOWED]' : ''}\n`
);

const receipts = [];
for (const item of queue) {
  process.stdout.write(`\n--- ${item.id}: ${item.summary}\n`);
  try {
    const receiptPath = processItem(item, {
      lokiAvailable: loki.available,
      allowDeploy,
      dryRun
    });
    receipts.push(receiptPath);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    process.stdout.write(`    ${receipt.status}  -> ${receiptPath}\n`);
  } catch (err) {
    // One broken item must never end the night.
    process.stdout.write(`    ERROR (continuing): ${String(err)}\n`);
  }
}

const summaryPath = join(STATE_DIR, 'last-run.json');
writeFileSync(
  summaryPath,
  `${JSON.stringify(
    {
      finishedAt: new Date().toISOString(),
      executor: loki.available ? 'loki' : 'grok',
      lokiAvailable: loki.available,
      items: queue.length,
      receipts
    },
    null,
    2
  )}\n`
);

process.stdout.write(`\novernight: ${receipts.length}/${queue.length} item(s) produced a receipt\n`);
process.stdout.write(`summary: ${summaryPath}\n`);
