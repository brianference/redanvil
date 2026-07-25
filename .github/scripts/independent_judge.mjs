#!/usr/bin/env node
/**
 * Re-decide the judge-method rules with a reviewer that did not write the code.
 *
 * The judge tier recorded 258 verdicts and zero FAILs. That was never evidence
 * the code was clean: judge verdicts were written by the same agent that wrote
 * the code, so the number measured agreement with itself. Handing the same ten
 * rules to an independent reviewer returned six FAILs, five of them real.
 *
 * This makes that repeatable instead of a one-off. It runs the `grok` CLI in a
 * disposable git worktree with:
 *   - no access to the existing verdict file (it must decide from the code),
 *   - a hard requirement to cite file:line evidence that exists on disk,
 *   - an explicit instruction that PASS is the claim needing proof, not FAIL.
 *
 * It deliberately does NOT write verdicts. Its output is a report to adjudicate;
 * a judge that can mark its own findings as authoritative is the same failure in
 * the other direction, and one of the six claims in the first run was wrong.
 *
 * Usage:
 *   node independent_judge.mjs <appDir> [--out evidence/judge-independent-<slug>.json]
 *                                       [--rules a,b,c] [--timeout 900]
 *
 * Exit 0 when the run completed and a report was written (findings or not),
 * 1 when the reviewer could not be run, 2 on usage error.
 */
import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const appDir = args[0];
if (appDir === undefined || appDir.startsWith('--')) {
  console.error('usage: node independent_judge.mjs <appDir> [--out f.json] [--rules a,b]');
  process.exit(2);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const slug = basename(resolve(appDir));
const outPath = flag('out', join('evidence', `judge-independent-${slug}.json`));
const timeoutSec = Number(flag('timeout', '900'));

/**
 * The judge-method rules. Kept explicit rather than derived so a rule silently
 * losing its `judge` method cannot silently shrink this list too.
 */
const DEFAULT_RULES = [
  'u-conc-idiomatic',
  'u-conc-no-speculative-abstraction',
  'u-conc-use-what-exists',
  'u-conc-smallest-diff',
  'u-val-input-validation',
  'u-sec-no-stub-paths',
  'u-test-adequacy',
  'u-test-behavioral',
  'fe-pages-compose',
  'fe-fail-closed-states'
];
const rules = String(flag('rules', DEFAULT_RULES.join(',')))
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

/** Run a command, returning {code, stdout, stderr}. */
const run = (cmd, cmdArgs, opts = {}) => {
  const r = spawnSync(cmd, cmdArgs, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts
  });
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

const head = run('git', ['rev-parse', 'HEAD']).stdout.trim();
if (head.length === 0) {
  console.error('independent_judge FAIL: not a git repository');
  process.exit(1);
}

// Disposable worktree: the reviewer gets its own checkout so nothing it does can
// reach the working tree, and so it cannot see uncommitted state.
const wt = mkdtempSync(join(tmpdir(), 'redanvil-judge-'));
const worktreePath = join(wt, 'tree');
const added = run('git', ['worktree', 'add', '--detach', worktreePath, head]);
if (added.code !== 0) {
  console.error(`independent_judge FAIL: could not create worktree\n${added.stderr}`);
  process.exit(1);
}

/**
 * Remove the worktree. Junctions are unlinked first: `git worktree remove`
 * follows a junction and deletes its TARGET, which once wiped a real
 * node_modules and an entire source tree in one command.
 */
function cleanup() {
  const nm = join(worktreePath, 'node_modules');
  if (existsSync(nm)) run('cmd', ['/c', 'rmdir', nm]);
  run('git', ['worktree', 'remove', '--force', worktreePath]);
  run('git', ['worktree', 'prune']);
  try {
    rmSync(wt, { recursive: true, force: true });
  } catch {
    /* temp dir may hold locked handles; harmless */
  }
}

const rubric = ['concision', 'security', 'testing', 'frontend']
  .map((lane) => {
    const p = join('rules', 'rubric', `${lane}.md`);
    return existsSync(p) ? `\n### ${lane}\n${readFileSync(p, 'utf8')}` : '';
  })
  .join('');

const prompt = `You are an INDEPENDENT code judge. You did NOT write this code and you
have no stake in it passing.

Judge \`${slug}\` in this repository against exactly these rules:

${rules.map((r) => `- ${r}`).join('\n')}

Rule definitions:
${rubric}

## How to judge

PASS is the claim that needs proof, not FAIL. If you cannot point at concrete
evidence that a rule holds, it does not hold. Do not give the benefit of the
doubt — an agent already reviewed this code and passed every rule, which is why
you are being asked.

For every rule, cite \`path:line\` locations you actually opened. A citation to a
line that does not exist, or line numbers that do not match the file, invalidates
the finding — the last independent run got one claim wrong that way (it described
a 270-line function that was 185 lines, and named a duplicated string that was
template body).

Look especially for:
- exports, helpers or branches with NO production caller (test-only duals are the
  common case — a function the tests assert instead of the real one)
- inline layout/width that a CSS class already owns, so no media query can lift it
- hand-inlined logic where a tested helper already exists in the same codebase
- page components that inline their own markup and style objects instead of
  composing named components
- branches with no assertion, and tests that assert presence (\`length > 2\`)
  rather than behaviour

## Output

Reply with ONLY a JSON array, no prose around it, no code fences:

[
  {
    "ruleId": "<one of the rules above>",
    "passed": true|false,
    "evidence": ["path/to/file.ts", "..."],
    "note": "<what you found, with path:line references; for a PASS say what you checked>"
  }
]

One entry per rule, ${rules.length} entries. Do not edit any file. Do not run git.`;

console.log(`independent judge: ${slug} @ ${head.slice(0, 12)}, ${rules.length} rules`);

// The prompt goes in a file inside the worktree, not on the command line.
// Passing it as an argument exceeded the Windows command-line limit and grok
// exited 1 with no output — which this script correctly refused to record as
// agreement, but which also meant it never ran.
const taskFile = join(worktreePath, 'JUDGE_TASK.md');
writeFileSync(taskFile, prompt);

const sid = randomUUID();
const grokArgs = [
  '--no-auto-update',
  '--always-approve',
  '--no-alt-screen',
  '--cwd',
  worktreePath,
  '--session-id',
  sid,
  '--output-format',
  'json',
  '-p',
  'Read JUDGE_TASK.md in the current directory and carry out exactly what it ' +
    'says. Reply with only the JSON array it asks for. Do not modify any file, ' +
    'including JUDGE_TASK.md.'
];

// The reviewer never needs credentials, and must not see them.
const scrubbed = { ...process.env };
for (const k of Object.keys(scrubbed)) {
  if (/TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL/i.test(k)) delete scrubbed[k];
}

// `grok` is a .cmd shim on Windows, which CreateProcess cannot run directly, so
// it needs a shell. But Node's `shell: true` joins argv into one command line
// WITHOUT quoting, so the multi-word prompt was re-split and grok tried to run
// its second word as a subcommand ("unrecognized subcommand 'in'"). Quote each
// argument ourselves when going through a shell.
const useShell = process.platform === 'win32';
const quoted = useShell
  ? grokArgs.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
  : grokArgs;

const res = run('grok', quoted, {
  env: scrubbed,
  timeout: timeoutSec * 1000,
  shell: useShell
});

cleanup();

if (res.code !== 0 && res.stdout.trim().length === 0) {
  console.error(
    `independent_judge FAIL: grok exited ${res.code} with no output.\n` +
      `${res.stderr.slice(0, 800)}\n` +
      `A judge that could not be run must NOT be recorded as agreement.`
  );
  process.exit(1);
}

/** Pull the JSON array out of the model's reply. */
function extractVerdicts(raw) {
  let text = raw;
  try {
    const envelope = JSON.parse(raw);
    if (typeof envelope?.text === 'string') text = envelope.text;
  } catch {
    /* not an envelope; treat as raw text */
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced === null ? text : fenced[1];
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const verdicts = extractVerdicts(res.stdout);
if (verdicts === null) {
  console.error(
    'independent_judge FAIL: could not parse a verdict array from the reviewer output. ' +
      'Unparseable is not the same as agreeing.'
  );
  process.exit(1);
}

// Every cited path must exist, or the finding rests on something imagined.
const withChecks = verdicts.map((v) => {
  const cited = Array.isArray(v?.evidence) ? v.evidence : [];
  const missing = cited.filter((p) => typeof p === 'string' && !existsSync(p));
  return { ...v, missingEvidence: missing };
});
const bogus = withChecks.filter((v) => v.missingEvidence.length > 0);

const failed = withChecks.filter((v) => v?.passed === false);
const report = {
  source: 'independent judge (grok, disposable worktree, no access to the verdict file)',
  reviewedCommit: head,
  app: slug,
  rulesRequested: rules,
  why:
    'Judge verdicts are otherwise written by the same agent that wrote the code. ' +
    'This run exists to produce dissent that self-review structurally cannot.',
  result: {
    rulesJudged: withChecks.length,
    failed: failed.length,
    citationsMissingOnDisk: bogus.length
  },
  adjudication:
    'UNADJUDICATED — each FAIL must be verified by hand before it is treated as real, ' +
    'and each one that turns out to be wrong must be recorded as wrong.',
  verdicts: withChecks
};
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

for (const v of withChecks) {
  const mark = v.passed === false ? 'FAIL' : 'pass';
  console.log(`  ${mark} ${v.ruleId}`);
  if (v.passed === false) console.log(`       ${String(v.note ?? '').slice(0, 200)}`);
  if (v.missingEvidence.length > 0) {
    console.log(`       !! cited paths not on disk: ${v.missingEvidence.join(', ')}`);
  }
}

console.log(
  `\nindependent judge: ${failed.length}/${withChecks.length} FAIL on ${slug}, ` +
    `report at ${outPath}`
);
if (failed.length === 0) {
  console.log(
    'Zero dissent from an independent reviewer is a real result — but one run is ' +
      'not evidence of cleanliness. Re-run on a cadence.'
  );
}
process.exit(0);
