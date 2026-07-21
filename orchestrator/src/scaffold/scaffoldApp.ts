import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { Job } from '../schemas/job';
import { CORPUS_VERSION } from '../corpus/version';
import { loadRubric } from '../rubric/index';
import { appFiles } from './templates';

export interface ScaffoldInput {
  job: Job;
  outDir: string;
  /** Path to the repo's `rules/` directory, source of the injected CLAUDE.md content. */
  corpusDir: string;
  /** ISO timestamp for the conformance manifest; injected so callers control the clock. */
  builtAt: string;
}

export interface ScaffoldResult {
  files: string[];
  conformancePath: string;
}

/**
 * Generates a corpus-compliant Cloudflare app skeleton from a validated job:
 * the required pages, a token-driven theme, Web Crypto auth, a D1 wrangler config,
 * a CLAUDE.md carrying the base-15 plus the per-app pack, and a conformance
 * manifest recording the corpus version it was built against (design §8).
 */
export async function scaffoldApp(input: ScaffoldInput): Promise<ScaffoldResult> {
  const { job, outDir, corpusDir, builtAt } = input;

  const base15 = await readFile(join(corpusDir, 'base-15.md'), 'utf8');
  const perApp = await readFile(join(corpusDir, 'per-app-pack.md'), 'utf8');
  const claudeMd = `# ${job.slug} — build rules (inherited from RedAnvil corpus ${CORPUS_VERSION})\n\n${base15}\n\n${perApp}\n`;

  const conformance = {
    kind: 'conformance' as const,
    slug: job.slug,
    corpusVersion: CORPUS_VERSION,
    builtAt,
    ruleCount: loadRubric().length
  };

  const files: Record<string, string> = {
    'CLAUDE.md': claudeMd,
    'conformance.json': JSON.stringify(conformance, null, 2) + '\n',
    ...appFiles(job)
  };

  for (const [rel, content] of Object.entries(files)) {
    const full = join(outDir, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }

  return { files: Object.keys(files), conformancePath: join(outDir, 'conformance.json') };
}
