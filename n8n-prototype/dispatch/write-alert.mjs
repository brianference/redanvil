#!/usr/bin/env node
/**
 * Write alerts/<id>.json for a failed build execution.
 * The error workflow runs this from Execute Command.
 *
 * Usage: node write-alert.mjs --payloadB64=<base64 json> --repoRoot=<path>
 * Payload: { executionId, source, message, ref }
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ID_PATTERN } from './constants.mjs';
import {
  assertSafeId,
  bucketDir,
  payloadFromArgv,
  repoRootFromArgv,
  safeExecutionFragment,
  writeJsonAtomic
} from './registry.mjs';

/**
 * Build an alert id from an execution id. Stable for one execution so a
 * repeat failure overwrites rather than stacking unread copies.
 * @param {string} executionId n8n execution id
 * @returns {string}
 */
export function alertIdForExecution(executionId) {
  const id = `alert-${safeExecutionFragment(executionId)}`;
  if (!ID_PATTERN.test(id)) throw new Error(`alert id ${id} is not filename-safe`);
  return id;
}

/**
 * Write the alert record.
 * @param {string} repoRoot repository root
 * @param {{ executionId: string, source: string, message: string, ref: string | null }} payload fields
 * @param {string} [at] ISO timestamp
 * @returns {object}
 */
export function writeAlert(repoRoot, payload, at = new Date().toISOString()) {
  if (typeof payload.source !== 'string' || !payload.source) {
    throw new Error('source is required');
  }
  if (typeof payload.message !== 'string' || !payload.message) {
    throw new Error('message is required');
  }
  if (payload.ref !== null && typeof payload.ref !== 'string') {
    throw new Error('ref must be a string or null');
  }
  const id = assertSafeId(alertIdForExecution(payload.executionId));
  const record = {
    id,
    at: new Date(at).toISOString(),
    source: payload.source,
    message: payload.message,
    ref: payload.ref
  };
  writeJsonAtomic(join(bucketDir(repoRoot, 'alerts'), `${id}.json`), record);
  return record;
}

/**
 * CLI entry.
 */
function main() {
  try {
    const repoRoot = repoRootFromArgv(process.argv.slice(2));
    const payload = payloadFromArgv(process.argv.slice(2));
    const executionId = payload.executionId;
    const source = payload.source;
    const message = payload.message;
    const ref = payload.ref ?? null;
    if (typeof executionId !== 'string' && typeof executionId !== 'number') {
      throw new Error('payload needs executionId');
    }
    if (typeof source !== 'string' || typeof message !== 'string') {
      throw new Error('payload needs source and message');
    }
    const record = writeAlert(repoRoot, {
      executionId: String(executionId),
      source,
      message,
      ref: ref === null ? null : String(ref)
    });
    process.stdout.write(`${record.id}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`write-alert: ${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
