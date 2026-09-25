#!/usr/bin/env node
/**
 * Run a judgement role on Claude (`claude -p`, prompt on stdin).
 *
 * Six roles in the map are genuinely agentic — brainstorm, testwriter, judge,
 * user-refuse, pm, debugger. n8n has first-class AI Agent nodes that would suit
 * them, but self-hosted agents need n8n 2.32.3+ with the `agents` module and we
 * run 2.22.6, so that is a version upgrade rather than a config flag. Until
 * then these run as Claude shell-outs, which keeps the process complete instead
 * of leaving six holes in it.
 *
 * None of these roles is in GROK_ALLOWED_ROLES
 * (orchestrator/scripts/lib/engine-policy.mjs), so runAgentWithFailover never
 * spawns grok for them. Owner rule, 2026-09-24: when Claude cannot run, the
 * role fails; it is not handed to Grok. This file was grok-role.mjs.
 *
 * One runner, not six near-identical scripts: the roles differ only in their
 * prompt and their required artifact, and duplicating the plumbing is how the
 * generator and the walker drifted apart earlier.
 *
 * The prompts deliberately do NOT describe the artifact as optional, and each
 * demands the specific token its contract checks for. A role that writes a file
 * without that token has not done the job the contract describes.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runAgentWithFailover } from './agent-failover.mjs';

/**
 * Per-role brief. `out` is the artifact the contract will check.
 * @type {Record<string,{out:string,prompt:(ctx:{slug:string,brief:string})=>string}>}
 */
const ROLES = {
  brainstorm: {
    out: 'docs/FEATURES.md',
    prompt: ({ slug, brief }) => `Read ${slug}/docs/PRODUCT-BRIEF.md and ${slug}/docs/PRD.md.

Write ${slug}/docs/FEATURES.md: the candidate features RANKED by user value, each
with a one-line justification and an explicit **data source** line naming where
its data actually comes from (a real API, a seeded table, user input).

A feature whose data cannot be sourced is listed as **blocked**, not built. That
is the point of this role — an unsourceable feature otherwise ships as a
beautiful empty screen. Say plainly which ones are blocked and why.

Every entry must carry the literal phrase "data source". Minimum 800 bytes.
Do not invent an API that you have not confirmed exists.

Context: ${brief.slice(0, 600)}`
  },
  testwriter: {
    out: 'test/acceptance',
    prompt: ({ slug, brief }) => `Read ${slug}/docs/PRD.md and ${slug}/docs/FEATURES.md.

Write acceptance tests to ${slug}/test/acceptance/*.test.ts, in vitest, derived
from the PRD BEFORE the app is built. They will fail — that is correct and
expected. Tests written after a build assert the implementation rather than the
requirement, which is how a green suite coexists with a missing feature.

Cover the primary flow the brief names as the one that must work. Use
role-based queries, web-first assertions, and never a fixed sleep.

Then write the INTEGRATION layer in pytest, to ${slug}/test/integration/test_*.py.
Vitest above covers units and component behaviour; pytest covers whether the
parts actually work TOGETHER — real D1 reads and writes, the Pages Functions
endpoints, and the browser against a served build. A suite that only ever mocks
its collaborators passes while the seams are broken, and the seams are where
this project's real defects have been.

Requirements, all of them:
- Mark every integration test @pytest.mark.integration and declare the marker in
  pytest.ini, so \`pytest -m integration\` and \`pytest -m "not integration"\`
  both select correctly and the slow lane never blocks the fast one.
- Put shared setup in fixtures in conftest.py — a temp/seeded database and a
  base URL — never module-level globals. Scope them (session for the server,
  function for anything a test mutates) so tests cannot leak state into
  each other.
- Drive the React UI with pytest-playwright's \`page\` fixture, which runs a real
  browser engine and auto-waits for elements to be actionable. That auto-waiting
  is the point: React renders asynchronously, and a fixed sleep is what makes
  these suites flaky.
- Assert real HTTP responses against the running Functions API. Do not mock the
  layer under test; mock only third-party calls you do not own, with
  \`responses\`.
- Every test must be able to FAIL for the reason it claims. A test that passes
  against a broken backend is not an integration test.

Do not add pytest-xdist parallelism until the suite is green serially — parallel
runs turn one shared-state bug into an intermittent failure that is far harder
to read. Use pytest-asyncio only if the code under test is genuinely async.

Context: ${brief.slice(0, 600)}`
  },
  judge: {
    out: 'evidence/judge-diff.json',
    prompt: ({ slug }) => `Act as an INDEPENDENT judge over the diff for ${slug}, with fresh context.

Review \`git diff\` against the project's coding rules in ${slug}/CLAUDE.md. You did
not write this code and you are not defending it.

Write ${slug}/evidence/judge-diff.json:
{ "reviewedCommit": "<sha>", "findings": [ { "rule": "...", "file": "...",
  "line": 0, "severity": "blocker|major|minor", "why": "..." } ], "verdict": "..." }

Every finding cites file and line. A judge that reviews its own author's work
never dissents — 258 verdicts with zero fails, against 6 of 10 from a fresh
reviewer. Find what is actually wrong. If nothing is, say so and explain what you
checked, so the pass is auditable rather than asserted.`
  },
  'user-refuse': {
    out: 'evidence/user-refuse.json',
    prompt: ({ slug }) => `Act as a sceptical first-time user of ${slug}. You see ONLY the deployed URL.
You have not read the code, the PRD, or any documentation.

**Your default answer is no.** You must be argued out of it by the product itself.

Open the site. Try to accomplish the thing it claims to do. Note every point where
you were confused, blocked, or shown something that did not work.

Write ${slug}/evidence/user-refuse.json:
{ "url": "...", "attempted": "...", "complaints": ["..."], "verdict": "accept|refuse", "why": "..." }

Must contain the literal key "verdict". Accept only if the core promise actually
worked end to end for you. A reviewer who starts from yes finds nothing.`
  },
  pm: {
    out: 'evidence/assignments.json',
    prompt: ({ slug }) => `Act as the PM for ${slug}.

Read every finding available: ${slug}/evidence/judge-diff.json,
${slug}/evidence/user-refuse.json, and any gate results under ${slug}/results/.

Write ${slug}/evidence/assignments.json assigning EVERY unmet row to the role
that owns it (product, logo, palette, layout, engineer, content, testwriter,
qa-visual, qa-runtime, qa-data, debugger):

{ "unmet": [ { "finding": "...", "owningRole": "...", "source": "..." } ],
  "unowned": [] }

Must contain the literal key "unmet". **An unmet row with no owning role is a
hard error** — put it in "unowned" and say so loudly. That is how a finding gets
discovered and then quietly dropped.`
  },
  debugger: {
    out: 'evidence/root-cause.md',
    prompt: ({ slug }) => `Act as the debugger for ${slug}. Establish ROOT CAUSE before any fix is written.

Read ${slug}/evidence/assignments.json. For each assigned finding, investigate the
actual cause — read the code, run the thing, reproduce it. Do not propose a fix
until you can state why the defect happens.

Write ${slug}/evidence/root-cause.md with a section per finding containing the
literal phrase "root cause", the reproduction, and only then the proposed fix.

A fix written before the cause is known treats the symptom, and the defect
returns under a different name. If you cannot reproduce something, say so rather
than guessing.`
  }
};

/** Overall bound for one judgement role. */
const ROLE_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * Scope the agent as tightly as its job allows.
 *
 * `--permission-mode auto` lets the agent act without a person approving each
 * step, so the working directory IS the blast radius. Only `judge` genuinely needs the repository — it reviews
 * `git diff` — and even then it only reads. Every other role works inside the
 * app it is building, so pointing them at the repo root would let a brainstorm
 * job rewrite the orchestrator or the gate that scores it.
 */
const NEEDS_REPO = new Set(['judge']);

/** Roles this runner knows, for the engine-policy test and the usage line. */
export const CLAUDE_ROLE_IDS = Object.freeze(Object.keys(ROLES));

/**
 * Run one judgement role on Claude. A Claude failure fails the role; there is
 * no Grok fallback.
 *
 * @param {{role: string, slug: string, repoRoot?: string, runAgent?: typeof runAgentWithFailover}} opts
 * @returns {Promise<{status: number, stdout: string, stderr: string}>}
 */
export async function runClaudeRole(opts) {
  const spec = ROLES[opts.role];
  if (!opts.role || !opts.slug || !spec) {
    return {
      status: 2,
      stdout: '',
      stderr: `usage: claude-role.mjs --role=<${CLAUDE_ROLE_IDS.join('|')}> --slug=X\n`
    };
  }
  const root = resolve(opts.repoRoot ?? process.cwd());
  const appDir = join(root, opts.slug);
  const briefPath = join(appDir, 'docs', 'PRODUCT-BRIEF.md');
  const brief = existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : '';
  mkdirSync(join(appDir, 'docs'), { recursive: true });
  mkdirSync(join(appDir, 'evidence'), { recursive: true });
  const agentCwd = NEEDS_REPO.has(opts.role) ? root : appDir;
  const runAgent = opts.runAgent ?? runAgentWithFailover;
  const result = await runAgent({
    prompt: spec.prompt({ slug: opts.slug, brief }),
    cwd: agentCwd,
    timeoutMs: ROLE_TIMEOUT_MS,
    needsImages: false,
    role: opts.role,
    artifact: spec.out,
    appDir
  });
  const tail = (result.stdout ?? '').trim().split('\n').slice(-3).join('\n');
  const stdout = `${tail}${tail ? '\n' : ''}engine: ${result.engine ?? 'none'}\n`;
  const stderr = result.ok ? '' : `${result.reason ?? result.stderr ?? ''}\n`;
  const status = result.ok ? 0 : typeof result.status === 'number' && result.status !== 0 ? result.status : 1;
  return { status, stdout, stderr };
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  return Object.fromEntries(
    argv.flatMap((arg) => {
      const match = /^--([^=]+)=([\s\S]*)$/.exec(arg);
      return match ? [[match[1], match[2]]] : [];
    })
  );
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runClaudeRole({ role: args.role, slug: args.slug, repoRoot: args.repoRoot });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status);
}
