import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
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
  /**
   * The app's own claims, as data.
   *
   * The PRD carries them as prose: §7.3a names a layout archetype and calls
   * itself binding, the YAML fence lists appType and entities, and the feature
   * table pairs each capability with its acceptance criteria. All of it was
   * computed as structure and rendered away, so nothing downstream could ask
   * whether the app does what it said. Passing the structure alongside the
   * markdown is what lets u-claims-covered exist at all.
   */
  claimsJson?: string;
}

export interface ScaffoldResult {
  files: string[];
  conformancePath: string;
  /**
   * True when the output directory was initialised as its own git repository.
   * False when nested inside an existing repo (no nested .git) or when init failed.
   */
  gitInitialised: boolean;
  /**
   * True when scaffold skipped `git init` because outDir lives inside another
   * repository. Nested repos become GITLINKs and break role worktrees.
   */
  nestedGitSkipped: boolean;
  /**
   * Explicit next step for the caller. When nestedGitSkipped, the app files
   * must be committed into the enclosing repository before PM roles run —
   * scaffold does not auto-commit into a shared tree.
   */
  commitInstruction: string;
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
  const claudeMd =
    `# ${job.slug} — build rules (inherited from RedAnvil corpus ${CORPUS_VERSION})\n\n` +
    `Read \`DONE-CHECKLIST.md\` in this directory before starting and before ` +
    `reporting anything finished. Nothing is done until every row of it has been ` +
    `measured and its evidence artifact opened. A spec, a prompt, or a plan is ` +
    `never evidence.\n\n${base15}\n\n${perApp}\n`;

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
  // u-sec-safe-href: copy the canonical scheme gate so generated apps never
  // reimplement (and drift from) the monorepo design-system helper.
  const safeHttpUrlTs = await readFile(join(designSystemDir, 'safeHttpUrl.ts'), 'utf8');
  const safeExternalLinkTsx = (await readFile(join(designSystemDir, 'SafeExternalLink.tsx'), 'utf8'))
    // Scaffold places the util under src/lib/; rewrite the relative import.
    .replace("from './safeHttpUrl'", "from '../lib/safeHttpUrl'");
  // The definition of done travels WITH the app. It was a document in the
  // orchestrator's own repo, so the builder of a generated app never saw the
  // forty conditions its work would be judged against and met them one gate
  // failure at a time. Shipping it is the difference between a requirement and
  // a surprise.
  const doneChecklist = await readFile(join(corpusDir, '..', 'docs/DONE-CHECKLIST.md'), 'utf8');

  const files: Record<string, string> = {
    'CLAUDE.md': claudeMd,
    'DONE-CHECKLIST.md': doneChecklist,
    'conformance.json': JSON.stringify(conformance, null, 2) + '\n',
    'design-system/mobile-design-rules.md': designRules,
    'design-system/screen-patterns.md': screenPatterns,
    'design-system/logo-brief-template.md': logoBrief,
    // Canonical URL scheme gate (u-sec-safe-href). Same source as monorepo design-system.
    'src/lib/safeHttpUrl.ts': safeHttpUrlTs,
    'src/components/SafeExternalLink.tsx': safeExternalLinkTsx,
    ...(input.prdMarkdown === undefined ? {} : { 'PRD.md': input.prdMarkdown }),
    ...(input.claimsJson === undefined
      ? {}
      : { '.redanvil/claims.json': input.claimsJson }),
    ...appFiles(job, builtAt)
  };

  for (const [rel, content] of Object.entries(files)) {
    const full = join(outDir, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }

  // Git setup: standalone scaffolds get their own repo so rules that shell out
  // to git (e.g. hyg-env-ignored) work on day one. When the app lives INSIDE an
  // existing repository (monorepo), never `git init` here — a nested .git turns
  // the app into a GITLINK, role worktrees check out an empty pointer, and every
  // role is refused with "not a git repository". Caller must commit the files
  // into the enclosing repo (scaffold does not auto-commit into a shared tree).
  const gitSetup = setupScaffoldGit(outDir);

  return {
    files: Object.keys(files),
    conformancePath: join(outDir, 'conformance.json'),
    gitInitialised: gitSetup.gitInitialised,
    nestedGitSkipped: gitSetup.nestedGitSkipped,
    commitInstruction: gitSetup.commitInstruction,
    prdIncluded: input.prdMarkdown !== undefined
  };
}

/**
 * Walk parents of dir looking for a .git entry (directory or file for worktrees).
 *
 * @param dir - Starting directory (absolute or relative).
 * @returns Absolute path of the enclosing git root, or null when none.
 */
export function findEnclosingGitRoot(dir: string): string | null {
  let cur = resolve(dir);
  // Cap walks so a weird volume root cannot spin forever.
  for (let i = 0; i < 64; i += 1) {
    const gitEntry = join(cur, '.git');
    if (existsSync(gitEntry)) {
      return cur;
    }
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
  return null;
}

/**
 * Decide whether to init a nested repo and return explicit caller instructions.
 *
 * @param outDir - Scaffold output directory.
 * @returns Init flags and a commit instruction the CLI/caller must surface.
 */
function setupScaffoldGit(outDir: string): {
  gitInitialised: boolean;
  nestedGitSkipped: boolean;
  commitInstruction: string;
} {
  const absOut = resolve(outDir);
  const enclosing = findEnclosingGitRoot(absOut);

  // Nested: outDir is strictly inside another repo (not the root of one).
  if (enclosing !== null && resolve(enclosing) !== absOut) {
    return {
      gitInitialised: false,
      nestedGitSkipped: true,
      commitInstruction:
        `Scaffold wrote files under existing repository ${enclosing}. ` +
        `Do NOT expect a nested .git here. Commit the new app into that repository ` +
        `before running PM roles (e.g. git add ${absOut} && git commit -m "chore: scaffold app") ` +
        `so role worktrees see the app tree. Scaffold does not auto-commit into a shared tree.`
    };
  }

  // Standalone (no enclosing repo, or outDir is itself a git root): init + commit.
  const gitInitialised = initStandaloneGitRepo(absOut);
  if (gitInitialised) {
    return {
      gitInitialised: true,
      nestedGitSkipped: false,
      commitInstruction:
        'Scaffold initialised a standalone git repository and created the first commit. ' +
        'The app is gate-able as its own repo.'
    };
  }
  return {
    gitInitialised: false,
    nestedGitSkipped: false,
    commitInstruction:
      'Scaffold could not initialise git (git missing or init failed). ' +
      'Run git init && git add -A && git commit in the app directory before gating.'
  };
}

/**
 * Initialise the scaffold as a standalone git repository with one commit.
 *
 * Best effort: a machine without git still gets a working app, and the caller
 * is told it did not happen rather than being left to discover it through a
 * confusing rule failure.
 *
 * @param outDir - Directory to initialise (must NOT sit inside another repo).
 * @returns True when the repository was created and committed.
 */
function initStandaloneGitRepo(outDir: string): boolean {
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
