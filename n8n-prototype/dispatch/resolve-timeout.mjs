#!/usr/bin/env node
/**
 * Write resolved/<id>.json for a gate whose Wait limit expired.
 * The workflow runs this from Execute Command. decision is auto-decided
 * and resolvedBy is timeout. The pending file is removed afterwards.
 *
 * Usage: node resolve-timeout.mjs --payloadB64=<base64 json> --repoRoot=<path>
 * Payload: { slug, step, executionId }
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  bucketDir,
  gateRecordId,
  moveRecord,
  payloadFromArgv,
  readJson,
  repoRootFromArgv,
  writeJsonAtomic
} from './registry.mjs';

/**
 * Record a timeout decision and drop the pending file when it is still there.
 * @param {string} repoRoot repository root
 * @param {string} slug app slug
 * @param {string} step process-map step id
 * @param {string} executionId n8n execution id
 * @param {string} [resolvedAt] ISO timestamp
 * @returns {object} the resolved record
 */
export function resolveTimeout(
  repoRoot,
  slug,
  step,
  executionId,
  resolvedAt = new Date().toISOString(),
  cycle = 0
) {
  const id = gateRecordId(slug, step, executionId, cycle);
  const record = {
    id,
    decision: 'auto-decided',
    notes: '',
    resolvedAt: new Date(resolvedAt).toISOString(),
    resolvedBy: 'timeout'
  };
  const pendingPath = join(bucketDir(repoRoot, 'pending'), `${id}.json`);
  if (readJson(pendingPath)) {
    moveRecord(repoRoot, 'pending', 'resolved', id, record);
  } else {
    writeJsonAtomic(join(bucketDir(repoRoot, 'resolved'), `${id}.json`), record);
  }
  return record;
}

/**
 * CLI entry.
 */
function main() {
  try {
    const repoRoot = repoRootFromArgv(process.argv.slice(2));
    const payload = payloadFromArgv(process.argv.slice(2));
    const slug = payload.slug;
    const step = payload.step;
    const executionId = payload.executionId;
    if (typeof slug !== 'string' || typeof step !== 'string') {
      throw new Error('payload needs slug and step');
    }
    if (typeof executionId !== 'string' && typeof executionId !== 'number') {
      throw new Error('payload needs executionId');
    }
    const record = resolveTimeout(
      repoRoot,
      slug,
      step,
      String(executionId),
      new Date().toISOString(),
      Number(payload.cycle ?? 0)
    );
    process.stdout.write(`${record.id}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`resolve-timeout: ${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
