#!/usr/bin/env node
/**
 * Write a pending gate record. Invoked by the workflow's Execute Command
 * node, never by a Code node: the registry is on disk.
 *
 * Usage: node register-gate.mjs --payloadB64=<base64 json> --repoRoot=<path>
 * Payload: { slug, step, title, summary, resumeUrl, executionId }
 */
import { pathToFileURL } from 'node:url';
import { GATE_TTL_MS, ID_PATTERN } from './constants.mjs';
import { optionsForStep } from './options.mjs';
import {
  assertSafeId,
  bucketDir,
  gateRecordId,
  moveRecord,
  payloadFromArgv,
  readBucket,
  repoRootFromArgv,
  writeJsonAtomic
} from './registry.mjs';
import { join } from 'node:path';

/**
 * @param {unknown} value candidate
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Build the pending record. Throws when the payload cannot make a
 * contract-valid gate (no file is written by the caller in that case).
 * @param {Record<string, unknown>} payload decoded payload
 * @param {string} repoRoot repository root
 * @param {string} createdAt ISO timestamp
 * @returns {object}
 */
export function buildGateRecord(payload, repoRoot, createdAt) {
  const slug = payload.slug;
  const step = payload.step;
  const title = payload.title;
  const summary = payload.summary;
  const resumeUrl = payload.resumeUrl;
  const executionId = payload.executionId;
  if (!isNonEmptyString(slug) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
    throw new Error('slug must match /^[a-z0-9][a-z0-9-]{0,63}$/');
  }
  if (!isNonEmptyString(step) || !ID_PATTERN.test(step)) {
    throw new Error('step must be a filename-safe id');
  }
  if (!isNonEmptyString(title)) throw new Error('title is required');
  if (typeof summary !== 'string') throw new Error('summary is required');
  if (!isNonEmptyString(resumeUrl)) throw new Error('resumeUrl is required');
  let parsed;
  try {
    parsed = new URL(resumeUrl);
  } catch {
    throw new Error('resumeUrl is not a URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('resumeUrl must be http(s)');
  }
  if (typeof executionId !== 'string' && typeof executionId !== 'number') {
    throw new Error('executionId is required');
  }
  const id = gateRecordId(slug, step, String(executionId), Number(payload.cycle ?? 0));
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) throw new Error('createdAt is not a date');
  return {
    id,
    kind: 'gate',
    createdAt: created.toISOString(),
    expiresAt: new Date(created.getTime() + GATE_TTL_MS).toISOString(),
    slug,
    title,
    summary,
    options: optionsForStep(repoRoot, slug, step),
    resume: { type: 'n8n-form', url: resumeUrl },
    onTimeout: 'auto-decide',
    executionId: String(executionId)
  };
}

/**
 * Retire pending gates of the same execution before registering a new one.
 *
 * An n8n execution waits on one form at a time, and its resume URL is per
 * execution. A gate answered directly through the form (not through dispatch)
 * left its pending record behind, and a later `resolve` of that stale record
 * would have posted its decision into whatever gate the execution waits on now.
 *
 * @param {string} repoRoot repository root
 * @param {string} executionId n8n execution id
 * @param {string} keepId the gate being registered
 * @param {string} now ISO timestamp
 */
function supersedeOlderGates(repoRoot, executionId, keepId, now) {
  for (const old of readBucket(repoRoot, 'pending')) {
    if (!old || typeof old !== 'object') continue;
    if (old.kind !== 'gate' || old.executionId !== executionId || old.id === keepId) continue;
    moveRecord(repoRoot, 'pending', 'resolved', old.id, {
      id: old.id,
      decision: 'superseded',
      notes: `a later gate (${keepId}) was registered for execution ${executionId}`,
      resolvedAt: now,
      resolvedBy: 'owner'
    });
  }
}

/**
 * Write the record and return it.
 * @param {Record<string, unknown>} payload decoded payload
 * @param {string} repoRoot repository root
 * @param {string} [now] ISO timestamp, defaults to now
 * @returns {object}
 */
export function registerGate(payload, repoRoot, now = new Date().toISOString()) {
  const record = buildGateRecord(payload, repoRoot, now);
  assertSafeId(record.id);
  supersedeOlderGates(repoRoot, record.executionId, record.id, now);
  writeJsonAtomic(join(bucketDir(repoRoot, 'pending'), `${record.id}.json`), record);
  return record;
}

/**
 * CLI entry. Exits 1 on a bad payload and writes nothing.
 */
function main() {
  try {
    const repoRoot = repoRootFromArgv(process.argv.slice(2));
    const payload = payloadFromArgv(process.argv.slice(2));
    const record = registerGate(payload, repoRoot);
    process.stdout.write(`${record.id}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`register-gate: ${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
