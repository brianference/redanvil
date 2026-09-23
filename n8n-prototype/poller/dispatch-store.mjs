/**
 * Atomic reads and writes for `.redanvil/dispatch/`.
 *
 * The registry is gitignored. Pending job approvals, owner resolutions and the
 * per-job idempotency record all live here. A crash mid-write must not leave a
 * half file that the next cycle treats as a decision, so each write lands in
 * the same directory and is renamed into place.
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Filename stem the contract allows for pending ids. */
const DISPATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;

/**
 * Dispatch directories for one repo.
 * @param {string} repoRoot repository root
 * @returns {{root: string, pending: string, resolved: string, jobs: string, alerts: string}}
 */
export function dispatchPaths(repoRoot) {
  const root = join(repoRoot, '.redanvil', 'dispatch');
  return {
    root,
    pending: join(root, 'pending'),
    resolved: join(root, 'resolved'),
    jobs: join(root, 'jobs'),
    alerts: join(root, 'alerts')
  };
}

/**
 * True when `name` is safe to use as a single path segment.
 * @param {string} name filename stem
 * @returns {boolean}
 */
export function isDispatchId(name) {
  return DISPATCH_ID_PATTERN.test(name);
}

/**
 * Write JSON atomically: temp file in the destination directory, then rename.
 * @param {string} dir destination directory
 * @param {string} filename file name, not a path
 * @param {unknown} value JSON value
 */
export function writeJsonAtomic(dir, filename, value) {
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error(`refusing to write a dispatch path: ${filename}`);
  }
  mkdirSync(dir, { recursive: true });
  const finalPath = join(dir, filename);
  const tmpPath = join(dir, `.${filename}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
  writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`);
  try {
    renameSync(tmpPath, finalPath);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
    if (code === 'EPERM' || code === 'EEXIST') {
      rmSync(finalPath, { force: true });
      renameSync(tmpPath, finalPath);
      return;
    }
    rmSync(tmpPath, { force: true });
    throw err;
  }
}

/**
 * Read one JSON file. Missing or unreadable returns null — a corrupt record
 * must not kill the cycle.
 * @param {string} path file path
 * @returns {unknown}
 */
export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * JSON files in a directory, ignoring temp files.
 * @param {string} dir directory
 * @returns {string[]} absolute paths
 */
function jsonFiles(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith('.json') && !name.startsWith('.'))
    .map((name) => join(dir, name));
}

/**
 * Store bound to one repo root.
 * @param {string} repoRoot repository root
 */
export function createDispatchStore(repoRoot) {
  const paths = dispatchPaths(repoRoot);

  return {
    paths,

    /**
     * Write a pending owner record.
     * @param {object} record pending contract object
     */
    writePending(record) {
      if (!isDispatchId(record.id)) {
        throw new Error(`pending id is not filename-safe: ${record.id}`);
      }
      writeJsonAtomic(paths.pending, `${record.id}.json`, record);
    },

    /**
     * Write the per-job idempotency record.
     * @param {object} record job record; `record.fileId` is the filename stem
     */
    writeJob(record) {
      if (!isDispatchId(record.fileId)) {
        throw new Error(`job file id is not filename-safe: ${record.fileId}`);
      }
      writeJsonAtomic(paths.jobs, `${record.fileId}.json`, record);
    },

    /**
     * @returns {object[]} job records
     */
    listJobs() {
      return jsonFiles(paths.jobs)
        .map((path) => readJson(path))
        .filter((value) => value && typeof value === 'object');
    },

    /**
     * @param {string} fileId filename stem
     * @returns {object|null}
     */
    readJob(fileId) {
      if (!isDispatchId(fileId)) return null;
      const value = readJson(join(paths.jobs, `${fileId}.json`));
      return value && typeof value === 'object' ? value : null;
    },

    /**
     * Owner decisions. The pending file is already gone by the time this exists.
     * @returns {object[]}
     */
    listResolved() {
      return jsonFiles(paths.resolved)
        .map((path) => readJson(path))
        .filter((value) => value && typeof value === 'object' && typeof value.id === 'string');
    }
  };
}
