/**
 * Local dispatch registry under <repo>/.redanvil/dispatch/.
 * Writes are atomic: a temp file in the same directory, then rename.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ID_PATTERN } from './constants.mjs';

/**
 * Absolute registry root for a repo.
 * @param {string} repoRoot repository root
 * @returns {string}
 */
export function registryRoot(repoRoot) {
  return join(resolve(repoRoot), '.redanvil', 'dispatch');
}

/**
 * @param {string} repoRoot repository root
 * @param {'pending'|'resolved'|'alerts'|'acked'|'jobs'|'notified'} bucket directory name
 * @returns {string}
 */
export function bucketDir(repoRoot, bucket) {
  return join(registryRoot(repoRoot), bucket);
}

/**
 * Reject an id that could escape the registry directory.
 * @param {string} id candidate filename stem
 * @returns {string} the same id when it is safe
 */
export function assertSafeId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new Error(`id must match ${ID_PATTERN} (got ${JSON.stringify(id)})`);
  }
  return id;
}

/**
 * Turn an execution id into a filename-safe fragment.
 * n8n's placeholder id is `__UNKNOWN__`, which is not filename-safe.
 * @param {string} executionId raw execution id
 * @returns {string}
 */
export function safeExecutionFragment(executionId) {
  const fragment = String(executionId ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return fragment || 'unknown';
}

/**
 * Pending-record id for one gate in one execution.
 * @param {string} slug app slug
 * @param {string} step process-map step id
 * @param {string} executionId n8n execution id
 * @returns {string}
 */
export function gateRecordId(slug, step, executionId) {
  return assertSafeId(`${slug}-${step}-${safeExecutionFragment(executionId)}`);
}

/**
 * Write JSON atomically. The temp file is in the destination directory so
 * rename does not cross devices.
 * @param {string} filePath final path
 * @param {unknown} value JSON value
 */
export function writeJsonAtomic(filePath, value) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${process.pid}-${Date.now()}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  if (existsSync(filePath)) rmSync(filePath);
  renameSync(tmp, filePath);
}

/**
 * Read one JSON file, or null when it is absent.
 * @param {string} filePath path
 * @returns {unknown}
 */
export function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Every `*.json` record in a bucket, skipping names that are not safe ids.
 * @param {string} repoRoot repository root
 * @param {'pending'|'resolved'|'alerts'|'acked'|'jobs'|'notified'} bucket directory name
 * @returns {unknown[]}
 */
export function readBucket(repoRoot, bucket) {
  const dir = bucketDir(repoRoot, bucket);
  let names = [];
  try {
    names = readdirSync(dir);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  /** @type {unknown[]} */
  const records = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    if (!ID_PATTERN.test(id)) continue;
    const value = readJson(join(dir, name));
    if (value !== null) records.push(value);
  }
  return records;
}

/**
 * Move a record from one bucket to another. The source is removed only after
 * the destination write succeeds.
 * @param {string} repoRoot repository root
 * @param {'pending'|'alerts'} from source bucket
 * @param {'resolved'|'acked'} to destination bucket
 * @param {string} id record id
 * @param {unknown} value record to write
 */
export function moveRecord(repoRoot, from, to, id, value) {
  const safe = assertSafeId(id);
  const dest = join(bucketDir(repoRoot, to), `${safe}.json`);
  writeJsonAtomic(dest, value);
  rmSync(join(bucketDir(repoRoot, from), `${safe}.json`), { force: true });
}

/**
 * Decode a `--payloadB64=` argument. The payload crosses a shell, so it is
 * base64 and never raw free text.
 * @param {string[]} argv process argv
 * @returns {Record<string, unknown>}
 */
export function payloadFromArgv(argv) {
  const raw = argv.find((arg) => arg.startsWith('--payloadB64='));
  if (!raw) throw new Error('missing --payloadB64=');
  const b64 = raw.slice('--payloadB64='.length);
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    throw new Error('--payloadB64 is not base64 JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--payloadB64 JSON must be an object');
  }
  return parsed;
}

/**
 * `--repoRoot=` from argv. Required: the registry must not guess a repo.
 * @param {string[]} argv process argv
 * @returns {string}
 */
export function repoRootFromArgv(argv) {
  const raw = argv.find((arg) => arg.startsWith('--repoRoot='));
  if (!raw) throw new Error('missing --repoRoot=');
  const value = raw.slice('--repoRoot='.length);
  if (!value) throw new Error('empty --repoRoot=');
  return resolve(value);
}
