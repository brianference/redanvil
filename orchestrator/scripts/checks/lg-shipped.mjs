#!/usr/bin/env node
/**
 * lg-shipped — an app is not finished until it is SHIPPED.
 *
 * Usage (CLI): node lg-shipped.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 2 = infra (network / no dist), 3 = n/a
 *   (no wrangler.toml AND no deployUrl — not a deployable site).
 *
 * Why: builds kept clearing the score gate and then sitting on a local disk
 * with no remote and no URL. "Done" meant "the gate passed", which is not what
 * done means. A build that never ships is indistinguishable from one that was
 * never built.
 *
 * All four must hold (fail closed on any):
 * 1. Git repo with `origin` pointing at a real GitHub URL.
 * 2. HEAD is pushed (`git rev-list origin/<branch>..HEAD` empty).
 * 3. Production URL (claims.json deployUrl or wrangler project → pages.dev)
 *    returns HTTP 200.
 * 4. Deployed `assets/index-<hash>.js` matches newest local dist asset.
 *
 * N/A is narrow: only when there is no wrangler.toml AND no deployUrl.
 * An app with wrangler.toml and no remote is a FAIL, not n/a.
 *
 * Prefer importing {@link runLgShipped} and wiring it from check.mjs.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** How long a production fetch may take before it is treated as infra failure. */
const FETCH_TIMEOUT_MS = 20_000;

/** Vite (and similar) hashed entry scripts under dist/assets/. */
const INDEX_ASSET_RE = /^index-.+\.js$/;

/** Extract the first `assets/index-<hash>.js` reference from served HTML. */
const HTML_INDEX_ASSET_RE = /(?:["'(]|^|[\s=])((?:\.?\.?\/)?assets\/index-[A-Za-z0-9_-]+\.js)/;

/**
 * True when this file was invoked directly as the Node entrypoint.
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
 * Run a git command in `cwd`. Returns stdout trimmed, or null on failure.
 *
 * @param {string} cwd Working directory (app or its enclosing repo).
 * @param {string[]} args Git argv after `git`.
 * @returns {string | null}
 */
function gitOut(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Read `.redanvil/claims.json` `deployUrl` when present and a non-empty string.
 *
 * @param {string} appDir App directory.
 * @returns {string | null}
 */
export function readDeployUrl(appDir) {
  const claimsPath = join(appDir, '.redanvil', 'claims.json');
  if (!existsSync(claimsPath)) return null;
  try {
    const raw = readFileSync(claimsPath, 'utf8');
    const data = JSON.parse(raw);
    if (typeof data.deployUrl === 'string' && data.deployUrl.trim().length > 0) {
      return data.deployUrl.trim();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Top-level `name = "..."` from wrangler.toml (the Pages project name).
 *
 * @param {string} appDir App directory.
 * @returns {string | null}
 */
export function readWranglerProjectName(appDir) {
  const wranglerPath = join(appDir, 'wrangler.toml');
  if (!existsSync(wranglerPath)) return null;
  let text;
  try {
    text = readFileSync(wranglerPath, 'utf8');
  } catch {
    return null;
  }
  // First bare `name =` at line start is the project; skip nested keys like
  // database_name by requiring the line to start with `name`.
  const m = /^name\s*=\s*["']([^"']+)["']/m.exec(text);
  return m?.[1] ?? null;
}

/**
 * Resolve the production URL from claims deployUrl or wrangler project name.
 *
 * @param {string} appDir App directory.
 * @returns {string | null}
 */
export function resolveProductionUrl(appDir) {
  // ONLY the recorded URL. Deriving `https://<wrangler name>.pages.dev` was the
  // first version and it was wrong on its first real run: app-builder's
  // wrangler.toml says name = "app-builder" while the Pages project is
  // "redanvil", so the check fetched a hostname that does not exist and reported
  // "production has no assets/index-*.js" — a confident FAIL about a site that
  // is in fact deployed and serving.
  //
  // A guessed hostname cannot prove anything either way: a 404 is
  // indistinguishable from a broken deploy, and a 200 on some unrelated project
  // would be worse. So the deploy URL has to be recorded, and an app that has
  // not recorded one is INFRA (the check cannot see), never a pass and never a
  // fabricated fail.
  return readDeployUrl(appDir);
}

/**
 * Whether a remote URL is a real GitHub remote (https, ssh, or with credentials).
 *
 * @param {string} url Remote URL from `git remote get-url`.
 * @returns {boolean}
 */
export function isGitHubRemote(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  // github.com/org/repo, git@github.com:org/repo, user@github.com/org/repo, etc.
  return /(?:^|[@/])github\.com[:/]/i.test(url);
}

/**
 * Basename of the newest `dist/assets/index-*.js` by mtime, or null.
 *
 * @param {string} appDir App directory.
 * @returns {string | null}
 */
export function newestLocalIndexAsset(appDir) {
  const assetsDir = join(appDir, 'dist', 'assets');
  if (!existsSync(assetsDir)) return null;
  let names;
  try {
    names = readdirSync(assetsDir).filter((n) => INDEX_ASSET_RE.test(n));
  } catch {
    return null;
  }
  if (names.length === 0) return null;
  let best = names[0];
  let bestMtime = -1;
  for (const name of names) {
    try {
      const m = statSync(join(assetsDir, name)).mtimeMs;
      if (m >= bestMtime) {
        bestMtime = m;
        best = name;
      }
    } catch {
      continue;
    }
  }
  return best;
}

/**
 * Extract the first `assets/index-<hash>.js` path segment from HTML.
 *
 * @param {string} html Fetched production HTML.
 * @returns {string | null} Basename only (e.g. `index-abc123.js`).
 */
export function extractDeployedIndexAsset(html) {
  const m = HTML_INDEX_ASSET_RE.exec(html);
  if (!m?.[1]) return null;
  const path = m[1].replace(/^\.\//, '');
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(slash + 1) : path;
}

/**
 * IO contract shared with check.mjs (and CLI wrappers).
 *
 * @typedef {{
 *   pass: () => never,
 *   fail: (msg?: string) => never,
 *   notApplicable: (why?: string) => never,
 *   infra: (msg?: string) => never
 * }} LgShippedIo
 */

/**
 * Run the lg-shipped check against an app directory.
 *
 * @param {string} appDir App directory (cwd for git / relative paths).
 * @param {LgShippedIo} io Exit helpers.
 * @returns {Promise<void>}
 */
export async function runLgShipped(appDir, io) {
  const hasWrangler = existsSync(join(appDir, 'wrangler.toml'));
  const deployUrl = readDeployUrl(appDir);

  // N/A is narrow: only when the app is not a deployable site at all.
  if (!hasWrangler && !deployUrl) {
    io.notApplicable('no wrangler.toml and no deployUrl — not a deployable site');
  }

  // --- 1. Git repo with origin → GitHub ------------------------------------
  const inside = gitOut(appDir, ['rev-parse', '--is-inside-work-tree']);
  if (inside !== 'true') {
    io.fail('not inside a git repository — ship requires a real GitHub remote');
  }

  const originUrl = gitOut(appDir, ['remote', 'get-url', 'origin']);
  if (originUrl === null || originUrl.length === 0) {
    io.fail('no origin remote — ship requires a GitHub repository');
  }
  if (!isGitHubRemote(originUrl)) {
    io.fail(`origin is not a GitHub URL: ${originUrl}`);
  }

  // --- 2. HEAD is pushed ---------------------------------------------------
  const branch = gitOut(appDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch === null || branch.length === 0 || branch === 'HEAD') {
    io.fail('detached HEAD or unknown branch — cannot verify that HEAD is pushed');
  }

  const remoteRef = `origin/${branch}`;
  const remoteHead = gitOut(appDir, ['rev-parse', '--verify', remoteRef]);
  if (remoteHead === null) {
    io.fail(
      `no ${remoteRef} — branch has never been pushed (remote does not contain this HEAD)`
    );
  }

  const ahead = gitOut(appDir, ['rev-list', `${remoteRef}..HEAD`]);
  if (ahead === null) {
    io.fail(`cannot compare HEAD to ${remoteRef}`);
  }
  if (ahead.length > 0) {
    const count = ahead.split('\n').filter(Boolean).length;
    io.fail(
      `${count} unpushed commit(s) on ${branch} — remote does not contain what was gated`
    );
  }

  // --- 3. Production URL returns 200 ---------------------------------------
  const prodUrl = resolveProductionUrl(appDir);
  if (!prodUrl) {
    // Infra, not fail: an unrecorded URL means this check cannot SEE whether the
    // app shipped. Calling that a failure would report a defect in the app when
    // the gap is in the record, and the fix ("write down where it deploys") is
    // not the fix a failed blocker asks for. Infra fails the run loudly and
    // names the missing input, which is the honest outcome.
    io.infra(
      `no deployUrl recorded in ${appDir}/.redanvil/claims.json — the check cannot verify ` +
        'a deploy it has no address for. Record the production URL (the bare ' +
        '<project>.pages.dev or custom domain, never a per-deploy hash URL).'
    );
  }

  let response;
  try {
    response = await fetch(prodUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'text/html,application/xhtml+xml,*/*' }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    io.infra(`cannot reach production URL ${prodUrl}: ${msg}`);
  }

  if (response.status !== 200) {
    io.fail(`production URL ${prodUrl} returned HTTP ${response.status}, expected 200`);
  }

  let html;
  try {
    html = await response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    io.infra(`cannot read body from ${prodUrl}: ${msg}`);
  }

  // --- 4. Deployed bundle hash matches local dist --------------------------
  const localAsset = newestLocalIndexAsset(appDir);
  if (!localAsset) {
    io.infra('no dist/assets/index-*.js to compare — build the app before shipping proof');
  }

  const deployedAsset = extractDeployedIndexAsset(html);
  if (!deployedAsset) {
    io.fail(
      `production HTML at ${prodUrl} has no assets/index-*.js — cannot prove the scored commit is serving`
    );
  }

  if (deployedAsset !== localAsset) {
    io.fail(
      `deployed bundle does not match local dist: serving ${deployedAsset}, local has ${localAsset} (a wrangler success message is not proof)`
    );
  }

  io.pass();
}

/**
 * CLI / check.mjs exit helpers. Exit 2 is reserved for infra (network / no dist).
 *
 * @returns {LgShippedIo}
 */
function defaultIo() {
  return {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    },
    infra: (m) => {
      if (m) console.error(`infra: ${m}`);
      process.exit(2);
    }
  };
}

if (isMainModule()) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node lg-shipped.mjs <appDir>');
    process.exit(2);
  }
  runLgShipped(dir, defaultIo()).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`infra: unexpected error: ${msg}`);
    process.exit(2);
  });
}
