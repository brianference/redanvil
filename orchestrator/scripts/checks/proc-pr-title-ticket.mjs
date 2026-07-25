#!/usr/bin/env node
/**
 * proc-pr-title-ticket — PR title must start with a ticket key.
 *
 * Option chosen: (a) real available signal via `gh pr view --json title`.
 *
 * Why (a): a local gate run often has no PR, so inventing a pass would give
 * unearned credit. When `gh` can see a PR for the current branch we measure
 * the title; when there is no PR, no `gh`, or gh reports no pull request, the
 * rule is notApplicable (exit 3) and leaves the score denominator. That keeps
 * the check honest without weakening it to a no-op.
 *
 * Accepted title shapes (ticket at the start, after an optional conventional
 * commit type prefix):
 *   - "RA-42: fix login" / "[RA-42] fix login" / "PROJ-123 stuff"
 *   - "feat: RA-42 login" / "fix(api): RA-42 login" / "feat!: RA-42 login"
 *
 * Usage: node proc-pr-title-ticket.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 2 = usage, 3 = not applicable.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** Exit code when the rule passes. */
const EXIT_PASS = 0;
/** Exit code when the PR title lacks a ticket key. */
const EXIT_FAIL = 1;
/** Exit code for usage / argument errors. */
const EXIT_USAGE = 2;
/** Exit code when the rule cannot be measured (no PR / no gh). */
const EXIT_NOT_APPLICABLE = 3;

/**
 * Jira/Linear-style ticket key: uppercase project key, hyphen, issue number.
 * Examples: RA-42, PROJ-123, ABC-1.
 */
const TICKET_KEY_PATTERN = '[A-Z][A-Z0-9]+-\\d+';

/**
 * Optional conventional-commit type prefix before the ticket.
 * Matches `feat: `, `fix(api): `, `chore!: ` (scope and breaking `!` optional).
 */
const CONVENTIONAL_TYPE_PREFIX = '(?:[a-z]+(?:\\([^)]*\\))?!?:\\s+)';

/**
 * Full title must place a ticket key at the start, optionally after a
 * conventional type prefix, with optional surrounding brackets.
 * Word-boundary applies only to the unbracketed form — `]` is not a word
 * character, so `\b` after a closing bracket would never match.
 */
const TITLE_HAS_TICKET_RE = new RegExp(
  `^${CONVENTIONAL_TYPE_PREFIX}?(?:\\[${TICKET_KEY_PATTERN}\\]|${TICKET_KEY_PATTERN}\\b)`
);

/**
 * Return whether a PR title places a ticket key in the required position.
 *
 * @param {string} title Raw PR title from `gh pr view`.
 * @returns {boolean} True when the title is ticket-prefixed (or conventional + ticket).
 */
export function titleHasTicket(title) {
  if (typeof title !== 'string') return false;
  const trimmed = title.trim();
  if (trimmed.length === 0) return false;
  return TITLE_HAS_TICKET_RE.test(trimmed);
}

/**
 * Decide pass/fail for an already-fetched PR title (no git/gh).
 * Used by the full check after `gh pr view` and by unit tests.
 *
 * @param {string} title PR title to validate.
 * @param {{ pass: () => never, fail: (msg?: string) => never, notApplicable: (why?: string) => never }} io Outcome callbacks.
 * @returns {never}
 */
export function checkPrTitle(title, io) {
  if (titleHasTicket(title)) {
    return io.pass();
  }
  return io.fail(`PR title missing ticket key: "${title}"`);
}

/**
 * Fetch the open PR title for the current branch via the GitHub CLI.
 *
 * @param {string} appDir Working directory for `gh` (repo / app root).
 * @returns {{ ok: true, title: string } | { ok: false, reason: string }}
 */
export function fetchPrTitle(appDir) {
  let stdout = '';
  let stderr = '';
  try {
    stdout = execFileSync('gh', ['pr', 'view', '--json', 'title'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err) {
    const error = /** @type {NodeJS.ErrnoException & { stderr?: string | Buffer }} */ (err);
    if (error && error.code === 'ENOENT') {
      return { ok: false, reason: 'gh not available' };
    }
    stderr =
      typeof error?.stderr === 'string'
        ? error.stderr
        : error?.stderr
          ? String(error.stderr)
          : error instanceof Error
            ? error.message
            : String(err);
    const combined = `${stderr} ${error instanceof Error ? error.message : ''}`.toLowerCase();
    if (
      /no pull requests?\s+found/.test(combined) ||
      /no pull request/.test(combined) ||
      /could not find.*pull request/.test(combined) ||
      /no open pull requests?/.test(combined)
    ) {
      return { ok: false, reason: 'no pull request for current branch' };
    }
    // Other gh failures (auth, network, not a git repo) are also unmeasurable.
    return { ok: false, reason: 'no pull request for current branch' };
  }

  try {
    const parsed = JSON.parse(stdout);
    const title = typeof parsed?.title === 'string' ? parsed.title : '';
    return { ok: true, title };
  } catch {
    return { ok: false, reason: 'no pull request for current branch' };
  }
}

/**
 * Parse `owner/repo` out of a git remote URL (ssh or https).
 *
 * @param {string} remoteUrl Raw `git remote get-url origin` output.
 * @returns {{ owner: string, repo: string } | null}
 */
export function parseRemote(remoteUrl) {
  const m = /github\.com[/:]([^/]+)\/(.+?)(?:\.git)?\s*$/.exec(String(remoteUrl).trim());
  if (m === null) return null;
  return { owner: m[1], repo: m[2] };
}

/**
 * Fetch the PR title from the GitHub REST API.
 *
 * `gh` is not installed on every machine that runs this gate, and on the one it
 * was written for it never has been — so the rule returned "gh not available"
 * forever and quietly left the denominator. A missing CLI is a tooling gap, not
 * a property of the code being judged, and the two must not look the same.
 *
 * Asks for PRs containing the current commit first (works after a merge), then
 * for an open PR on the current branch.
 *
 * @param {string} appDir Directory to resolve git context from.
 * @param {(url: string, headers: Record<string,string>) => Promise<{ ok: boolean, json: unknown }>} httpGet Injected fetcher.
 * @returns {Promise<{ ok: true, title: string, source: string } | { ok: false, reason: string }>}
 */
export async function fetchPrTitleFromApi(appDir, httpGet) {
  const token = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'] ?? '';
  if (token.length === 0) return { ok: false, reason: 'no GITHUB_TOKEN for the PR lookup' };

  /** @param {string[]} args */
  const git = (args) => {
    try {
      return execFileSync('git', args, {
        cwd: appDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {
      return '';
    }
  };
  const remote = parseRemote(git(['remote', 'get-url', 'origin']));
  if (remote === null) return { ok: false, reason: 'no github remote' };
  const sha = git(['rev-parse', 'HEAD']);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'redanvil-gate'
  };
  const base = `https://api.github.com/repos/${remote.owner}/${remote.repo}`;

  if (sha.length > 0) {
    const res = await httpGet(`${base}/commits/${sha}/pulls`, headers);
    const list = Array.isArray(res.json) ? res.json : [];
    if (res.ok && list.length > 0 && typeof list[0]?.title === 'string') {
      return { ok: true, title: list[0].title, source: `PR #${list[0].number} for commit` };
    }
  }
  if (branch.length > 0 && branch !== 'HEAD') {
    const res = await httpGet(
      `${base}/pulls?state=all&head=${remote.owner}:${branch}&per_page=1`,
      headers
    );
    const list = Array.isArray(res.json) ? res.json : [];
    if (res.ok && list.length > 0 && typeof list[0]?.title === 'string') {
      return { ok: true, title: list[0].title, source: `PR #${list[0].number} for ${branch}` };
    }
  }
  // Reaching here means the API answered and there is genuinely no PR. That is a
  // real property of this repository (it pushes straight to master), not a
  // tooling gap, and the message says so rather than blaming a missing binary.
  return { ok: false, reason: 'repository has no pull request for this commit or branch' };
}

/**
 * Default fetcher for {@link fetchPrTitleFromApi}.
 *
 * @param {string} url Absolute URL.
 * @param {Record<string,string>} headers Request headers.
 * @returns {Promise<{ ok: boolean, json: unknown }>}
 */
async function httpGetJson(url, headers) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, json };
  } catch {
    return { ok: false, json: null };
  }
}

/**
 * Run the proc-pr-title-ticket check against appDir.
 *
 * Tries `gh` first (fastest when present), then the REST API. Only when both
 * agree there is no PR does the rule leave the denominator.
 *
 * @param {string} appDir App or repository directory.
 * @param {{ pass: () => never, fail: (msg?: string) => never, notApplicable: (why?: string) => never }} io Outcome callbacks.
 * @param {(url: string, headers: Record<string,string>) => Promise<{ ok: boolean, json: unknown }>} [httpGet] Injected fetcher (tests).
 * @returns {Promise<never>}
 */
export async function runProcPrTitleTicket(appDir, io, httpGet = httpGetJson) {
  const viaCli = fetchPrTitle(appDir);
  if (viaCli.ok) return checkPrTitle(viaCli.title, io);

  const viaApi = await fetchPrTitleFromApi(appDir, httpGet);
  if (viaApi.ok) return checkPrTitle(viaApi.title, io);

  return io.notApplicable(viaApi.reason);
}

/**
 * CLI outcome callbacks that map to process exit codes (same contract as check.mjs).
 *
 * @returns {{ pass: () => never, fail: (msg?: string) => never, notApplicable: (why?: string) => never }}
 */
function processIo() {
  return {
    pass: () => process.exit(EXIT_PASS),
    fail: (msg) => {
      if (msg) console.error(msg);
      process.exit(EXIT_FAIL);
    },
    notApplicable: (why) => {
      if (why) console.error(`n/a: ${why}`);
      process.exit(EXIT_NOT_APPLICABLE);
    }
  };
}

/**
 * True when this module is the process entrypoint (`node proc-pr-title-ticket.mjs ...`).
 *
 * @returns {boolean}
 */
function isCliMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isCliMain()) {
  const appDir = process.argv[2];
  if (!appDir) {
    console.error('usage: node proc-pr-title-ticket.mjs <appDir>');
    process.exit(EXIT_USAGE);
  }
  await runProcPrTitleTicket(appDir, processIo());
}
