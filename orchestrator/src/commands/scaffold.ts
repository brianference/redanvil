import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseByKind } from '../schemas/index';
import { ValidationError } from '../errors';
import { scaffoldApp } from '../scaffold/scaffoldApp';
import { engageTeamAfterScaffold } from '../team/registerManagedApp';

/**
 * Success shape for scaffold -- includes team engagement so a new app is never
 * left as a bare directory the engineer can hand-build past the design roles.
 */
export interface ScaffoldCommandOk {
  ok: true;
  files: number;
  prdIncluded: boolean;
  /** True when a nested .git was intentionally not created. */
  nestedGitSkipped: boolean;
  /** Explicit commit / git next step (always set; caller must surface it). */
  commitInstruction: string;
  /** PM command that is the only supported build entry after scaffold. */
  nextCommand: string;
  /** Lines describing team registration (for the CLI to print). */
  teamMessages: string[];
}

/**
 * Validates a job file and scaffolds a compliant app skeleton at `outDir`.
 * `corpusDir` is the repo's `rules/` directory. Never throws for validation
 * failures; returns the issues instead.
 *
 * After a successful scaffold, engages the managed team process: registers the
 * app for the gate/PM, writes `.redanvil/team.json` with the PM as entry point,
 * and blocks hand-building until design roles have run.
 */
export async function scaffoldFromJobFile(
  jobPath: string,
  outDir: string,
  corpusDir: string,
  builtAt: string,
  prdMarkdown?: string
): Promise<ScaffoldCommandOk | { ok: false; issues: string[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(jobPath, 'utf8'));
  } catch (err) {
    return { ok: false, issues: [`could not read/parse ${jobPath}: ${(err as Error).message}`] };
  }
  try {
    const parsed = parseByKind('job', raw);
    if (parsed.kind !== 'job') return { ok: false, issues: ['payload is not a job'] };
    const result = await scaffoldApp({
      job: parsed.value,
      outDir,
      corpusDir,
      builtAt,
      prdMarkdown
    });

    // Monorepo root is two levels above orchestrator/src (corpus is rules/).
    const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const team = engageTeamAfterScaffold({
      outDir,
      slug: parsed.value.slug,
      monorepoRoot
    });

    return {
      ok: true,
      files: result.files.length,
      prdIncluded: result.prdIncluded,
      nestedGitSkipped: result.nestedGitSkipped,
      commitInstruction: result.commitInstruction,
      nextCommand: team.nextCommand,
      // Lead with the git/commit instruction so nested scaffolds never look ready
      // for PM roles before the enclosing repo has the app on HEAD.
      teamMessages: [result.commitInstruction, ...team.messages]
    };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, issues: err.issues };
    throw err;
  }
}
