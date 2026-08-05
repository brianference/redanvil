/**
 * Execute one assigned role — the half of the PM loop that was missing.
 *
 * `runPm` has always been a conductor with no orchestra: it plans assignments,
 * then calls `deps.runRole(...)`, and nothing in the repo implemented that
 * function. So the entire left half of the pipeline (brainstorm → logo → layout
 * → engineer → content → testwriter) had a planner, a registry, artifact
 * contracts and enforcement, and no way to actually run a role.
 *
 * THE ONE RULE THIS FILE ENFORCES, from `roles.ts`'s own docstring: a role that
 * returns without its artifacts counts as NOT RUN. The agent's exit code and its
 * summary are both claims. Files on disk are the evidence. `countedAsRun` is
 * decided by `missingArtifacts`, never by what the CLI said about itself — that
 * distinction is the whole reason the artifact contract exists.
 *
 * The grok invocation mirrors `independent_judge.mjs`, including two hard-won
 * details: the brief goes in a FILE because passing it as an argument exceeded
 * the Windows command-line limit and grok exited 1 with no output, and each
 * argument is quoted by hand because Node's `shell: true` re-splits a multi-word
 * prompt.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expandArtifacts, type Role, type RoleId } from './roles';
import { missingArtifacts } from './worktreeEnforcement';
import { observeIsolation } from '../loop/runRules';

/**
 * Thrown when a worktree-required role is asked to run outside a linked worktree.
 *
 * This is not a soft warning. A human once left shell cwd inside a worktree and
 * leaked 27 absolute worktree paths into committed evidence. Enforcement makes
 * that unrepeatable rather than remembered.
 */
export class RoleWorktreeError extends Error {
  /**
   * @param message - Why the run was refused.
   */
  constructor(message: string) {
    super(message);
    this.name = 'RoleWorktreeError';
  }
}

/**
 * Fail loudly when a role that requires a worktree is given a non-worktree dir.
 *
 * A linked worktree has `--git-dir` different from `--git-common-dir`. The live
 * main tree does not. Roles with `needsWorktree: false` (pm, brainstorm, …)
 * skip this check.
 *
 * @param role - Registry role.
 * @param workDir - Directory the agent would run in.
 * @throws {RoleWorktreeError} When isolation cannot be observed.
 */
export function assertRoleWorkDir(role: Role, workDir: string): void {
  if (!role.needsWorktree) return;
  const isolation = observeIsolation(workDir);
  if (!isolation.observed || !isolation.isolated) {
    throw new RoleWorktreeError(
      `role ${role.id} requires a linked git worktree distinct from the main tree; ` +
        `workDir=${workDir} (${isolation.reason}). Refusing to run outside a worktree — ` +
        'absolute worktree paths must never leak into committed evidence because cwd was wrong.'
    );
  }
}

/** A row this role has been asked to move. */
export interface AssignedRow {
  id: string;
  status: string;
  detail?: string;
}

/** The assignment handed to a role for one iteration. */
export interface RunRoleAssignment {
  role: Role;
  rows: ReadonlyArray<AssignedRow>;
  matchedOwns?: readonly string[];
}

/** Where and how the role runs. */
export interface RunRoleContext {
  /** Directory the agent works in: a worktree, or the app dir for read-only roles. */
  workDir: string;
  /** App slug, used to expand `<slug>` in artifact templates. */
  slug: string;
  /** Wall-clock ceiling for one role. */
  timeoutSec?: number;
}

/** Injectable side effects, so tests never shell out to a real agent. */
export interface RunRoleDeps {
  /** Spawn a process. Defaults to a real grok invocation. */
  spawn?: (
    cmd: string,
    args: string[],
    opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number; shell?: boolean }
  ) => { code: number; out: string };
  /** Write the brief. Defaults to the filesystem. */
  writeBrief?: (path: string, body: string) => void;
  /** Session id generator, so a test can assert determinism. */
  sessionId?: () => string;
}

/** What actually happened, decided by artifacts rather than by the agent. */
export interface RunRoleResult {
  role: RoleId;
  /** Process exit code. A claim, not evidence. */
  exitCode: number;
  /** Declared artifacts that are absent or empty after the run. */
  missing: string[];
  /**
   * True ONLY when the process succeeded AND every declared artifact exists.
   * A role that returns without its artifacts counts as not run.
   */
  countedAsRun: boolean;
  /** Human-readable why. */
  reason: string;
  /** Trailing agent output, for diagnosis. Never used to decide the outcome. */
  output: string;
}

/** Default ceiling for one role. */
export const DEFAULT_ROLE_TIMEOUT_SEC = 900;

/**
 * Build the single-job brief handed to the agent playing this role.
 *
 * Names the artifacts explicitly, because "produce something useful" is how a
 * role returns a summary and no file.
 *
 * @param assignment - Role plus the unmet rows it owns.
 * @param slug - App slug for artifact expansion.
 * @returns Markdown brief.
 */
export function buildRoleBrief(assignment: RunRoleAssignment, slug: string): string {
  const artifacts = expandArtifacts(assignment.role.artifacts, slug);
  const rows = assignment.rows
    .map((r) => `- ${r.id} (${r.status})${r.detail ? ` — ${r.detail}` : ''}`)
    .join('\n');
  return [
    `# Role: ${assignment.role.id}`,
    '',
    // The prompt seed carries <slug> placeholders too, not just the artifact
    // paths. Expanding only the artifacts shipped a literal "<slug>" into the
    // agent's instructions — caught by asserting the brief contains none.
    assignment.role.prompt.replaceAll('<slug>', slug),
    '',
    '## Rows you own that are currently unmet',
    rows.length > 0 ? rows : '- (none listed)',
    '',
    '## Artifacts you MUST leave on disk',
    ...artifacts.map((a) => `- ${a}`),
    '',
    'A summary is not a deliverable. This run is judged ONLY by whether the',
    'files above exist and are non-empty when you exit. If you cannot produce',
    'one, say so plainly and leave it absent — do not write a placeholder, and',
    'do not claim completion you cannot evidence.',
    ''
  ].join('\n');
}

/**
 * Environment with anything credential-shaped removed.
 *
 * A role never needs secrets and must not see them.
 *
 * @param env - Source environment.
 * @returns Scrubbed copy.
 */
export function scrubEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  for (const k of Object.keys(out)) {
    if (/TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL/i.test(k)) delete out[k];
  }
  return out;
}

/**
 * Default spawn: the grok CLI, headless, in the role's working directory.
 *
 * @param cmd - Command.
 * @param args - Arguments.
 * @param opts - Spawn options.
 * @returns Exit code and combined output.
 */
function defaultSpawn(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number; shell?: boolean }
): { code: number; out: string } {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * Run one assigned role and decide, from disk, whether it actually ran.
 *
 * @param assignment - Role plus its unmet rows.
 * @param iteration - PM iteration number, recorded in the session id.
 * @param ctx - Working directory, slug, timeout.
 * @param deps - Injected side effects.
 * @returns What happened, judged by artifacts.
 */
export async function runRole(
  assignment: RunRoleAssignment,
  iteration: number,
  ctx: RunRoleContext,
  deps: RunRoleDeps = {}
): Promise<RunRoleResult> {
  // Enforcement lives HERE so no caller can silently skip it. A worktree role
  // given the main tree (or a plain temp dir) fails before spawn.
  assertRoleWorkDir(assignment.role, ctx.workDir);

  const spawn = deps.spawn ?? defaultSpawn;
  const write = deps.writeBrief ?? ((p: string, b: string) => writeFileSync(p, b));
  const artifacts = expandArtifacts(assignment.role.artifacts, ctx.slug);

  const briefPath = join(ctx.workDir, 'ROLE_TASK.md');
  write(briefPath, buildRoleBrief(assignment, ctx.slug));

  const sid = deps.sessionId?.() ?? randomUUID();
  const args = [
    '--no-auto-update',
    '--always-approve',
    '--no-alt-screen',
    '--cwd',
    ctx.workDir,
    '--session-id',
    sid,
    '-p',
    'Read ROLE_TASK.md in the current directory and carry out exactly what it ' +
      'says. Leave every artifact it names on disk. Do not delete ROLE_TASK.md.'
  ];

  // grok is a .cmd shim on Windows, which needs a shell; Node's shell:true joins
  // argv without quoting, so a multi-word prompt gets re-split. Quote by hand.
  const useShell = process.platform === 'win32';
  const finalArgs = useShell
    ? args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
    : args;

  const res = spawn('grok', finalArgs, {
    cwd: ctx.workDir,
    env: scrubEnv(process.env),
    timeout: (ctx.timeoutSec ?? DEFAULT_ROLE_TIMEOUT_SEC) * 1000,
    shell: useShell
  });

  const missing = missingArtifacts(ctx.workDir, artifacts);
  // The decision. Note what is NOT consulted: res.out. An agent saying "done"
  // has never been evidence, and this is the boundary where that is enforced.
  const countedAsRun = res.code === 0 && missing.length === 0;

  let reason: string;
  if (res.code !== 0) {
    reason = `${assignment.role.id}: agent exited ${res.code} — not run`;
  } else if (missing.length > 0) {
    reason =
      `${assignment.role.id}: agent exited 0 but left no ${missing.join(', ')} — ` +
      'counted as NOT RUN. A summary is not a deliverable.';
  } else {
    reason = `${assignment.role.id}: produced ${artifacts.length} artifact(s) (iteration ${iteration})`;
  }

  return {
    role: assignment.role.id,
    exitCode: res.code,
    missing,
    countedAsRun,
    reason,
    output: res.out.slice(-4000)
  };
}
