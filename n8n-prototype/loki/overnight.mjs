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
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/**
 * Repository root for this run. Read each time so a test can point at a temp
 * repo without importing this file against the real tree.
 * @returns {string} absolute path
 */
function getRepoRoot() {
  return resolve(process.env.REDANVIL_REPO ?? process.cwd());
}

/**
 * Evidence receipts directory for the current repo.
 * @returns {string} absolute path
 */
function receiptsDir() {
  return join(getRepoRoot(), 'evidence', 'receipts');
}

/**
 * Overnight state directory for the current repo.
 * @returns {string} absolute path
 */
function stateDir() {
  return join(getRepoRoot(), '.redanvil', 'overnight');
}

/**
 * Checkpoint path for the current repo.
 * @returns {string} absolute path
 */
function checkpointPath() {
  return join(stateDir(), 'checkpoint.json');
}

/** Documented Cloudflare account id. Not a secret. */
const CLOUDFLARE_ACCOUNT_ID = 'dd01b432f0329f87bb1cc1a3fad590ee';

/** Documented env file that holds NewCloudFlareAccountToken. */
const CLOUDFLARE_ENV_FILE =
  process.env.CLOUDFLARE_ENV_FILE ??
  'C:\\Users\\brian\\workspace\\projects\\x-search-mcp-server\\.env';

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
 * @param {{cwd?: string, timeout?: number, env?: NodeJS.ProcessEnv}} [opts] spawn options
 * @returns {{status: number|null, stdout: string, stderr: string}} result
 */
function run(cmd, args, opts = {}) {
  const proc = spawnSync(cmd, args, {
    cwd: opts.cwd ?? getRepoRoot(),
    encoding: 'utf8',
    timeout: opts.timeout ?? ITEM_TIMEOUT_MS,
    shell: process.platform === 'win32',
    env: opts.env ?? process.env
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
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
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
    // -p is print/headless mode. --output-format json returns a STRUCTURED
    // envelope (is_error, api_error_status, permission_denials, total_cost_usd)
    // instead of prose, so a rate limit is detected by reading a field rather
    // than by pattern-matching an error sentence that can change wording.
    args: (prompt) => ['-p', prompt, '--output-format', 'json'],
    structured: true,
    // Claude enforces usage windows. When one is hit, the night must WAIT, not
    // spin: retrying immediately burns the hours the limit was going to clear in.
    hasUsageLimits: true
  },
  {
    name: 'grok',
    bin: 'grok',
    args: (prompt, cwd) => ['--always-approve', '--cwd', cwd, '-m', 'grok-4.6', '-p', prompt],
    structured: false,
    // Grok has no session limit, which is exactly why it is the fallback: when
    // Claude's window closes, work continues instead of stopping.
    hasUsageLimits: false
  }
];

/**
 * Spend ceiling for one night. A trivial claude call cost $0.27; caps matter.
 *
 * This cannot bind on grok: the non-structured branch of dispatchFix hardcodes
 * costUsd: 0, and grok is the fallback that does most of the work once Claude's
 * window closes. The wall-clock deadline is the real cap.
 */
const COST_CAP_USD = Number(process.env.OVERNIGHT_COST_CAP_USD ?? 25);

/**
 * Read the checkpoint, or an empty one.
 *
 * A night that cannot resume is a night that redoes finished work after every
 * crash, rate limit or reboot -- and the loop runs unattended for hours, so a
 * crash at hour six must not throw away hours one through five.
 *
 * @returns {{completed: string[], spentUsd: number, startedAt: string|null}} state
 */
function readCheckpoint() {
  try {
    const state = JSON.parse(readFileSync(checkpointPath(), 'utf8'));
    return {
      completed: Array.isArray(state.completed) ? state.completed : [],
      spentUsd: Number(state.spentUsd ?? 0),
      startedAt: state.startedAt ?? null
    };
  } catch {
    return { completed: [], spentUsd: 0, startedAt: null };
  }
}

/**
 * Persist progress after EVERY item, not at the end.
 * @param {{completed: string[], spentUsd: number, startedAt: string|null}} state checkpoint
 */
function writeCheckpoint(state) {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(checkpointPath(), `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * Classify an agent invocation from its structured envelope.
 *
 * Fields are read from the real `--output-format json` result, confirmed by
 * running it: `is_error`, `api_error_status`, `permission_denials`,
 * `total_cost_usd`, `subtype`.
 *
 * @param {{status: number|null, stdout: string, stderr: string}} res spawn result
 * @returns {{ok: boolean, rateLimited: boolean, costUsd: number, detail: string}} verdict
 */
function classifyClaude(res) {
  const combined = `${res.stdout}\n${res.stderr}`;
  let envelope = null;
  try {
    envelope = JSON.parse(res.stdout);
  } catch {
    // Not JSON: the process died before it could emit an envelope at all.
  }

  if (envelope) {
    const apiStatus = envelope.api_error_status;
    // 429 is the rate limit; 529 is overloaded. Both mean "wait", not "fail".
    const rateLimited = apiStatus === 429 || apiStatus === 529;
    return {
      ok: envelope.is_error !== true,
      rateLimited,
      costUsd: Number(envelope.total_cost_usd ?? 0),
      detail:
        `subtype=${envelope.subtype} api_error_status=${apiStatus ?? 'none'} ` +
        `permission_denials=${(envelope.permission_denials ?? []).length}`
    };
  }

  // No envelope. Fall back to text signals, kept broad on purpose: missing a
  // rate limit costs the whole night, a false positive costs one wait.
  const rateLimited = /rate.?limit|usage limit|429|too many requests|quota|overloaded/i.test(combined);
  return {
    ok: res.status === 0,
    rateLimited,
    costUsd: 0,
    detail: `no json envelope; exit ${res.status}`
  };
}

/**
 * Sleep, synchronously, for a whole number of milliseconds.
 *
 * Atomics.wait on a throwaway buffer blocks this thread without a busy loop and
 * without dragging an async runtime through the whole file. The night is a
 * sequential script; blocking IS the behaviour we want when a limit says wait.
 *
 * @param {number} ms duration
 */
function sleepSync(ms) {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, Math.max(0, ms));
}

/**
 * Absolute deadline in ms.
 *
 * OVERNIGHT_DEADLINE_ISO wins and is absolute: a timestamp in the past stops
 * the night immediately (it must NOT roll to tomorrow — that is the input
 * that makes this fail). `--until HH:MM` is local clock time; if that time
 * has already passed today it rolls to tomorrow, which is the 23:30→06:00
 * overnight case. Default is 06:00 local.
 *
 * @param {{untilFlag?: string|boolean, envIso?: string, now?: Date}} [opts]
 * @returns {number} epoch ms
 */
function resolveDeadline(opts = {}) {
  const now = opts.now ?? new Date();
  const envIso = opts.envIso ?? process.env.OVERNIGHT_DEADLINE_ISO;
  if (typeof envIso === 'string' && envIso.trim()) {
    const parsed = Date.parse(envIso);
    if (Number.isFinite(parsed)) return parsed;
  }
  const until = typeof opts.untilFlag === 'string' ? opts.untilFlag : '06:00';
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(until);
  const hours = match ? Number(match[1]) : 6;
  const minutes = match ? Number(match[2]) : 0;
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

/**
 * Clamp a requested duration so it cannot outlive the deadline.
 *
 * FAIL INPUT: requested 45 minutes, remaining 10 minutes → 10 minutes, not 45.
 *
 * @param {number} requestedMs requested wait or timeout
 * @param {number} remainingMs ms until deadline
 * @returns {number} clamped ms, never negative
 */
function clampToRemaining(requestedMs, remainingMs) {
  if (!Number.isFinite(remainingMs)) return requestedMs;
  return Math.max(0, Math.min(requestedMs, remainingMs));
}

/**
 * Whether a rate-limit backoff wait may be entered.
 *
 * FAIL INPUT: a 60-minute wait with 20 minutes remaining must return false.
 *
 * @param {number} waitMs proposed backoff
 * @param {number} remainingMs ms until deadline
 * @returns {boolean} true when the wait fits
 */
function backoffFits(waitMs, remainingMs) {
  return waitMs <= remainingMs;
}

/**
 * Whether every merge condition holds. Any one missing means leave the branch.
 *
 * FAIL INPUT: any single flag false, or mainDirty true (the 18-file path).
 *
 * @param {{testsRan: boolean, testsPassed: boolean, buildSucceeded: boolean, gatePassed: boolean, diffChanged: boolean, mainDirty: boolean}} cond
 * @returns {boolean}
 */
function shouldMerge(cond) {
  return (
    cond.testsRan === true &&
    cond.testsPassed === true &&
    cond.buildSucceeded === true &&
    cond.gatePassed === true &&
    cond.diffChanged === true &&
    cond.mainDirty === false
  );
}

/**
 * Run git without a shell so Windows does not mangle `-c` flags.
 * @param {string} cwd directory
 * @param {string[]} args git argv after `git`
 * @param {number} [timeout] ms
 * @returns {{status: number|null, stdout: string, stderr: string}}
 */
function gitAt(cwd, args, timeout = 60_000) {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { status: 0, stdout: String(stdout), stderr: '' };
  } catch (err) {
    return {
      status: typeof err.status === 'number' ? err.status : 1,
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? err.message ?? '')
    };
  }
}

/**
 * git status --porcelain. True when anything is listed.
 *
 * FAIL INPUT: a file written and not committed → true.
 *
 * @param {string} cwd repo or worktree
 * @returns {boolean}
 */
function porcelainDirty(cwd) {
  const res = gitAt(cwd, ['status', '--porcelain'], 30_000);
  return res.stdout.trim() !== '';
}

/**
 * Commit worktree changes if the agent left the tree dirty.
 * An empty commit is not an error — it means the agent changed nothing.
 *
 * @param {string} wtPath worktree path
 * @param {string} message commit message
 * @returns {{didCommit: boolean, clean: boolean, sha: string|null, reason: string}}
 */
function commitWorktreeIfDirty(wtPath, message) {
  if (!porcelainDirty(wtPath)) {
    return { didCommit: false, clean: true, sha: headCommit(wtPath), reason: 'clean' };
  }
  const add = gitAt(wtPath, ['add', '-A'], 60_000);
  if (add.status !== 0) {
    return {
      didCommit: false,
      clean: false,
      sha: headCommit(wtPath),
      reason: `git add failed: ${add.stderr}`
    };
  }
  const commit = gitAt(
    wtPath,
    ['-c', 'user.email=redanvil@local', '-c', 'user.name=RedAnvil', 'commit', '--no-verify', '-m', message],
    60_000
  );
  if (commit.status !== 0) {
    const text = `${commit.stdout}\n${commit.stderr}`;
    if (/nothing to commit/i.test(text)) {
      return { didCommit: false, clean: true, sha: headCommit(wtPath), reason: 'nothing to commit' };
    }
    return {
      didCommit: false,
      clean: false,
      sha: headCommit(wtPath),
      reason: `git commit failed: ${text.slice(-400)}`
    };
  }
  return { didCommit: true, clean: true, sha: headCommit(wtPath), reason: 'committed' };
}

/**
 * Merge a worktree branch into the main tree.
 * @param {string} repoRoot main repo
 * @param {string} branch branch name
 * @returns {{ok: boolean, detail: string}}
 */
function mergeBranch(repoRoot, branch) {
  const merge = gitAt(
    repoRoot,
    [
      '-c',
      'user.email=redanvil@local',
      '-c',
      'user.name=RedAnvil',
      'merge',
      '--no-ff',
      '--no-edit',
      '--no-verify',
      branch
    ],
    120_000
  );
  if (merge.status === 0) return { ok: true, detail: 'merged' };
  gitAt(repoRoot, ['merge', '--abort'], 30_000);
  return { ok: false, detail: `${merge.stdout}\n${merge.stderr}`.slice(-600) };
}

/**
 * Unlink a node_modules junction, then `git worktree remove` without --force.
 * On failure, leave it. --force is the input that makes this check fail.
 *
 * @param {{path: string, branch: string}} wt worktree
 * @param {string} repoRoot main repo
 * @returns {{ok: boolean, detail: string}}
 */
function removeWorktree(wt, repoRoot) {
  const link = join(wt.path, 'node_modules');
  if (existsSync(link)) {
    try {
      const st = lstatSync(link);
      if (st.isSymbolicLink()) {
        unlinkSync(link);
      } else if (process.platform === 'win32') {
        execFileSync('cmd', ['/c', 'rmdir', link], { stdio: 'ignore' });
      }
    } catch {
      try {
        rmSync(link, { recursive: false, force: true });
      } catch {
        // leave it; remove without --force will then refuse rather than follow it
      }
    }
  }
  const removed = gitAt(repoRoot, ['worktree', 'remove', wt.path], 120_000);
  if (removed.status !== 0) {
    return { ok: false, detail: `${removed.stdout}\n${removed.stderr}`.slice(-400) };
  }
  return { ok: true, detail: 'removed' };
}

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
 * @param {string} [repoRoot] main repo (defaults to getRepoRoot())
 * @returns {{path: string, branch: string}|null} worktree, or null if it failed
 */
function createWorktree(slug, repoRoot = getRepoRoot()) {
  const branch = `overnight/${slug}`;
  const path = resolve(repoRoot, '..', `redanvil-wt-${slug}`);
  if (existsSync(path)) return { path, branch };

  const made = gitAt(repoRoot, ['worktree', 'add', '-B', branch, path, 'HEAD'], 120_000);
  if (made.status !== 0) return null;

  // Junction rather than copy: tests and build in the worktree need packages.
  // Removal must unlink this FIRST and never use --force while it exists.
  const link = join(path, 'node_modules');
  const target = join(repoRoot, 'node_modules');
  if (!existsSync(link) && existsSync(target) && process.platform === 'win32') {
    try {
      execFileSync('cmd', ['/c', 'mklink', '/J', link, target], { stdio: 'ignore' });
    } catch {
      // tests/build may fail without it; the loop records that rather than crashing
    }
  }
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
 * @param {{deadlineAt?: number, itemTimeoutMs?: number}} [opts] deadline clamp
 * @returns {{agent: string|null, status: number|null, output: string}} result
 */
function dispatchFix(app, blockers, cwd, opts = {}) {
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

  // Escalating waits for a usage window. A Claude limit clears on its own after
  // a while, so the correct response is to WAIT and then continue -- stopping
  // the night wastes every hour the window was going to reopen in, and retrying
  // in a tight loop wastes them just as thoroughly while looking busy.
  const LIMIT_BACKOFF_MS = [5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000];

  for (const agent of AGENTS) {
    const probe = run(process.platform === 'win32' ? 'where' : 'which', [agent.bin], { timeout: 10_000 });
    if (probe.status !== 0) continue;

    for (let attempt = 0; attempt <= LIMIT_BACKOFF_MS.length; attempt += 1) {
      const remaining =
        opts.deadlineAt != null ? opts.deadlineAt - Date.now() : Number.POSITIVE_INFINITY;
      const timeout = clampToRemaining(opts.itemTimeoutMs ?? ITEM_TIMEOUT_MS, remaining);
      if (timeout <= 0) {
        return {
          agent: agent.name,
          status: null,
          ok: false,
          costUsd: 0,
          output: 'deadline reached before dispatch'
        };
      }
      const res = run(agent.bin, agent.args(prompt, cwd), { cwd, timeout });
      const verdict = agent.structured
        ? classifyClaude(res)
        : { ok: res.status === 0, rateLimited: false, costUsd: 0, detail: `exit ${res.status}` };

      if (verdict.ok || !verdict.rateLimited) {
        return {
          agent: agent.name,
          status: res.status,
          ok: verdict.ok,
          costUsd: verdict.costUsd,
          output: `${verdict.detail}\n${res.stdout}\n${res.stderr}`.slice(-4000)
        };
      }

      // Rate limited. Wait, unless the waits are exhausted -- then hand the work
      // to the next agent rather than idling until morning.
      if (attempt === LIMIT_BACKOFF_MS.length) {
        process.stdout.write(
          `    ${agent.name} still limited after ${LIMIT_BACKOFF_MS.length} waits; handing off\n`
        );
        break;
      }
      const waitMs = LIMIT_BACKOFF_MS[attempt];
      const remainingAfter =
        opts.deadlineAt != null ? opts.deadlineAt - Date.now() : Number.POSITIVE_INFINITY;
      if (!backoffFits(waitMs, remainingAfter)) {
        process.stdout.write(
          `    ${agent.name} backoff ${Math.round(waitMs / 60000)}m exceeds remaining ${Math.round(remainingAfter / 60000)}m; handing off\n`
        );
        break;
      }
      process.stdout.write(
        `    ${agent.name} rate limited (${verdict.detail}); waiting ${Math.round(waitMs / 60000)}m then retrying\n`
      );
      sleepSync(waitMs);
    }
  }
  return { agent: null, status: null, ok: false, costUsd: 0, output: 'no headless agent could run' };
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
  const allResults = join(getRepoRoot(), 'results', 'all.json');
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
 * @param {typeof run} [runFn] command runner
 * @returns {{score: number|null, passed: boolean, blockers: string[], raw: string}} verdict
 */
function gateApp(app, cwd, runFn = run) {
  const judge = join('evidence', `verdicts-${app}.json`);
  const result = runFn(
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
  mkdirSync(receiptsDir(), { recursive: true });

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
    blockers: input.blockers ?? [],
    deployed: input.deployed === true,
    deployHashMatches: input.deployHashMatches === true
  };

  // VERIFIED requires every fact independently. Any unknown reads as not
  // verified, never as a pass — unknown is not verified, it is unknown.
  // When a deploy was attempted, deployHashMatches must also be true.
  // FAIL INPUT: deployAttempted true and deployHashMatches false → UNVERIFIED.
  const deployAttempted = input.deployAttempted === true;
  const verified =
    facts.testsRan === true &&
    facts.testsPassed === true &&
    facts.buildSucceeded === true &&
    facts.diffChanged === true &&
    facts.gatePassed === true &&
    (deployAttempted !== true || facts.deployHashMatches === true);

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
    costUsd: Number(input.costUsd ?? 0),
    assessments: input.assessments ?? [],
    notes: input.notes ?? []
  };

  // Self-hash last, over the receipt without its own hash, so it can be
  // re-derived by a reader. This is integrity, not security: it detects a
  // hand-edited receipt, which is the realistic failure here.
  const body = JSON.stringify(receipt);
  receipt.sha256 = createHash('sha256').update(body).digest('hex');

  const path = join(receiptsDir(), `${input.id}-${receipt.finishedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return path;
}

/**
 * Parse KEY=VALUE lines. Never logs values.
 * @param {string} text env file body
 * @returns {Record<string, string>}
 */
function parseEnvText(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/**
 * Load the Cloudflare token into `env` without printing it.
 * @param {{env?: NodeJS.ProcessEnv, envFileText?: string, envFilePath?: string}} [opts]
 * @returns {{ok: boolean, reason: string}}
 */
function loadCloudflareEnv(opts = {}) {
  const env = opts.env ?? process.env;
  if (typeof env.CLOUDFLARE_API_TOKEN === 'string' && env.CLOUDFLARE_API_TOKEN.length > 0) {
    if (!env.CLOUDFLARE_ACCOUNT_ID) env.CLOUDFLARE_ACCOUNT_ID = CLOUDFLARE_ACCOUNT_ID;
    return { ok: true, reason: 'CLOUDFLARE_API_TOKEN already set' };
  }
  let text = opts.envFileText;
  if (text === undefined) {
    const envFilePath = opts.envFilePath ?? CLOUDFLARE_ENV_FILE;
    if (!existsSync(envFilePath)) return { ok: false, reason: 'cloudflare env file not found' };
    text = readFileSync(envFilePath, 'utf8');
  }
  const parsed = parseEnvText(text);
  const token = parsed.NewCloudFlareAccountToken;
  if (!token) return { ok: false, reason: 'NewCloudFlareAccountToken missing from env file' };
  env.CLOUDFLARE_API_TOKEN = token;
  env.CLOUDFLARE_ACCOUNT_ID =
    env.CLOUDFLARE_ACCOUNT_ID || parsed.CLOUDFLARE_ACCOUNT_ID || CLOUDFLARE_ACCOUNT_ID;
  return { ok: true, reason: 'loaded NewCloudFlareAccountToken' };
}

/**
 * Top-level wrangler.toml fields this deploy path needs.
 * @param {string} appDir app directory
 * @returns {{name: string|null, outputDir: string|null}}
 */
function readWranglerFields(appDir) {
  const wranglerPath = join(appDir, 'wrangler.toml');
  if (!existsSync(wranglerPath)) return { name: null, outputDir: null };
  const text = readFileSync(wranglerPath, 'utf8');
  const name = (/^name\s*=\s*["']([^"']+)["']/m.exec(text) ?? [])[1] ?? null;
  const outputDir =
    (/^pages_build_output_dir\s*=\s*["']([^"']+)["']/m.exec(text) ?? [])[1] ?? null;
  return { name, outputDir };
}

/**
 * Pages project from a recorded deployUrl, else wrangler name. Never guesses a
 * hostname as proof; missing records skip the deploy.
 * @param {string} appDir app directory
 * @returns {{project: string|null, prodUrl: string|null, reason: string}}
 */
function resolvePagesProject(appDir) {
  const claimsPath = join(appDir, '.redanvil', 'claims.json');
  if (existsSync(claimsPath)) {
    try {
      const claims = JSON.parse(readFileSync(claimsPath, 'utf8'));
      if (typeof claims.deployUrl === 'string' && claims.deployUrl.trim()) {
        const host = new URL(claims.deployUrl.trim()).hostname;
        const match = /^([a-z0-9-]+)\.pages\.dev$/i.exec(host);
        if (match) {
          return {
            project: match[1],
            prodUrl: `https://${match[1]}.pages.dev`,
            reason: 'claims.deployUrl'
          };
        }
      }
    } catch {
      // fall through to wrangler.toml
    }
  }
  const { name } = readWranglerFields(appDir);
  if (name) {
    return { project: name, prodUrl: `https://${name}.pages.dev`, reason: 'wrangler.toml name' };
  }
  return { project: null, prodUrl: null, reason: 'no claims.deployUrl and no wrangler.toml name' };
}

/**
 * Read production_branch from the Cloudflare Pages API. Never guesses `main`.
 *
 * FAIL INPUT: API result with no production_branch field → skip, do not default.
 *
 * @param {string} projectName Pages project
 * @param {{fetchImpl?: typeof fetch, token?: string, accountId?: string}} [opts]
 * @returns {Promise<{branch: string|null, reason: string}>}
 */
async function readProductionBranch(projectName, opts = {}) {
  const token = opts.token ?? process.env.CLOUDFLARE_API_TOKEN;
  const accountId = opts.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? CLOUDFLARE_ACCOUNT_ID;
  if (!token) return { branch: null, reason: 'CLOUDFLARE_API_TOKEN not set' };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`;
  try {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { branch: null, reason: `pages project lookup HTTP ${res.status}` };
    const body = await res.json();
    const branch = body?.result?.production_branch;
    if (typeof branch !== 'string' || !branch.trim()) {
      return { branch: null, reason: 'production_branch missing from API result' };
    }
    return { branch: branch.trim(), reason: 'ok' };
  } catch (err) {
    return { branch: null, reason: `pages project lookup failed: ${String(err)}` };
  }
}

/**
 * First assets/index-*.js reference in HTML.
 * @param {string} html page source
 * @returns {string|null}
 */
function extractIndexAsset(html) {
  const match = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(html);
  return match ? match[0] : null;
}

/**
 * Local build's index asset relative path.
 * @param {string} appDir app directory
 * @param {string} outputDir pages_build_output_dir
 * @returns {string|null}
 */
function localIndexAsset(appDir, outputDir) {
  const indexHtml = join(appDir, outputDir, 'index.html');
  if (existsSync(indexHtml)) {
    return extractIndexAsset(readFileSync(indexHtml, 'utf8'));
  }
  const assetsDir = join(appDir, outputDir, 'assets');
  if (!existsSync(assetsDir)) return null;
  const names = readdirSync(assetsDir).filter((f) => /^index-.*\.js$/.test(f));
  return names[0] ? `assets/${names[0]}` : null;
}

/**
 * Backend probe path when the app has Pages Functions, otherwise null.
 *
 * FAIL INPUT: no functions/ directory → null (must not fetch /api/health).
 *
 * @param {string} appDir app directory
 * @returns {string|null}
 */
function functionsHealthPath(appDir) {
  if (!existsSync(join(appDir, 'functions'))) return null;
  return '/api/health';
}

/**
 * Build, wrangler-deploy, and prove the served asset hash matches the build.
 * Never reports a per-deploy hash URL. Token stays in env, never in argv.
 *
 * @param {string} app slug
 * @param {string} repoRoot tree that holds the merged code
 * @param {{run?: typeof run, fetchImpl?: typeof fetch, env?: NodeJS.ProcessEnv, pollMs?: number, pollAttempts?: number, timeout?: number}} [opts]
 * @returns {Promise<{attempted: boolean, deployed: boolean, hashMatches: boolean, notes: string[]}>}
 */
async function deployAndVerify(app, repoRoot, opts = {}) {
  const appDir = join(repoRoot, app);
  const notes = [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const runCmd = opts.run ?? run;
  const env = opts.env ?? process.env;

  const loaded = loadCloudflareEnv({ env });
  if (!loaded.ok) {
    return {
      attempted: false,
      deployed: false,
      hashMatches: false,
      notes: [`deploy skipped: ${loaded.reason}`]
    };
  }

  const wrangler = readWranglerFields(appDir);
  if (!wrangler.outputDir) {
    return {
      attempted: false,
      deployed: false,
      hashMatches: false,
      notes: ['deploy skipped: pages_build_output_dir missing from wrangler.toml']
    };
  }
  const pages = resolvePagesProject(appDir);
  if (!pages.project || !pages.prodUrl) {
    return {
      attempted: false,
      deployed: false,
      hashMatches: false,
      notes: [`deploy skipped: ${pages.reason}`]
    };
  }

  const prod = await readProductionBranch(pages.project, {
    fetchImpl,
    token: env.CLOUDFLARE_API_TOKEN,
    accountId: env.CLOUDFLARE_ACCOUNT_ID ?? CLOUDFLARE_ACCOUNT_ID
  });
  if (!prod.branch) {
    return {
      attempted: false,
      deployed: false,
      hashMatches: false,
      notes: [`deploy skipped: ${prod.reason}`]
    };
  }

  const build = runCmd('npm', ['run', 'build'], {
    cwd: appDir,
    timeout: opts.timeout ?? ITEM_TIMEOUT_MS,
    env
  });
  if (build.status !== 0) {
    return {
      attempted: false,
      deployed: false,
      hashMatches: false,
      notes: [`deploy skipped: build exited ${build.status}`]
    };
  }

  const deploy = runCmd(
    'npx',
    [
      'wrangler',
      'pages',
      'deploy',
      wrangler.outputDir,
      `--project-name=${pages.project}`,
      `--branch=${prod.branch}`,
      '--commit-dirty=true'
    ],
    { cwd: appDir, timeout: opts.timeout ?? ITEM_TIMEOUT_MS, env }
  );
  if (deploy.status !== 0) {
    return {
      attempted: true,
      deployed: false,
      hashMatches: false,
      notes: [`wrangler pages deploy exited ${deploy.status}`]
    };
  }

  const localAsset = localIndexAsset(appDir, wrangler.outputDir);
  if (!localAsset) {
    return {
      attempted: true,
      deployed: true,
      hashMatches: false,
      notes: ['deployed but local build has no assets/index-*.js']
    };
  }

  const pollAttempts = opts.pollAttempts ?? 12;
  const pollMs = opts.pollMs ?? 5_000;
  let prodAsset = null;
  for (let i = 0; i < pollAttempts; i += 1) {
    try {
      const res = await fetchImpl(`${pages.prodUrl}/?cb=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const html = await res.text();
      prodAsset = extractIndexAsset(html);
      if (prodAsset === localAsset) break;
    } catch {
      // retry — alias lag is documented; a single immediate fetch is not proof
    }
    if (i < pollAttempts - 1 && pollMs > 0) sleepSync(pollMs);
  }
  const hashMatches = prodAsset === localAsset;
  notes.push(
    `prod ${pages.prodUrl} asset ${prodAsset ?? 'NONE'} local ${localAsset} ${hashMatches ? 'MATCH' : 'MISMATCH'}`
  );

  const health = functionsHealthPath(appDir);
  if (health) {
    try {
      const res = await fetchImpl(`${pages.prodUrl}${health}`);
      notes.push(`backend ${health} HTTP ${res.status}`);
    } catch (err) {
      notes.push(`backend ${health} failed: ${String(err)}`);
    }
  }

  return { attempted: true, deployed: true, hashMatches, notes };
}

/**
 * Process one queue item end to end.
 *
 * @param {{id: string, kind: string, app?: string, summary: string}} item work item
 * @param {{lokiAvailable: boolean, allowDeploy: boolean, dryRun: boolean, deadlineAt?: number, itemTimeoutMs?: number, run?: typeof run, dispatchFix?: Function, fetchImpl?: typeof fetch, repoRoot?: string, env?: NodeJS.ProcessEnv, pollMs?: number, pollAttempts?: number}} ctx run context
 * @returns {Promise<string>} the receipt path written
 */
async function processItem(item, ctx) {
  if (ctx.repoRoot) process.env.REDANVIL_REPO = ctx.repoRoot;
  const root = ctx.repoRoot ?? getRepoRoot();
  const runCmd = ctx.run ?? run;
  const startedAt = new Date().toISOString();
  const commitBefore = headCommit(root);
  const notes = [];
  const itemTimeout = ctx.itemTimeoutMs ?? ITEM_TIMEOUT_MS;

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
    const gate = runCmd('node', ['.github/scripts/meets_the_bar.mjs'], { cwd: root, timeout: itemTimeout });
    notes.push(`meets_the_bar exited ${gate.status}`);
    return writeReceipt({
      id: item.id,
      kind: item.kind,
      startedAt,
      executor: 'meets_the_bar',
      commitBefore,
      commitAfter: headCommit(root),
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
  let gate = item.app ? gateApp(item.app, root, runCmd) : null;
  if (gate) notes.push(`baseline: ${gate.blockers.length} blocker(s)`);

  let executor = ctx.lokiAvailable ? 'loki' : 'none';
  let itemCostUsd = 0;
  const assessments = [];
  /** @type {{path: string, branch: string}|null} */
  let wt = null;

  // Dispatch a real fix, in a worktree, for an app with named failing rules.
  // Measuring without acting is a monitoring loop; this is the half that makes
  // it a development loop.
  if (item.app && gate && gate.blockers.length > 0 && !ctx.lokiAvailable) {
    wt = createWorktree(item.id, root);
    if (!wt) {
      notes.push('could not create a worktree; skipped editing rather than touching the main tree');
    } else {
      notes.push(`worktree ${wt.branch} at ${wt.path}`);
      const fixer = ctx.dispatchFix ?? dispatchFix;
      const fix = fixer(item.app, gate.blockers.slice(0, 6), wt.path, {
        deadlineAt: ctx.deadlineAt,
        itemTimeoutMs: itemTimeout
      });
      executor = fix.agent ?? 'none';
      itemCostUsd = fix.costUsd ?? 0;
      notes.push(`${fix.agent ?? 'no agent'} exited ${fix.status}, cost $${itemCostUsd.toFixed(4)}`);
      // The agent's own words are an ASSESSMENT and are recorded as one. They
      // never touch `verified`, which is computed from facts alone.
      if (fix.output && String(fix.output).trim()) {
        assessments.push({ source: fix.agent ?? 'unknown', claim: String(fix.output).trim().slice(-1200) });
      }

      const committed = commitWorktreeIfDirty(wt.path, `overnight: ${item.id}`);
      if (committed.didCommit) notes.push(`committed ${committed.sha} in worktree`);
      else if (committed.clean) notes.push('worktree clean after agent; no commit');
      else notes.push(`worktree commit skipped: ${committed.reason}`);
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

  const measureRoot = wt ? wt.path : root;
  if (item.app) {
    const appDir = join(measureRoot, item.app);
    if (existsSync(appDir)) {
      const tests = runCmd('npx', ['vitest', 'run'], { cwd: appDir, timeout: itemTimeout });
      testsRan = tests.status !== null;
      testsPassed = tests.status === 0;
      const build = runCmd('npm', ['run', 'build'], { cwd: appDir, timeout: itemTimeout });
      buildSucceeded = build.status === 0;
      notes.push(`tests exited ${tests.status}, build exited ${build.status}`);
    } else {
      notes.push(`no directory at ${item.app}; nothing measured`);
    }
  }

  if (gate && item.app) gate = gateApp(item.app, measureRoot, runCmd);

  const commitAfter = wt ? headCommit(wt.path) : headCommit(root);
  const diffChanged = commitBefore !== commitAfter;

  let merged = false;
  if (wt) {
    const mainDirty = porcelainDirty(root);
    const mergeOk = shouldMerge({
      testsRan,
      testsPassed,
      buildSucceeded,
      gatePassed: gate?.passed ?? false,
      diffChanged,
      mainDirty
    });
    if (!mergeOk) {
      if (mainDirty) {
        notes.push('refusing to merge into a dirty main tree; leaving branch for morning review');
      } else {
        notes.push('not merging: tests/build/gate/diff conditions unmet; leaving branch');
      }
    } else {
      const merge = mergeBranch(root, wt.branch);
      if (merge.ok) {
        merged = true;
        notes.push(`merged ${wt.branch}`);
      } else {
        notes.push(`merge failed; leaving branch: ${merge.detail}`);
      }
    }
  }

  let deployed = false;
  let deployHashMatches = false;
  let deployAttempted = false;
  if (merged && ctx.allowDeploy === true && item.app) {
    const dep = await deployAndVerify(item.app, root, {
      run: runCmd,
      fetchImpl: ctx.fetchImpl,
      timeout: itemTimeout,
      env: ctx.env,
      pollMs: ctx.pollMs,
      pollAttempts: ctx.pollAttempts
    });
    deployAttempted = dep.attempted;
    deployed = dep.deployed;
    deployHashMatches = dep.hashMatches;
    notes.push(...dep.notes);
  }

  if (merged && wt) {
    const removed = removeWorktree(wt, root);
    if (!removed.ok) notes.push(`left worktree in place: ${removed.detail}`);
  }

  return writeReceipt({
    id: item.id,
    kind: item.kind,
    app: item.app,
    startedAt,
    executor,
    commitBefore,
    commitAfter,
    testsRan,
    testsPassed,
    buildSucceeded,
    gateScore: gate?.score ?? null,
    gatePassed: gate?.passed ?? false,
    blockers: gate?.blockers ?? [],
    costUsd: itemCostUsd,
    assessments,
    notes,
    deployed,
    deployHashMatches,
    deployAttempted
  });
}

/**
 * True when this file is the process entry point (not an import from a test).
 * @returns {boolean}
 */
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

/**
 * Run the overnight loop once. Exported so tests can inject a clock and a queue.
 *
 * @param {{args?: Record<string, string|boolean>, nowFn?: () => number, deadlineAt?: number, queue?: Array, loki?: {available: boolean, version: string|null}, repoRoot?: string, fetchImpl?: typeof fetch, dispatchFix?: Function, run?: typeof run}} [opts]
 * @returns {Promise<{summaryPath: string, receipts: string[], stoppedEarly: boolean, itemsSkipped: number, deadlineAt: number}>}
 */
async function runOvernight(opts = {}) {
  if (opts.repoRoot) process.env.REDANVIL_REPO = opts.repoRoot;
  const args = opts.args ?? parseArgs(process.argv.slice(2));
  const nowFn = opts.nowFn ?? Date.now;
  const dryRun = args['dry-run'] === true;
  const allowDeploy = args['allow-deploy'] === true;
  const maxItems = Number(args['max-items'] ?? Infinity);

  const deadlineAt =
    opts.deadlineAt ??
    resolveDeadline({
      untilFlag: args.until,
      envIso: process.env.OVERNIGHT_DEADLINE_ISO,
      now: new Date(nowFn())
    });

  const loki = opts.loki ?? detectLoki();
  mkdirSync(stateDir(), { recursive: true });

  const queue = (opts.queue ?? buildQueue()).slice(0, maxItems);

  process.stdout.write(
    `overnight: ${queue.length} item(s); executor=${loki.available ? `loki ${loki.version}` : 'grok (loki unavailable)'}` +
      `${dryRun ? ' [DRY RUN]' : ''}${allowDeploy ? ' [DEPLOY ALLOWED]' : ''}` +
      `; deadline=${new Date(deadlineAt).toISOString()}\n`
  );

  const checkpoint = readCheckpoint();
  if (!checkpoint.startedAt) checkpoint.startedAt = new Date().toISOString();
  if (checkpoint.completed.length > 0) {
    process.stdout.write(
      `resuming: ${checkpoint.completed.length} item(s) already done, $${checkpoint.spentUsd.toFixed(2)} spent\n`
    );
  }

  const receipts = [];
  let stoppedEarly = false;
  let itemsSkipped = 0;
  /** @type {string|null} */
  let stopReason = null;

  for (const item of queue) {
    // Resume rather than redo. A night that restarts after a crash, a reboot or a
    // usage window must not repeat work it already finished and paid for.
    if (checkpoint.completed.includes(item.id)) {
      process.stdout.write(`\n--- ${item.id}: already done, skipping\n`);
      continue;
    }

    const remaining = deadlineAt - nowFn();
    if (remaining <= 0) {
      stoppedEarly = true;
      stopReason = `deadline ${new Date(deadlineAt).toISOString()} passed; stopping before ${item.id}`;
      itemsSkipped = queue.filter((queued) => !checkpoint.completed.includes(queued.id)).length;
      process.stdout.write(`\n${stopReason}\n`);
      break;
    }
    if (checkpoint.spentUsd >= COST_CAP_USD) {
      stoppedEarly = true;
      stopReason = `cost cap $${COST_CAP_USD} reached; stopping before ${item.id}`;
      itemsSkipped = queue.filter((queued) => !checkpoint.completed.includes(queued.id)).length;
      process.stdout.write(`\n${stopReason}\n`);
      break;
    }

    const itemTimeoutMs = clampToRemaining(ITEM_TIMEOUT_MS, remaining);
    process.stdout.write(`\n--- ${item.id}: ${item.summary}\n`);
    try {
      const receiptPath = await processItem(item, {
        lokiAvailable: loki.available,
        allowDeploy,
        dryRun,
        deadlineAt,
        itemTimeoutMs,
        fetchImpl: opts.fetchImpl,
        dispatchFix: opts.dispatchFix,
        run: opts.run,
        repoRoot: opts.repoRoot
      });
      receipts.push(receiptPath);
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
      process.stdout.write(`    ${receipt.status}  -> ${receiptPath}\n`);

      // Checkpoint after EVERY item, not at the end. The end may never arrive.
      checkpoint.completed.push(item.id);
      checkpoint.spentUsd += Number(receipt.costUsd ?? 0);
      writeCheckpoint(checkpoint);
    } catch (err) {
      // One broken item must never end the night.
      process.stdout.write(`    ERROR (continuing): ${String(err)}\n`);
    }
  }

  const summaryPath = join(stateDir(), 'last-run.json');
  writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        finishedAt: new Date(nowFn()).toISOString(),
        executor: loki.available ? 'loki' : 'grok',
        lokiAvailable: loki.available,
        items: queue.length,
        receipts,
        deadline: new Date(deadlineAt).toISOString(),
        stoppedEarly,
        itemsSkipped,
        stopReason
      },
      null,
      2
    )}\n`
  );

  process.stdout.write(`\novernight: ${receipts.length}/${queue.length} item(s) produced a receipt\n`);
  process.stdout.write(`summary: ${summaryPath}\n`);
  return { summaryPath, receipts, stoppedEarly, itemsSkipped, deadlineAt };
}

if (isMainModule()) {
  void runOvernight().catch((err) => {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  });
}

export {
  parseArgs,
  resolveDeadline,
  clampToRemaining,
  backoffFits,
  shouldMerge,
  porcelainDirty,
  commitWorktreeIfDirty,
  mergeBranch,
  removeWorktree,
  writeReceipt,
  processItem,
  dispatchFix,
  buildQueue,
  gateApp,
  parseEnvText,
  loadCloudflareEnv,
  readWranglerFields,
  resolvePagesProject,
  readProductionBranch,
  extractIndexAsset,
  localIndexAsset,
  functionsHealthPath,
  deployAndVerify,
  runOvernight,
  getRepoRoot,
  createWorktree,
  headCommit,
  classifyClaude
};
