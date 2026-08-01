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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

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
   */
  ok: boolean;
  /** Explicit statement that the judge found nothing (required when empty). */
  foundNothingExplicit: boolean;
  /** Individual refute findings. */
  findings: IndependentFinding[];
  /** Raw judge stdout (truncated) for audit. */
  rawExcerpt: string;
  /** How the review was produced. */
  mode: 'grok' | 'fixture' | 'unavailable';
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
function headCommit(dir: string): string | null {
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
 * Unified diff for the review. Prefers staged+unstaged against HEAD, else
 * last commit, else empty.
 *
 * @param dir - Git directory.
 * @param range - Optional explicit range (e.g. `main...HEAD`).
 * @returns Diff text.
 */
export function collectDiff(dir: string, range?: string): string {
  try {
    if (range) {
      return execFileSync('git', ['diff', range], {
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
the diff or the tree, and FAIL anything you cannot verify.

PASS is the claim that needs proof, not FAIL. If you cannot verify a change,
it does not pass.

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

## THE DIFF (not a summary)

\`\`\`diff
${clipped.length === 0 ? '(empty diff — tree is clean and HEAD has no patch; say so explicitly)' : clipped}
\`\`\`
`;
}

/**
 * Parse judge JSON from stdout (tolerate surrounding prose).
 *
 * @param text - Raw judge output.
 * @returns Parsed findings payload or null.
 */
export function parseJudgeJson(text: string): {
  foundNothingExplicit: boolean;
  findings: IndependentFinding[];
} | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as {
      foundNothingExplicit?: unknown;
      findings?: unknown;
    };
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
    return {
      foundNothingExplicit: raw.foundNothingExplicit === true,
      findings
    };
  } catch {
    return null;
  }
}

/**
 * Run the independent diff review and write evidence bound to the commit.
 *
 * @param opts - Review options.
 * @returns Report (also written to disk when possible).
 */
export function runIndependentDiffReview(opts: IndependentReviewOptions): IndependentReviewReport {
  const dir = resolve(opts.dir);
  const repo = opts.repoRoot ?? gitRoot(dir) ?? dir;
  const slug = basename(dir);
  const commit = headCommit(dir) ?? 'unknown';
  const diff = collectDiff(dir, opts.diffRange);
  const diffHash = hashDiff(diff);
  const reviewedAt = new Date().toISOString();
  const outPath =
    opts.outPath ?? join(repo, 'evidence', `judge-diff-${slug}.json`);

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
  // Prefer the real grok CLI when available.
  const grok = spawnSync(
    'grok',
    [
      '-p',
      prompt,
      '--grokmodel',
      'grok-4.5',
      '-d',
      dir,
      '--max-turns',
      '8',
      '--fail-on-tool-errors'
    ],
    {
      encoding: 'utf8',
      timeout: opts.timeoutMs ?? 600_000,
      maxBuffer: 16 * 1024 * 1024,
      shell: process.platform === 'win32'
    }
  );

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

  const raw = `${grok.stdout ?? ''}\n${grok.stderr ?? ''}`;
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
    rawExcerpt: raw.slice(0, 4000),
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
 * fails the review.
 *
 * @param report - Review report.
 * @returns True when ok for the finish line.
 */
export function evaluateReviewOk(report: IndependentReviewReport): boolean {
  if (!report.completed) return false;
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
