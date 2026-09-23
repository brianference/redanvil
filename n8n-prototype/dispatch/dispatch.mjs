#!/usr/bin/env node
/**
 * Owner dispatch CLI. The long-lived Claude session calls this; it does not
 * decide on its own.
 *
 *   node dispatch.mjs list [--json] [--repoRoot=path]
 *   node dispatch.mjs gallery <id> --out <file.html> [--repoRoot=path]
 *   node dispatch.mjs resolve <id> approve|redo|reject [--notes "..."] [--repoRoot=path]
 *   node dispatch.mjs ack <alertId> [--repoRoot=path]
 *
 * Free-text notes are an argv element and then an HTTP body field. They are
 * never placed in a shell command. The runner token is not read.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { GATE_DECISIONS, JOB_DECISIONS, TERMINAL_JOB_STATUSES } from './constants.mjs';
import { submitGateForm } from './form-post.mjs';
import { galleryHtml } from './gallery.mjs';
import {
  assertSafeId,
  bucketDir,
  moveRecord,
  readBucket,
  readJson
} from './registry.mjs';
import { join } from 'node:path';

/**
 * Repo root: --repoRoot wins, then REDANVIL_REPO, then this repo
 * (dispatch/ is n8n-prototype/dispatch, two levels down).
 * @param {string[]} argv command argv without node and script
 * @returns {string}
 */
export function resolveRepoRoot(argv) {
  const flag = argv.find((arg) => arg.startsWith('--repoRoot='));
  if (flag) return resolve(flag.slice('--repoRoot='.length));
  if (process.env.REDANVIL_REPO) return resolve(process.env.REDANVIL_REPO);
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/**
 * Value of a `--name value` or `--name=value` flag.
 * @param {string[]} argv command argv
 * @param {string} name flag name without dashes
 * @returns {string | undefined}
 */
function flagValue(argv, name) {
  const eq = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const next = argv[index + 1];
  if (next === undefined || next.startsWith('--')) {
    throw new Error(`--${name} needs a value`);
  }
  return next;
}

/**
 * @param {unknown} record parsed JSON
 * @returns {record is { id: string, status?: string }}
 */
function isJobRecord(record) {
  return !!record && typeof record === 'object' && 'id' in record;
}

/**
 * Pending records, unacked alerts, and in-flight jobs.
 * @param {string} repoRoot repository root
 * @returns {{ pending: unknown[], alerts: unknown[], jobs: unknown[] }}
 */
export function listDispatch(repoRoot) {
  const jobs = readBucket(repoRoot, 'jobs').filter((record) => {
    if (!isJobRecord(record)) return false;
    const status = 'status' in record ? record.status : undefined;
    if (typeof status !== 'string') return true;
    return !TERMINAL_JOB_STATUSES.has(status);
  });
  return {
    pending: readBucket(repoRoot, 'pending'),
    alerts: readBucket(repoRoot, 'alerts'),
    jobs
  };
}

/**
 * Text form of list. Omits resume URLs; those stay in the JSON form and in
 * the pending file, which resolve reads itself.
 * @param {{ pending: unknown[], alerts: unknown[], jobs: unknown[] }} snapshot list result
 * @returns {string}
 */
export function formatList(snapshot) {
  const lines = [];
  lines.push(`pending ${snapshot.pending.length}`);
  for (const record of snapshot.pending) {
    if (!record || typeof record !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (record);
    lines.push(
      `  ${row.id}  ${row.kind}  ${row.title ?? ''}  expires ${row.expiresAt ?? 'none'}`
    );
  }
  lines.push(`alerts ${snapshot.alerts.length}`);
  for (const record of snapshot.alerts) {
    if (!record || typeof record !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (record);
    lines.push(`  ${row.id}  ${row.source}  ${row.message}`);
  }
  lines.push(`jobs ${snapshot.jobs.length}`);
  for (const record of snapshot.jobs) {
    if (!record || typeof record !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (record);
    lines.push(`  ${row.id}  ${row.status ?? 'unknown'}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Write the gallery for a pending id. Refuses over the size limit and does
 * not create the output file in that case.
 * @param {string} repoRoot repository root
 * @param {string} id pending record id
 * @param {string} outPath destination HTML path
 * @returns {string} the HTML that was written
 */
export function writeGallery(repoRoot, id, outPath) {
  const safe = assertSafeId(id);
  const pending = readJson(join(bucketDir(repoRoot, 'pending'), `${safe}.json`));
  if (!pending || typeof pending !== 'object') {
    throw new Error(`no pending record ${safe}`);
  }
  const html = galleryHtml(pending, repoRoot);
  const dest = resolve(outPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, html);
  return html;
}

/**
 * Resolve a pending record.
 * A gate is posted to its n8n form, then the resolved file is written.
 * A job-approval only writes the resolved file. reject is refused for gates.
 * @param {string} repoRoot repository root
 * @param {string} id pending record id
 * @param {string} decision approve, redo, or reject
 * @param {string} notes free text, stored and posted byte for byte
 * @param {typeof fetch} [fetchImpl] injectable fetch
 * @returns {Promise<object>} the resolved record
 */
export async function resolveDispatch(repoRoot, id, decision, notes, fetchImpl = fetch) {
  const safe = assertSafeId(id);
  const pendingPath = join(bucketDir(repoRoot, 'pending'), `${safe}.json`);
  const pending = readJson(pendingPath);
  if (!pending || typeof pending !== 'object') {
    throw new Error(`no pending record ${safe}`);
  }
  const record = /** @type {Record<string, unknown>} */ (pending);
  if (record.kind === 'gate') {
    if (!GATE_DECISIONS.has(decision)) {
      throw new Error(`reject is not valid for a gate (got ${decision})`);
    }
    const resume = record.resume;
    if (!resume || typeof resume !== 'object' || !('url' in resume) || typeof resume.url !== 'string') {
      throw new Error(`gate ${safe} has no resume url`);
    }
    const posted = await submitGateForm(resume.url, decision, notes, fetchImpl);
    if (!posted.ok) {
      throw new Error(`form post failed: HTTP ${posted.status}`);
    }
  } else if (record.kind === 'job-approval') {
    if (!JOB_DECISIONS.has(decision)) {
      throw new Error(`decision must be approve, redo, or reject (got ${decision})`);
    }
  } else {
    throw new Error(`unknown pending kind ${String(record.kind)}`);
  }
  const resolved = {
    id: safe,
    decision,
    notes,
    resolvedAt: new Date().toISOString(),
    resolvedBy: 'owner'
  };
  moveRecord(repoRoot, 'pending', 'resolved', safe, resolved);
  return resolved;
}

/**
 * Move an alert to acked/.
 * @param {string} repoRoot repository root
 * @param {string} alertId alert id
 * @returns {object}
 */
export function ackAlert(repoRoot, alertId) {
  const safe = assertSafeId(alertId);
  const alert = readJson(join(bucketDir(repoRoot, 'alerts'), `${safe}.json`));
  if (!alert || typeof alert !== 'object') throw new Error(`no alert ${safe}`);
  moveRecord(repoRoot, 'alerts', 'acked', safe, alert);
  return alert;
}

/**
 * CLI entry.
 * @param {string[]} argv command argv without node and script
 * @returns {Promise<number>} exit code
 */
export async function runDispatch(argv) {
  const [command, ...rest] = argv.filter((arg) => arg !== '--json');
  const repoRoot = resolveRepoRoot(argv);
  if (command === 'list') {
    const snapshot = listDispatch(repoRoot);
    if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    else process.stdout.write(formatList(snapshot));
    return 0;
  }
  if (command === 'gallery') {
    const id = rest.find((arg) => !arg.startsWith('--'));
    const outPath = flagValue(argv, 'out');
    if (!id || !outPath) throw new Error('usage: gallery <id> --out <file.html>');
    writeGallery(repoRoot, id, outPath);
    process.stdout.write(`${resolve(outPath)}\n`);
    return 0;
  }
  if (command === 'resolve') {
    const positional = [];
    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index];
      if (arg === '--notes') {
        index += 1;
        continue;
      }
      if (arg.startsWith('--')) continue;
      positional.push(arg);
    }
    const id = positional[0];
    const decision = positional[1];
    if (!id || !decision) throw new Error('usage: resolve <id> approve|redo|reject [--notes "..."]');
    const notes = flagValue(argv, 'notes') ?? '';
    await resolveDispatch(repoRoot, id, decision, notes);
    process.stdout.write(`${id} ${decision}\n`);
    return 0;
  }
  if (command === 'ack') {
    const id = rest.find((arg) => !arg.startsWith('--'));
    if (!id) throw new Error('usage: ack <alertId>');
    ackAlert(repoRoot, id);
    process.stdout.write(`${id}\n`);
    return 0;
  }
  throw new Error('usage: list [--json] | gallery <id> --out <file> | resolve <id> approve|redo|reject [--notes] | ack <alertId>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDispatch(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`dispatch: ${message}\n`);
      process.exitCode = 1;
    });
}
