#!/usr/bin/env node
/**
 * Run a judgement role by delegating to Grok Build.
 *
 * Six roles in the map are genuinely agentic — brainstorm, testwriter, judge,
 * user-refuse, pm, debugger. n8n has first-class AI Agent nodes that would suit
 * them, but self-hosted agents need n8n 2.32.3+ with the `agents` module and we
 * run 2.22.6, so that is a version upgrade rather than a config flag. Until
 * then these run as Grok shell-outs, which keeps the process complete instead of
 * leaving six holes in it.
 *
 * One runner, not six near-identical scripts: the roles differ only in their
 * prompt and their required artifact, and duplicating the plumbing is how the
 * generator and the walker drifted apart earlier.
 *
 * The prompts deliberately do NOT describe the artifact as optional, and each
 * demands the specific token its contract checks for. A role that writes a file
 * without that token has not done the job the contract describes.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    return m ? [[m[1], m[2]]] : [];
  })
);
const role = args.role;
const slug = args.slug;
if (!role || !slug || !ROLES[role]) {
  process.stderr.write(`usage: grok-role.mjs --role=<${Object.keys(ROLES).join('|')}> --slug=X\n`);
  process.exit(2);
}

const root = resolve(args.repoRoot ?? process.cwd());
const appDir = join(root, slug);
const briefPath = join(appDir, 'docs', 'PRODUCT-BRIEF.md');
const brief = existsSync(briefPath) ? readFileSync(briefPath, 'utf8') : '';

// Ensure the artifact's parent exists so a role failing to create a directory is
// not mistaken for a role that produced nothing.
mkdirSync(join(appDir, 'docs'), { recursive: true });
mkdirSync(join(appDir, 'evidence'), { recursive: true });

/**
 * Scope the agent as tightly as its job allows.
 *
 * `--always-approve` pre-grants every approval, so the working directory IS the
 * blast radius. Only `judge` genuinely needs the repository — it reviews
 * `git diff` — and even then it only reads. Every other role works inside the
 * app it is building, so pointing them at the repo root would let a brainstorm
 * job rewrite the orchestrator or the gate that scores it.
 */
const NEEDS_REPO = new Set(['judge']);
const agentCwd = NEEDS_REPO.has(role) ? root : appDir;

const prompt = ROLES[role].prompt({ slug, brief });
const proc = spawnSync(
  'grok',
  ['--always-approve', '--cwd', agentCwd, '-m', 'grok-4.5', '-p', prompt],
  { cwd: root, encoding: 'utf8', timeout: 20 * 60 * 1000, shell: false }
);

if (proc.error) {
  process.stderr.write(`grok could not be launched: ${proc.error.message}\n`);
  process.exit(1);
}
process.stdout.write((proc.stdout ?? '').trim().split('\n').slice(-3).join('\n') + '\n');
// The verdict on whether this role did work belongs to role-run.mjs and the
// contract, not to grok's own report. Exit reflects the process only.
process.exit(proc.status ?? 1);
