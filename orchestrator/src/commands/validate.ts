import { readFile } from 'node:fs/promises';
import { parseByKind } from '../schemas/index';
import { ValidationError } from '../errors';

/** Reads a JSON payload file and validates it by its `kind` field. Never throws for validation failures. */
export async function validateFile(
  path: string
): Promise<{ ok: true; kind: string } | { ok: false; issues: string[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    return { ok: false, issues: [`could not read/parse ${path}: ${(err as Error).message}`] };
  }
  const kind = (raw as { kind?: unknown }).kind;
  if (typeof kind !== 'string') {
    return { ok: false, issues: ['payload is missing a string "kind" field'] };
  }
  try {
    const parsed = parseByKind(kind, raw);
    return { ok: true, kind: parsed.kind };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, issues: err.issues };
    throw err;
  }
}
