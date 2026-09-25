#!/usr/bin/env node
/**
 * Re-decide the judge-method rules with a reviewer that did not write the code.
 *
 * The judge tier recorded 258 verdicts and zero FAILs. That was never evidence
 * the code was clean: judge verdicts were written by the same agent that wrote
 * the code, so the number measured agreement with itself. Handing the same ten
 * rules to an independent reviewer returned six FAILs, five of them real.
 *
 * This makes that repeatable instead of a one-off. It runs `claude -p` (prompt
 * on stdin) in a disposable git worktree with:
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
 *                                       [--engine claude]
 *
 * Claude only. Owner rule, 2026-09-24 (orchestrator/scripts/lib/engine-policy.mjs):
 * judging never runs on Grok, and there is no fallback. `--engine grok` is a
 * usage error. When claude is missing, rate-limited, or returns an `is_error`
 * envelope, the run is UNVERIFIED: exit 1 and no report, because a judge that
 * could not be run must not be recorded as agreement.
 *
 * Exit 0 when the run completed and a report was written (findings or not),
 * 1 when the reviewer could not be run (UNVERIFIED), 2 on usage error.
 */
import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  judgeScopeFromCitations,
  JUDGE_SCOPE_SCHEMA_VERSION
} from '../../orchestrator/scripts/lib/verdict-freshness.mjs';
import { ENGINE_CLAUDE } from '../../orchestrator/scripts/lib/engine-policy.mjs';

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
const engineFlag = String(flag('engine', ENGINE_CLAUDE));
if (engineFlag !== ENGINE_CLAUDE) {
  console.error(
    'independent_judge FAIL: --engine must be claude. Judging runs on Claude only ' +
      '(owner rule 2026-09-24, orchestrator/scripts/lib/engine-policy.mjs).'
  );
  process.exit(2);
}

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

// The prompt goes on stdin, not on the command line. Passing it as an argument
// exceeded the Windows command-line limit and the reviewer exited 1 with no
// output — which this script correctly refused to record as agreement, but
// which also meant it never ran.
// The checkout contains committed verdict files. Remove them inside the
// throwaway worktree only, so the reviewer cannot grade by copying the last
// review. The real repo copy is untouched.
hidePriorVerdicts(worktreePath);

/**
 * Delete prior judge output inside a disposable worktree.
 *
 * @param {string} root Worktree root.
 */
function hidePriorVerdicts(root) {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (/^(verdicts-|judge-).*\.json$/.test(entry.name)) rmSync(full, { force: true });
    }
  }
}

/**
 * Classify a `claude --output-format json` envelope.
 *
 * Same rules as `classifyClaude` in orchestrator/src/loop/classifyClaude.ts
 * (ported from n8n-prototype/loki/overnight.mjs). Kept here so this script
 * stays runnable under plain `node`.
 *
 * @param {{status: number|null, stdout: string, stderr: string}} res
 * @returns {{ok: boolean, rateLimited: boolean, detail: string}}
 */
function classifyClaude(res) {
  const combined = `${res.stdout}\n${res.stderr}`;
  let envelope = null;
  try {
    envelope = JSON.parse(res.stdout);
  } catch {
    // Not JSON: the process died before an envelope.
  }
  if (envelope && typeof envelope === 'object') {
    const apiStatus = envelope.api_error_status;
    const rateLimited = apiStatus === 429 || apiStatus === 529;
    return {
      ok: envelope.is_error !== true,
      rateLimited,
      detail: `subtype=${envelope.subtype} api_error_status=${apiStatus ?? 'none'}`
    };
  }
  const rateLimited = /rate.?limit|usage limit|429|too many requests|quota|overloaded/i.test(
    combined
  );
  return { ok: res.status === 0, rateLimited, detail: `no json envelope; exit ${res.status}` };
}

// The reviewer never needs credentials, and must not see them.
const scrubbed = { ...process.env };
for (const k of Object.keys(scrubbed)) {
  if (/TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL/i.test(k)) delete scrubbed[k];
}

/**
 * Run claude -p. Prompt on stdin, no shell, same scrubbed env and timeout.
 *
 * A fresh process: no --resume, no session id. The prompt is the task text,
 * not a path to a verdict file.
 *
 * @returns {{code: number, stdout: string, stderr: string, unavailable: boolean}}
 */
function runClaude() {
  const claude = run('claude', ['-p', '--output-format', 'json'], {
    input: prompt,
    cwd: worktreePath,
    env: scrubbed,
    timeout: timeoutSec * 1000,
    shell: false
  });
  const unavailable = claude.code === null || (claude.stdout.trim().length === 0 && claude.code !== 0);
  return { ...claude, unavailable };
}

const usedEngine = ENGINE_CLAUDE;
const res = runClaude();
const classified = classifyClaude({
  status: res.code,
  stdout: res.stdout,
  stderr: res.stderr
});

cleanup();

// Fail closed. No Grok fallback: a missing, rate-limited or erroring Claude is
// an UNVERIFIED run, not a reason to ask a different engine.
if (res.unavailable || classified.rateLimited || !classified.ok) {
  console.error(
    `independent_judge UNVERIFIED: claude unavailable, rate-limited or errored ` +
      `(${classified.detail}). No report written; there is no fallback engine. ` +
      `A judge that could not be run must NOT be recorded as agreement.`
  );
  process.exit(1);
}

if (res.code !== 0 && res.stdout.trim().length === 0) {
  console.error(
    `independent_judge FAIL: ${usedEngine} exited ${res.code} with no output.\n` +
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
    else if (typeof envelope?.result === 'string') text = envelope.result;
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
  // Scope is the files the judge cited that exist. Never an empty array:
  // an empty scope would either be rejected (schemaVersion 2) or mean
  // "the whole app" (legacy). Omit it and let the caller refuse the row.
  const scope = judgeScopeFromCitations(cited, (p) => existsSync(p));
  const row = { ...v, missingEvidence: missing };
  if (scope.length > 0) {
    row.scope = scope;
    row.schemaVersion = JUDGE_SCOPE_SCHEMA_VERSION;
  }
  return row;
});
const bogus = withChecks.filter((v) => v.missingEvidence.length > 0);

const failed = withChecks.filter((v) => v?.passed === false);
const report = {
  source: `independent judge (${usedEngine}, disposable worktree, no access to the verdict file)`,
  engine: usedEngine,
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
