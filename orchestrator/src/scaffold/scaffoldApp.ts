import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
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
  /**
   * The generated PRD for THIS app, if the caller has it.
   *
   * The job returned by `/api/submit` does not carry it — the PRD is generated
   * in the browser — so it has to be passed in. Without it the app ships only
   * the generic rule pack, and §7.3a (the layout archetype and visual direction
   * chosen for this specific product) never reaches whoever builds it.
   */
  prdMarkdown?: string;
}

export interface ScaffoldResult {
  files: string[];
  conformancePath: string;
  /** True when the output directory was initialised as a git repository. */
  gitInitialised: boolean;
  /** True when the app's own PRD was written to `PRD.md`. */
  prdIncluded: boolean;
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

  // The rule packs tell the builder to follow `design-system/mobile-design-rules.md`
  // and `screen-patterns.md`. Those files were never copied into the scaffold,
  // so every generated app pointed at two paths that did not exist — the
  // guidance was cited and unavailable at the same time.
  const designSystemDir = join(corpusDir, '..', 'design-system');
  const designRules = await readFile(join(designSystemDir, 'mobile-design-rules.md'), 'utf8');
  const screenPatterns = await readFile(join(designSystemDir, 'screen-patterns.md'), 'utf8');
  // R25 tells the builder to brief a logo from a template rather than writing one
  // from scratch. Shipping the rule without the template it names would repeat the
  // exact mistake the rule documents: guidance cited and unavailable.
  const logoBrief = await readFile(join(designSystemDir, 'logo-brief-template.md'), 'utf8');

  const files: Record<string, string> = {
    'CLAUDE.md': claudeMd,
    'conformance.json': JSON.stringify(conformance, null, 2) + '\n',
    'design-system/mobile-design-rules.md': designRules,
    'design-system/screen-patterns.md': screenPatterns,
    'design-system/logo-brief-template.md': logoBrief,
    ...(input.prdMarkdown === undefined ? {} : { 'PRD.md': input.prdMarkdown }),
    ...appFiles(job, builtAt)
  };

  for (const [rel, content] of Object.entries(files)) {
    const full = join(outDir, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }

  // A scaffold is not a repository until someone says so, and several rules
  // shell out to git. `hyg-env-ignored` runs `git check-ignore .env`, which
  // exits 128 outside a repo — so every freshly generated app failed a security
  // blocker on day one despite shipping a correct .gitignore. Initialising here
  // means the app is gate-able the moment it exists.
  const gitInitialised = initGitRepo(outDir);

  return {
    files: Object.keys(files),
    conformancePath: join(outDir, 'conformance.json'),
    gitInitialised,
    prdIncluded: input.prdMarkdown !== undefined
  };
}

/**
 * Initialise the scaffold as a git repository with one commit.
 *
 * Best effort: a machine without git still gets a working app, and the caller
 * is told it did not happen rather than being left to discover it through a
 * confusing rule failure.
 *
 * @param outDir - Directory to initialise.
 * @returns True when the repository was created and committed.
 */
function initGitRepo(outDir: string): boolean {
  const run = (args: string[]): boolean =>
    spawnSync('git', args, { cwd: outDir, stdio: 'ignore' }).status === 0;
  if (!run(['init', '-q'])) return false;
  if (!run(['add', '-A'])) return false;
  return run([
    '-c',
    'user.email=scaffold@redanvil.local',
    '-c',
    'user.name=RedAnvil scaffold',
    'commit',
    '-qm',
    'chore: scaffold from RedAnvil corpus'
  ]);
}
