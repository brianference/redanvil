/**
 * Independent judge over the real git diff — before any app can be reported done.
 *
 * The author (Claude or Grok) already reviewed their own work. That review
 * measures agreement with itself. This step dispatches a separate judge with
 * instructions to REFUTE: find what was missed, cite file:line, and FAIL
 * anything it cannot verify. A run where the judge found nothing must say so
 * explicitly rather than silently passing.
 *
 * The judge reads the DIFF, not a summary of the diff.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { quoteForCmd, scrubbedEnv } from '../process/run';

/**
 * How the independent review was produced.
 *
 * `empty-diff` is its own terminal state: collectDiff found nothing to hand a
 * judge, so no review ran. It must never evaluate as ok / F5 pass.
 */
export type IndependentReviewMode = 'grok' | 'fixture' | 'unavailable' | 'empty-diff';

/** Evidence shape written for the finish line / isDone. */
export interface IndependentReviewReport {
  kind: 'independent-diff-review';
  /** App or directory slug. */
  slug: string;
  /** Commit the review is bound to. */
  commit: string;
  /** ISO timestamp when the review finished. */
  reviewedAt: string;
  /** SHA-256 of the unified diff that was judged (binds report to the diff). */
  diffHash: string;
  /** True when the judge completed and either found nothing or listed findings. */
  completed: boolean;
  /**
   * True when the step is acceptable for isDone:
   * - completed with zero findings and explicit empty acknowledgement, OR
   * - completed with findings that are all severity advisory (none blocker)
   * For the finish line we require completed && (findings.length === 0 with
   * foundNothingExplicit) or caller policy. Default: ok only when completed
   * and every finding has passed === true, or findings empty with explicit note.
   * Never true for mode === 'empty-diff' (nothing was reviewed).
   */
  ok: boolean;
  /** Explicit statement that the judge found nothing (required when empty). */
  foundNothingExplicit: boolean;
  /**
   * True when collectDiff produced no patch and no judge was invoked.
   * Distinct from foundNothingExplicit (judge ran and found no defects).
   */
  nothingToReview?: boolean;
  /** Individual refute findings. */
  findings: IndependentFinding[];
  /** Raw judge stdout (truncated) for audit. */
  rawExcerpt: string;
  /** How the review was produced. */
  mode: IndependentReviewMode;
}

/** One refute finding from the independent judge. */
export interface IndependentFinding {
  /** Short title. */
  title: string;
  /** file:line citation (required). */
  citation: string;
  /** Why this refutes the author's claim. */
  detail: string;
  /** True when the judge verified the claim holds. */
  passed: boolean;
}

export interface IndependentReviewOptions {
  /** Working directory for git / app. */
  dir: string;
  /** Repo root for evidence output. Defaults to dir's git toplevel or dir. */
  repoRoot?: string;
  /** Optional explicit out path. */
  outPath?: string;
  /**
   * When set, skip the live grok CLI and use this fixture report body.
   * Tests only — production never sets this.
   */
  fixtureReport?: Partial<IndependentReviewReport>;
  /** Per-run timeout for the grok CLI (ms). */
  timeoutMs?: number;
  /** Base vs head for the diff. Defaults to merge-base with main/master..HEAD. */
  diffRange?: string;
  /**
   * Path-scope for `diffRange`, so an app's judge sees that app's changes.
   * Ignored when `diffRange` is unset.
   */
  diffPaths?: string[];
}

/**
 * Resolve the git toplevel for a directory.
 *
 * @param dir - Directory inside a repo.
 * @returns Absolute toplevel path, or null.
 */
function gitRoot(dir: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Current HEAD commit, or null.
 *
 * @param dir - Git directory.
 * @returns Full SHA.
 */
export function headCommit(dir: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Parent SHAs of HEAD (empty when not a git repo / unreadable).
 *
 * @param dir - Git directory.
 * @returns Parent commit SHAs in rev-list order (first parent first).
 */
export function headParents(dir: string): string[] {
  try {
    const line = execFileSync('git', ['rev-list', '--parents', '-n', '1', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (line.length === 0) return [];
    // "commit parent1 parent2 ..." — drop the commit itself.
    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    return parts.slice(1);
  } catch {
    return [];
  }
}

/**
 * Unified diff for the review. Prefers staged+unstaged against HEAD, else
 * last commit, else empty.
 *
 * Clean-tree merge commits: plain `git show --patch` emits no patch (combined
 * default / --cc are empty on conflict-free merges). We use the first-parent
 * diff (`git diff <first-parent> HEAD`) — the conventional "what this merge
 * brought onto the mainline" patch in ordinary unified-diff form the judge can
 * read. Non-merge commits keep `git show --format= --patch HEAD`.
 *
 * @param dir - Git directory.
 * @param range - Optional explicit range (e.g. `main...HEAD`).
 * @returns Diff text (may be empty when there is genuinely nothing to review).
 */
export function collectDiff(dir: string, range?: string, paths?: string[]): string {
  try {
    if (range) {
      // Path-scope when asked. A release range spans every app in the repo, and
      // handing one app's judge the other apps' changes buries the thing it was
      // asked to review — the first real run reported exactly that, calling its
      // input "a self-referential judge meta-review, not a code-diff review".
      const pathArgs = paths !== undefined && paths.length > 0 ? ['--', ...paths] : [];
      return execFileSync('git', ['diff', range, ...pathArgs], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 32 * 1024 * 1024
      });
    }
    // Working tree changes relative to HEAD (what the author just did).
    const unstaged = execFileSync('git', ['diff', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024
    });
    if (unstaged.trim().length > 0) return unstaged;

    // Clean tree: review the latest commit itself.
    const parents = headParents(dir);
    if (parents.length > 1) {
      // Merge commit: first-parent unified diff (not --cc — empty on clean merges).
      return execFileSync('git', ['diff', parents[0]!, 'HEAD'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 32 * 1024 * 1024
      });
    }
    return execFileSync('git', ['show', '--format=', '--patch', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024
    });
  } catch {
    return '';
  }
}

/**
 * SHA-256 of the exact diff bytes the judge saw.
 *
 * @param diff - Unified diff text.
 * @returns Hex digest.
 */
export function hashDiff(diff: string): string {
  return createHash('sha256').update(diff, 'utf8').digest('hex');
}

/**
 * Build the refute prompt. The judge receives the DIFF, not a summary.
 *
 * @param slug - App slug.
 * @param commit - HEAD commit.
 * @param diff - Full unified diff.
 * @returns Prompt text.
 */
export function buildRefutePrompt(slug: string, commit: string, diff: string): string {
  const clipped =
    diff.length > 120_000
      ? `${diff.slice(0, 120_000)}\n\n[diff truncated at 120000 chars for the judge prompt]`
      : diff;
  return `You are an INDEPENDENT code judge. You did NOT write this code.

Review the REAL git diff for \`${slug}\` at commit ${commit}.
Your job is to REFUTE the author: find what they missed, cite file:line from
the diff, and FAIL anything you cannot verify.

PASS is the claim that needs proof, not FAIL. If you cannot verify a change,
it does not pass.

## Do not use tools

The full unified diff is already in this message. Do not call tools, do not
read files, do not run commands, do not open the tree. Answer once from the
diff below. Intermediate status messages are forbidden — emit only the final
JSON object described under Output format.

## Output format (JSON only, no markdown fence)

{
  "foundNothingExplicit": boolean,
  "findings": [
    {
      "title": "short name",
      "citation": "path/to/file.ts:42",
      "detail": "what is wrong or what you verified",
      "passed": false
    }
  ]
}

Rules:
- If you find zero issues, set foundNothingExplicit to true and findings to [].
  A silent empty pass is forbidden — you must say you found nothing.
- Every finding MUST have a citation of the form file:line.
- Prefer real defects: hardcoded theme paint, missing tests for new API routes,
  placeholder brand marks, absent SOURCES/INTEGRATIONS/COMPETITORS, routes that
  render the home page, missing screenshots.
- Do not invent "still inspecting" or "will check" findings — only final verdicts.

## THE DIFF (not a summary)

\`\`\`diff
${clipped.length === 0 ? '(empty diff — tree is clean and HEAD has no patch; say so explicitly)' : clipped}
\`\`\`
`;
}

/**
 * JSON Schema for the independent judge reply. Passed to `grok --json-schema`
 * so the model is constrained to this shape (implies --output-format json).
 * Matches what {@link parseJudgeJson} / evaluateReviewOk already expect.
 */
export const JUDGE_DIFF_JSON_SCHEMA = JSON.stringify({
  type: 'object',
  required: ['foundNothingExplicit', 'findings'],
  properties: {
    foundNothingExplicit: { type: 'boolean' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'citation', 'detail', 'passed'],
        properties: {
          title: { type: 'string' },
          citation: { type: 'string' },
          detail: { type: 'string' },
          passed: { type: 'boolean' }
        }
      }
    }
  }
});

/**
 * Normalize a raw object into the findings payload the rest of the step uses.
 *
 * @param raw - Parsed object (from the model or after envelope unwrap).
 * @returns Findings payload, or null when the object is not a review body.
 */
function normalizeJudgePayload(raw: {
  foundNothingExplicit?: unknown;
  findings?: unknown;
}): {
  foundNothingExplicit: boolean;
  findings: IndependentFinding[];
} | null {
  // Must look like the review body — refuse bare envelopes / unrelated objects.
  if (!('foundNothingExplicit' in raw) && !('findings' in raw)) return null;
  // findings must be an array when present; a wrong type is unparseable.
  if ('findings' in raw && raw.findings !== undefined && !Array.isArray(raw.findings)) {
    return null;
  }
  const findingsRaw = Array.isArray(raw.findings) ? raw.findings : [];
  const findings: IndependentFinding[] = [];
  for (const f of findingsRaw) {
    if (f === null || typeof f !== 'object') continue;
    const row = f as Record<string, unknown>;
    if (typeof row.title !== 'string' || typeof row.citation !== 'string') continue;
    findings.push({
      title: row.title,
      citation: row.citation,
      detail: typeof row.detail === 'string' ? row.detail : '',
      passed: row.passed === true
    });
  }
  // Listed findings that all failed shape checks → unparseable, not "found nothing".
  if (findingsRaw.length > 0 && findings.length === 0) return null;
  return {
    foundNothingExplicit: raw.foundNothingExplicit === true,
    findings
  };
}

/**
 * Extract top-level JSON objects from a string that may concatenate several
 * (multi-turn --json-schema runs paste one object per turn into envelope.text).
 *
 * @param text - Possibly multi-object text.
 * @returns Parsed objects in order of appearance.
 */
export function extractJsonObjects(text: string): unknown[] {
  const results: unknown[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') {
      i += 1;
      continue;
    }
    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;
    let closed = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j]!;
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (c === '\\') {
          escape = true;
          continue;
        }
        if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            results.push(JSON.parse(text.slice(start, j + 1)));
          } catch {
            /* skip malformed slice */
          }
          i = j + 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) break;
  }
  return results;
}

/**
 * Parse judge JSON from stdout.
 *
 * When grok is invoked with --output-format json / --json-schema, stdout is a
 * CLI envelope `{ text, stopReason, usage, ... }`. The model's actual result
 * is the string in `text` (JSON matching JUDGE_DIFF_JSON_SCHEMA). Multi-turn
 * runs concatenate one schema object per turn into `text` — the last valid
 * findings body is the final answer. Unparseable input returns null so the
 * caller can fail closed.
 *
 * @param text - Raw judge stdout (and optional stderr concat).
 * @returns Parsed findings payload or null.
 */
export function parseJudgeJson(text: string): {
  foundNothingExplicit: boolean;
  findings: IndependentFinding[];
} | null {
  let body = text.trim();
  if (body.length === 0) return null;

  // Prefer the CLI JSON envelope: { text, structuredOutput, stopReason, usage, ... }.
  try {
    const envelope = JSON.parse(body) as {
      text?: unknown;
      structuredOutput?: unknown;
      structuredOutputError?: unknown;
      stopReason?: unknown;
      foundNothingExplicit?: unknown;
      findings?: unknown;
    };
    // When --json-schema succeeds, the CLI puts the constrained object here.
    if (
      envelope.structuredOutput !== null &&
      envelope.structuredOutput !== undefined &&
      typeof envelope.structuredOutput === 'object' &&
      !Array.isArray(envelope.structuredOutput)
    ) {
      const fromStructured = normalizeJudgePayload(
        envelope.structuredOutput as {
          foundNothingExplicit?: unknown;
          findings?: unknown;
        }
      );
      if (fromStructured !== null) return fromStructured;
    }
    // Cancelled / failed structured runs: intermediate schema objects may still
    // sit in text. Fail closed rather than promoting a partial turn to a review.
    const stop = typeof envelope.stopReason === 'string' ? envelope.stopReason : '';
    const schemaFailed =
      envelope.structuredOutput === null &&
      typeof envelope.structuredOutputError === 'string' &&
      envelope.structuredOutputError.length > 0;
    if (stop === 'Cancelled' || schemaFailed) {
      return null;
    }
    if (typeof envelope.text === 'string') {
      body = envelope.text.trim();
    } else {
      // Structured output landed as the top-level object (no text wrapper).
      const direct = normalizeJudgePayload(envelope);
      if (direct !== null) return direct;
    }
  } catch {
    // Not pure JSON; fall through to object extraction below.
  }

  // Model reply may still be fenced or surrounded by a short note.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(body);
  if (fenced?.[1]) body = fenced[1].trim();

  const objects = extractJsonObjects(body);
  // Last valid body wins: multi-turn schema output is intermediate then final.
  for (let k = objects.length - 1; k >= 0; k--) {
    const obj = objects[k];
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) continue;
    const normalized = normalizeJudgePayload(
      obj as { foundNothingExplicit?: unknown; findings?: unknown }
    );
    if (normalized !== null) return normalized;
  }
  return null;
}

/**
 * Build the headless `grok` argv for the independent diff review.
 *
 * Mirrors `.github/scripts/independent_judge.mjs` and `src/grok/harness.ts`:
 * real flags only (--cwd, -m, --always-approve, --json-schema). Never
 * `--grokmodel` or bare `-d` — those are not CLI options and produce no
 * parseable review.
 *
 * @param opts - Cwd, path to the prompt file, session id, optional model.
 * @returns Argv for `spawnSync('grok', ...)`.
 */
export function buildIndependentReviewGrokArgs(opts: {
  cwd: string;
  promptFile: string;
  sessionId: string;
  model?: string;
}): string[] {
  return [
    '--no-auto-update',
    '--always-approve',
    '--no-alt-screen',
    '--cwd',
    opts.cwd,
    '--session-id',
    opts.sessionId,
    '-m',
    opts.model ?? 'grok-4.5',
    // One turn: the full unified diff is already in the prompt file, so the
    // model answers from that. Multi-turn tool use under --json-schema emits
    // one intermediate body per turn, hits the ceiling mid-review, and leaves
    // structuredOutput null (observed live: stopReason Cancelled, num_turns 8).
    '--max-turns',
    '1',
    // Constrains the model to the findings shape and implies --output-format json.
    '--json-schema',
    JUDGE_DIFF_JSON_SCHEMA,
    // Large refute prompts (full unified diff) exceed the Windows argv ceiling
    // when passed via -p; --prompt-file is the path the rest of the repo uses.
    '--prompt-file',
    opts.promptFile
  ];
}

/**
 * Run the independent diff review and write evidence bound to the commit.
 *
 * @param opts - Review options.
 * @returns Report (also written to disk when possible).
 */
/**
 * Build the explicit empty-diff report. No judge is invoked: there is nothing
 * to refute, and that is not the same as "reviewed and clean".
 *
 * @param base - Shared identity fields (slug, commit, hashes, paths).
 * @returns Report with mode empty-diff, ok false, nothingToReview true.
 */
function emptyDiffReport(base: {
  slug: string;
  commit: string;
  reviewedAt: string;
  diffHash: string;
}): IndependentReviewReport {
  return {
    kind: 'independent-diff-review',
    slug: base.slug,
    commit: base.commit,
    reviewedAt: base.reviewedAt,
    diffHash: base.diffHash,
    // Step finished: we determined there is no patch. Not a silent skip.
    completed: true,
    ok: false,
    foundNothingExplicit: false,
    nothingToReview: true,
    findings: [
      {
        title: 'nothing to review',
        citation: 'orchestrator/src/loop/independentReview.ts:collectDiff',
        detail:
          'collectDiff produced an empty patch (clean tree and HEAD has no ' +
          'reviewable change) — no judge was invoked; independent review cannot ' +
          'pass on nothing. This is not "reviewed and clean".',
        passed: false
      }
    ],
    rawExcerpt: 'empty-diff: no patch collected; judge not invoked',
    mode: 'empty-diff'
  };
}

export function runIndependentDiffReview(opts: IndependentReviewOptions): IndependentReviewReport {
  const dir = resolve(opts.dir);
  const repo = opts.repoRoot ?? gitRoot(dir) ?? dir;
  const slug = basename(dir);
  const commit = headCommit(dir) ?? 'unknown';
  const diff = collectDiff(dir, opts.diffRange, opts.diffPaths);
  const diffHash = hashDiff(diff);
  const reviewedAt = new Date().toISOString();
  const outPath =
    opts.outPath ?? join(repo, 'evidence', `judge-diff-${slug}.json`);

  // Empty patch is an explicit outcome — never hand garbage to a judge, and
  // never treat "nothing to review" as "reviewed and clean" (F5 must stay false).
  // Fixture mode cannot paper over this: an empty commit must not satisfy F5.
  if (diff.trim().length === 0) {
    const report = emptyDiffReport({ slug, commit, reviewedAt, diffHash });
    // Defense: ok is always false for this mode even if someone edits the builder.
    report.ok = evaluateReviewOk(report);
    writeReport(outPath, report);
    return report;
  }

  if (opts.fixtureReport) {
    const report: IndependentReviewReport = {
      kind: 'independent-diff-review',
      slug,
      commit,
      reviewedAt,
      diffHash,
      completed: true,
      ok: opts.fixtureReport.ok ?? true,
      foundNothingExplicit: opts.fixtureReport.foundNothingExplicit ?? true,
      findings: opts.fixtureReport.findings ?? [],
      rawExcerpt: opts.fixtureReport.rawExcerpt ?? 'fixture',
      mode: 'fixture'
    };
    // Recompute ok from findings when not forced.
    if (opts.fixtureReport.ok === undefined) {
      report.ok = evaluateReviewOk(report);
    }
    writeReport(outPath, report);
    return report;
  }

  const prompt = buildRefutePrompt(slug, commit, diff);
  // Prompt (full unified diff) lives in a file: inlining it via -p blows past
  // the Windows command-line limit and Node's shell:true path re-splits prose
  // unless every arg is quoteForCmd'd (see independent_judge.mjs).
  const taskDir = mkdtempSync(join(tmpdir(), 'redanvil-judge-diff-'));
  const promptFile = join(taskDir, 'REFUTE_TASK.md');
  writeFileSync(promptFile, prompt, 'utf8');

  const grokArgv = buildIndependentReviewGrokArgs({
    cwd: dir,
    promptFile,
    sessionId: randomUUID()
  });
  // grok is a .cmd shim on Windows — needs a shell. Node's shell:true joins
  // argv without quoting, so multi-word args must be quoteForCmd'd first.
  const useShell = process.platform === 'win32';
  const finalArgv = useShell ? grokArgv.map(quoteForCmd) : grokArgv;

  let grok: ReturnType<typeof spawnSync>;
  try {
    grok = spawnSync('grok', finalArgv, {
      encoding: 'utf8',
      timeout: opts.timeoutMs ?? 600_000,
      maxBuffer: 16 * 1024 * 1024,
      shell: useShell,
      // Same allowlist as harness runGrok / lg-grok-no-secrets — not a denylist.
      env: scrubbedEnv([])
    });
  } finally {
    try {
      rmSync(taskDir, { recursive: true, force: true });
    } catch {
      /* temp dir may hold locked handles; harmless */
    }
  }

  if (grok.error || grok.status === null) {
    const report: IndependentReviewReport = {
      kind: 'independent-diff-review',
      slug,
      commit,
      reviewedAt,
      diffHash,
      completed: false,
      ok: false,
      foundNothingExplicit: false,
      findings: [
        {
          title: 'judge unavailable',
          citation: 'orchestrator/src/loop/independentReview.ts:1',
          detail:
            'grok CLI could not be run — independent review is required before done; ' +
            (grok.error instanceof Error ? grok.error.message : 'non-zero or missing binary'),
          passed: false
        }
      ],
      rawExcerpt: String(grok.stderr ?? grok.stdout ?? '').slice(0, 2000),
      mode: 'unavailable'
    };
    writeReport(outPath, report);
    return report;
  }

  // Prefer stdout (JSON envelope). stderr is diagnostic only — concat only as
  // a fallback when stdout is empty so parseJudgeJson can still fail closed.
  const stdout = typeof grok.stdout === 'string' ? grok.stdout : String(grok.stdout ?? '');
  const stderr = typeof grok.stderr === 'string' ? grok.stderr : String(grok.stderr ?? '');
  const raw = stdout.trim().length > 0 ? stdout : `${stdout}\n${stderr}`;
  const parsed = parseJudgeJson(raw);
  const report: IndependentReviewReport = {
    kind: 'independent-diff-review',
    slug,
    commit,
    reviewedAt,
    diffHash,
    completed: parsed !== null,
    ok: false,
    foundNothingExplicit: parsed?.foundNothingExplicit === true,
    findings: parsed?.findings ?? [],
    // Keep enough of multi-turn schema output for audit (each turn appends a body).
    rawExcerpt: raw.slice(0, 32_000),
    mode: 'grok'
  };
  if (parsed === null) {
    report.findings = [
      {
        title: 'unparseable judge output',
        citation: 'orchestrator/src/loop/independentReview.ts:1',
        detail: 'judge did not return JSON — cannot verify; fail closed',
        passed: false
      }
    ];
  }
  report.ok = evaluateReviewOk(report);
  writeReport(outPath, report);
  return report;
}

/**
 * Whether a completed review is acceptable for isDone.
 *
 * Empty findings require foundNothingExplicit. Any finding with passed === false
 * fails the review. mode === 'empty-diff' / nothingToReview never passes — that
 * means no judge ran, not that the code is clean.
 *
 * @param report - Review report.
 * @returns True when ok for the finish line.
 */
export function evaluateReviewOk(report: IndependentReviewReport): boolean {
  if (!report.completed) return false;
  // Nothing-to-review is never a clean pass (empty commit / empty merge hole).
  if (report.mode === 'empty-diff' || report.nothingToReview === true) return false;
  const blockers = report.findings.filter((f) => f.passed === false);
  if (blockers.length > 0) return false;
  if (report.findings.length === 0) return report.foundNothingExplicit === true;
  return true;
}

/**
 * Write the report JSON, creating evidence/ as needed.
 *
 * @param outPath - Destination path.
 * @param report - Report body.
 */
function writeReport(outPath: string, report: IndependentReviewReport): void {
  try {
    mkdirSync(join(outPath, '..'), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } catch {
    // Evidence write failure is reflected by the caller still holding the report.
  }
}

/**
 * Load a previously written independent review if it matches the commit.
 *
 * @param path - Evidence file path.
 * @param commit - Expected commit.
 * @returns Report or null.
 */
export function loadIndependentReview(
  path: string,
  commit: string
): IndependentReviewReport | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as IndependentReviewReport;
    if (raw.kind !== 'independent-diff-review') return null;
    if (raw.commit !== commit) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Read evidence/judge-diff-<slug>.json from the app dir or repo-root evidence/.
 *
 * Fail-closed: missing, unreadable, wrong kind, or malformed → null.
 * Does not check commit or ok — callers use independentReviewOkFromReport.
 *
 * @param rootDir - App or repo root.
 * @param slug - App slug used in the evidence file name.
 * @returns Parsed report, or null.
 */
export function readJudgeDiffReport(
  rootDir: string,
  slug: string
): IndependentReviewReport | null {
  // Same dual-path convention as qa-visual / refusal: app evidence/ first,
  // then parent (repo root) evidence/.
  const candidates = [
    join(rootDir, 'evidence', `judge-diff-${slug}.json`),
    join(rootDir, '..', 'evidence', `judge-diff-${slug}.json`)
  ];
  for (const abs of candidates) {
    if (!existsSync(abs)) continue;
    try {
      const raw = JSON.parse(readFileSync(abs, 'utf8')) as IndependentReviewReport;
      if (raw.kind !== 'independent-diff-review') continue;
      if (typeof raw.commit !== 'string' || raw.commit.length === 0) continue;
      if (!Array.isArray(raw.findings)) continue;
      return raw;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Whether isDone may treat the independent judge-over-diff step as satisfied.
 *
 * Fail-closed on every path:
 * - missing / unparseable report → false
 * - reviewed commit ≠ expected (stale or wrong tree) → false
 * - incomplete review, or findings that did not pass → false
 * - empty findings without foundNothingExplicit → false
 * - report.ok not explicitly true → false (hand-stamped silence is not a pass)
 *
 * Re-evaluates findings rather than trusting a hand-authored `ok: true`.
 *
 * @param report - Loaded report, or null when missing.
 * @param expectedCommit - HEAD (or gated commit) the report must be pinned to.
 * @returns True only when the review clearly passed for this commit.
 */
export function independentReviewOkFromReport(
  report: IndependentReviewReport | null,
  expectedCommit: string | null
): boolean {
  if (report === null) return false;
  if (expectedCommit === null || expectedCommit.length === 0) return false;
  if (report.commit !== expectedCommit) return false;
  if (report.completed !== true) return false;
  if (report.ok !== true) return false;
  // Recompute: a hand-authored ok:true with unresolved findings must not pass.
  return evaluateReviewOk(report);
}
