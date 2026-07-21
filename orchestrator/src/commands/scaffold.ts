import { readFile } from 'node:fs/promises';
import { parseByKind } from '../schemas/index';
import { ValidationError } from '../errors';
import { scaffoldApp } from '../scaffold/scaffoldApp';

/**
 * Validates a job file and scaffolds a compliant app skeleton at `outDir`.
 * `corpusDir` is the repo's `rules/` directory. Never throws for validation
 * failures; returns the issues instead.
 */
export async function scaffoldFromJobFile(
  jobPath: string,
  outDir: string,
  corpusDir: string,
  builtAt: string
): Promise<{ ok: true; files: number } | { ok: false; issues: string[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(jobPath, 'utf8'));
  } catch (err) {
    return { ok: false, issues: [`could not read/parse ${jobPath}: ${(err as Error).message}`] };
  }
  try {
    const parsed = parseByKind('job', raw);
    if (parsed.kind !== 'job') return { ok: false, issues: ['payload is not a job'] };
    const result = await scaffoldApp({ job: parsed.value, outDir, corpusDir, builtAt });
    return { ok: true, files: result.files.length };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, issues: err.issues };
    throw err;
  }
}
