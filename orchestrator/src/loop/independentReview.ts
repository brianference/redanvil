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
import {
  allFailingFindingsAccepted,
  type AcceptedFinding
} from '../gate/acceptedFindings.mjs';
import { reviewPinCommit } from '../git/newestSourceCommit.mjs';

/**
 * How the independent review was produced.
 *
 * `empty-diff` is its own terminal state: collectDiff found nothing to hand a
 * judge, so no review ran. It must never evaluate as ok / F5 pass.
 */
export type IndependentReviewMode = 'grok' | 'fixture' | 'unavailable' | 'empty-diff';

/**
 * Raw judge output that means the reviewer could not be REACHED, as opposed to
 * answering badly. Kept separate so a 402 or a 5xx is never misreported as a
 * JSON bug -- it cost real time hunting one before the raw output showed
 * 'API error (status 402 Payment Required): Grok Build usage balance exhausted'.
 */
const REVIEWER_UNREACHABLE_RE =
  /Payment Required|balance exhausted|API error|status 4\d\d|status 5\d\d/i;

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
  /**
   * How many judge prompts ran over the split diff. Proof of multi-chunk review
   * for release-sized diffs; 1 when the whole patch fits one budget window.
   */
  chunkCount?: number;
  /**
   * Sum of original-diff character lengths covered by reviewed chunks.
   * Must equal `diffChars` for a complete review (no silent gap).
   */
  coverageChars?: number;
  /** Character length of the full unified diff that was split for review. */
  diffChars?: number;
  /**
   * True when coverageChars === diffChars and every planned chunk was reviewed.
   * A shortfall fails the aggregate (partial coverage is never a clean pass).
   */
  coverageComplete?: boolean;
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
   * Applies to the whole review (no per-chunk live calls).
   */
  fixtureReport?: Partial<IndependentReviewReport>;
  /** Per-chunk timeout for the grok CLI (ms). */
  timeoutMs?: number;
  /** Base vs head for the diff. Defaults to merge-base with main/master..HEAD. */
  diffRange?: string;
  /**
   * Path-scope for `diffRange`, so an app's judge sees that app's changes.
   * Ignored when `diffRange` is unset.
   */
  diffPaths?: string[];
  /**
   * Test-only hook: review one chunk without spawning grok. Return raw stdout
   * for parseJudgeJson (or garbage to simulate unparseable). Production never
   * sets this — one blind / unparseable chunk must fail the aggregate.
   */
  reviewChunk?: (args: {
    chunk: DiffChunk;
    index: number;
    total: number;
    prompt: string;
  }) => { stdout: string };
  /**
   * Test-only: override the per-chunk character budget (default
   * JUDGE_PROMPT_DIFF_BUDGET). Production never sets this.
   */
  diffBudget?: number;
  /**
   * Test-only: override MAX_DIFF_REVIEW_CHUNKS. Production never sets this.
   */
  maxChunks?: number;
}

/**
 * Per-prompt cap for the unified diff embedded in the judge message.
 * Release-sized diffs exceed this; they are split into chunks rather than
 * raising the cap (843KB will not fit one context).
 */
export const JUDGE_PROMPT_DIFF_BUDGET = 120_000;

/**
 * Hard ceiling on how many judge invocations one review may spawn. Hitting
 * the bound is an explicit incomplete result, not a pass.
 */
export const MAX_DIFF_REVIEW_CHUNKS = 40;

/** One file-scoped section of a unified diff (never mid-hunk). */
export interface DiffFileSection {
  /** Path from `diff --git a/X b/X`, or a placeholder when unparseable. */
  path: string;
  /** Exact slice of the original diff for this file (coverage source of truth). */
  text: string;
}

/** One self-contained patch handed to a single judge invocation. */
export interface DiffChunk {
  /** 0-based index in the planned chunk list. */
  index: number;
  /** Patch text for the prompt (file-boundary pack, or mid-file piece). */
  text: string;
  /** Character length contributed toward full-diff coverage. */
  coverageChars: number;
  /**
   * True when this piece is a mid-file split of a single file whose own diff
   * exceeded the budget (the only allowed non-file-boundary split).
   */
  splitFile: boolean;
  /** Path of the oversized file when splitFile is true. */
  splitFilePath?: string;
  /** 1-based part number within a split file (when splitFile). */
  splitPart?: number;
  /** Total parts for that oversized file (when splitFile). */
  splitParts?: number;
}

/** Result of splitting a unified diff for multi-chunk review. */
export interface DiffSplitResult {
  chunks: DiffChunk[];
  /** Full diff character length (must match sum of chunk coverage when complete). */
  diffChars: number;
  /** Sum of coverageChars across returned chunks. */
  coverageChars: number;
  /** True when more content exists than MAX_DIFF_REVIEW_CHUNKS can hold. */
  chunkLimitExceeded: boolean;
  /** Paths that required an inside-file split because they alone exceed budget. */
  splitFiles: string[];
}

/** One chunk's judge outcome before aggregation. */
export interface ChunkReviewResult {
  index: number;
  coverageChars: number;
  /** True when this chunk's stdout parsed as a findings body. */
  completed: boolean;
  foundNothingExplicit: boolean;
  findings: IndependentFinding[];
  rawExcerpt: string;
}

/** Aggregate of every chunk review — the report over the WHOLE diff. */
export interface AggregatedChunkReview {
  completed: boolean;
  ok: boolean;
  foundNothingExplicit: boolean;
  findings: IndependentFinding[];
  chunkCount: number;
  coverageChars: number;
  diffChars: number;
  coverageComplete: boolean;
  rawExcerpt: string;
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
 * Extract the b/ path from a `diff --git a/... b/...` header line.
 *
 * @param sectionText - File section starting with diff --git (ideally).
 * @returns Path string for citations / split notices.
 */
export function diffSectionPath(sectionText: string): string {
  const firstLine = sectionText.split(/\r?\n/, 1)[0] ?? '';
  const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(firstLine);
  if (m?.[2]) return m[2];
  // Rename / copy headers sometimes differ; fall back to ---/+++ paths.
  const plus = /^\+\+\+ [ab]\/(.+)$/m.exec(sectionText);
  if (plus?.[1]) return plus[1];
  return '(unknown)';
}

/**
 * Split a unified diff on FILE boundaries only (never mid-hunk, never mid-line).
 * Each section is an exact slice of the original so coverage can sum to length.
 *
 * @param diff - Full unified diff text.
 * @returns File sections in order of appearance.
 */
export function splitDiffByFile(diff: string): DiffFileSection[] {
  if (diff.length === 0) return [];

  const headerRe = /^diff --git /gm;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(diff)) !== null) {
    starts.push(match.index);
  }

  if (starts.length === 0) {
    // No standard headers (rare) — whole body is one section; never invent cuts.
    return [{ path: '(unknown)', text: diff }];
  }

  const sections: DiffFileSection[] = [];
  // Preamble before the first file header (e.g. empty) — keep bytes for coverage.
  if (starts[0]! > 0) {
    const preamble = diff.slice(0, starts[0]);
    sections.push({ path: '(preamble)', text: preamble });
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const end = i + 1 < starts.length ? starts[i + 1]! : diff.length;
    const text = diff.slice(start, end);
    sections.push({ path: diffSectionPath(text), text });
  }
  return sections;
}

/**
 * Split one oversized file section into line-bounded pieces under budget.
 * Mid-file split is only used when a single file's own diff exceeds the budget.
 *
 * @param section - File section whose text.length > budget.
 * @param budget - Per-chunk character budget.
 * @returns Pieces whose coverage sums to section.text.length.
 */
export function splitOversizedFileSection(
  section: DiffFileSection,
  budget: number
): Array<{ text: string; coverageChars: number }> {
  const text = section.text;
  if (text.length <= budget) {
    return [{ text, coverageChars: text.length }];
  }
  if (budget <= 0) {
    // Degenerate budget: still return full coverage in one piece (caller fails).
    return [{ text, coverageChars: text.length }];
  }

  const pieces: Array<{ text: string; coverageChars: number }> = [];
  let offset = 0;
  while (offset < text.length) {
    if (text.length - offset <= budget) {
      const rest = text.slice(offset);
      pieces.push({ text: rest, coverageChars: rest.length });
      break;
    }
    // Prefer a line break at or before budget; never cut mid-line when avoidable.
    let cut = offset + budget;
    const window = text.slice(offset, cut);
    const lastNl = window.lastIndexOf('\n');
    if (lastNl >= 0) {
      cut = offset + lastNl + 1; // include the newline
    } else {
      // Single line longer than budget — unavoidable mid-line split.
      cut = offset + budget;
    }
    // Always advance at least one char so a zero-width cut cannot loop forever.
    if (cut <= offset) cut = offset + 1;
    const piece = text.slice(offset, cut);
    pieces.push({ text: piece, coverageChars: piece.length });
    offset = cut;
  }
  return pieces;
}

/**
 * Pack file sections into judge-sized chunks. Whole files stay together when
 * they fit; only an oversized single file is split inside its own section.
 *
 * Coverage is exact original-diff character counts. A chunk-count ceiling
 * leaves remaining content unreviewed (`chunkLimitExceeded`) rather than
 * silently dropping it as a pass.
 *
 * @param diff - Full unified diff.
 * @param budget - Max chars of original diff per chunk (default 120_000).
 * @param maxChunks - Hard ceiling on chunk count (default MAX_DIFF_REVIEW_CHUNKS).
 * @returns Planned chunks plus coverage / limit metadata.
 */
export function splitDiffIntoChunks(
  diff: string,
  budget: number = JUDGE_PROMPT_DIFF_BUDGET,
  maxChunks: number = MAX_DIFF_REVIEW_CHUNKS
): DiffSplitResult {
  const diffChars = diff.length;
  if (diffChars === 0) {
    return {
      chunks: [],
      diffChars: 0,
      coverageChars: 0,
      chunkLimitExceeded: false,
      splitFiles: []
    };
  }

  const sections = splitDiffByFile(diff);
  const planned: DiffChunk[] = [];
  const splitFiles: string[] = [];
  let packText = '';
  let packCoverage = 0;

  /**
   * Flush the current multi-file pack as one chunk (if non-empty).
   */
  const flushPack = (): void => {
    if (packCoverage === 0 && packText.length === 0) return;
    planned.push({
      index: planned.length,
      text: packText,
      coverageChars: packCoverage,
      splitFile: false
    });
    packText = '';
    packCoverage = 0;
  };

  for (const section of sections) {
    if (section.text.length > budget) {
      flushPack();
      if (!splitFiles.includes(section.path)) splitFiles.push(section.path);
      const parts = splitOversizedFileSection(section, budget);
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p]!;
        planned.push({
          index: planned.length,
          text: part.text,
          coverageChars: part.coverageChars,
          splitFile: true,
          splitFilePath: section.path,
          splitPart: p + 1,
          splitParts: parts.length
        });
      }
      continue;
    }
    // Pack consecutive whole files while under budget (file boundaries only).
    if (packCoverage > 0 && packCoverage + section.text.length > budget) {
      flushPack();
    }
    packText += section.text;
    packCoverage += section.text.length;
  }
  flushPack();

  // Re-index after planning (stable 0..n-1).
  for (let i = 0; i < planned.length; i++) {
    planned[i] = { ...planned[i]!, index: i };
  }

  if (planned.length <= maxChunks) {
    const coverageChars = planned.reduce((s, c) => s + c.coverageChars, 0);
    return {
      chunks: planned,
      diffChars,
      coverageChars,
      chunkLimitExceeded: false,
      splitFiles
    };
  }

  // Bound hit: return only the first maxChunks; remainder is an explicit gap.
  const limited = planned.slice(0, maxChunks).map((c, i) => ({ ...c, index: i }));
  const coverageChars = limited.reduce((s, c) => s + c.coverageChars, 0);
  return {
    chunks: limited,
    diffChars,
    coverageChars,
    chunkLimitExceeded: true,
    splitFiles
  };
}

/**
 * Aggregate per-chunk judge results into one report over the WHOLE diff.
 *
 * Rules (fail closed):
 * - findings = union across chunks (+ meta findings for split files / limits)
 * - completed = every chunk completed AND coverage equals full diff length AND
 *   chunk limit was not hit
 * - ok = completed AND every finding has passed === true (empty findings need
 *   foundNothingExplicit from every chunk)
 * - One unparseable / incomplete chunk ⇒ completed false / ok false
 * - Coverage shortfall ⇒ completed false / ok false (proof of no silent gap)
 *
 * @param input - Diff size, planned chunks, and per-chunk outcomes.
 * @returns Aggregate for IndependentReviewReport fields.
 */
export function aggregateChunkReviews(input: {
  diffChars: number;
  chunks: DiffChunk[];
  results: ChunkReviewResult[];
  chunkLimitExceeded: boolean;
  splitFiles: string[];
}): AggregatedChunkReview {
  const { diffChars, chunks, results, chunkLimitExceeded, splitFiles } = input;
  const findings: IndependentFinding[] = [];
  const rawParts: string[] = [];

  // Meta: mid-file splits are explicit — never silent cuts.
  for (const path of splitFiles) {
    const partsForPath = chunks.filter((c) => c.splitFile && c.splitFilePath === path);
    const partCount = partsForPath.length > 0 ? partsForPath.length : 0;
    findings.push({
      title: 'oversized file split for review',
      citation: `${path}:1`,
      detail:
        `File "${path}" exceeded the ${JUDGE_PROMPT_DIFF_BUDGET}-char judge budget ` +
        `and was split into ${partCount} mid-file chunks so every byte could be ` +
        `reviewed. This is not a product defect; it records that the file was split ` +
        `rather than silently truncated.`,
      passed: true
    });
  }

  if (chunkLimitExceeded) {
    findings.push({
      title: 'diff chunk limit exceeded',
      citation: 'orchestrator/src/loop/independentReview.ts:splitDiffIntoChunks',
      detail:
        `Review hit MAX_DIFF_REVIEW_CHUNKS (${MAX_DIFF_REVIEW_CHUNKS}); remaining ` +
        `diff content was not judged. Explicit incomplete result — not a pass.`,
      passed: false
    });
  }

  let allChunksCompleted = true;
  let allFoundNothing = true;
  let coverageChars = 0;

  // Every planned chunk must have a result; a missing result is a blind chunk.
  if (results.length !== chunks.length) {
    allChunksCompleted = false;
    findings.push({
      title: 'missing chunk review result',
      citation: 'orchestrator/src/loop/independentReview.ts:aggregateChunkReviews',
      detail:
        `Expected ${chunks.length} chunk results, got ${results.length} — ` +
        `partial coverage must never read as a clean review.`,
      passed: false
    });
  }

  const byIndex = new Map(results.map((r) => [r.index, r]));
  for (const chunk of chunks) {
    const r = byIndex.get(chunk.index);
    if (r === undefined) {
      allChunksCompleted = false;
      allFoundNothing = false;
      continue;
    }
    coverageChars += r.coverageChars;
    rawParts.push(`--- chunk ${r.index + 1}/${chunks.length} ---\n${r.rawExcerpt}`);
    if (!r.completed) {
      allChunksCompleted = false;
      allFoundNothing = false;
      // Prefer the chunk's own unparseable finding when present.
      if (r.findings.length > 0) {
        findings.push(...r.findings);
      } else {
        // Name the real cause. A reviewer that could not RUN is not a reviewer
        // that answered badly, and calling a 402 'unparseable judge output' sent
        // me hunting a JSON bug for a while before the raw output showed
        // 'API error (status 402 Payment Required): Grok Build usage balance
        // exhausted'. Both still fail closed -- the distinction is diagnostic,
        // not permissive.
        const raw = String(r.rawExcerpt ?? '');
        const unavailable = REVIEWER_UNREACHABLE_RE.test(raw);
        findings.push({
          title: unavailable ? 'judge could not run' : 'unparseable judge output',
          citation: 'orchestrator/src/loop/independentReview.ts:1',
          detail: unavailable
            ? `chunk ${r.index + 1}/${chunks.length}: the reviewer could not be reached — ${raw.slice(0, 200)} — cannot verify; fail closed`
            : `chunk ${r.index + 1}/${chunks.length} did not return JSON — cannot verify; fail closed`,
          passed: false
        });
      }
      continue;
    }
    if (!r.foundNothingExplicit) allFoundNothing = false;
    findings.push(...r.findings);
  }

  const coverageComplete =
    coverageChars === diffChars && !chunkLimitExceeded && results.length === chunks.length;
  if (!coverageComplete && coverageChars !== diffChars) {
    findings.push({
      title: 'diff coverage shortfall',
      citation: 'orchestrator/src/loop/independentReview.ts:aggregateChunkReviews',
      detail:
        `Summed chunk coverage (${coverageChars}) !== full diff length (${diffChars}). ` +
        `A coverage shortfall means the diff was not fully reviewed.`,
      passed: false
    });
  }

  // When every original-diff byte was reviewed, drop findings that only refuse
  // because the model saw one chunk (or invented truncation). The old single-
  // prompt path correctly emitted "diff truncated; cannot verify full change
  // set" when we cut at 120k — that refusal stays whenever coverage is incomplete.
  // With full coverage it is noise, not a product defect.
  const productFindings = coverageComplete
    ? findings.filter((f) => !isScopeTruncationFinding(f))
    : findings;

  const completed = allChunksCompleted && coverageComplete && !chunkLimitExceeded;
  const foundNothingExplicit =
    completed &&
    allFoundNothing &&
    productFindings.every((f) => f.passed === true) &&
    results.every((r) => r.completed && r.foundNothingExplicit) &&
    results.every((r) => r.findings.length === 0);

  // ok: every chunk completed AND every finding passed (including meta).
  const anyBlocker = productFindings.some((f) => f.passed === false);
  const ok =
    completed &&
    !anyBlocker &&
    (productFindings.length === 0 ? foundNothingExplicit : true);

  return {
    completed,
    ok,
    foundNothingExplicit,
    findings: productFindings,
    chunkCount: chunks.length,
    coverageChars,
    diffChars,
    coverageComplete,
    rawExcerpt: rawParts.join('\n').slice(0, 32_000)
  };
}

/**
 * True when a finding only complains that the judge prompt was truncated or
 * that this chunk is not the whole release — not a product defect in the diff.
 *
 * @param f - Finding from a chunk judge.
 * @returns Whether to drop it once full-diff coverage is proven.
 */
export function isScopeTruncationFinding(f: IndependentFinding): boolean {
  const text = `${f.title}\n${f.detail}`.toLowerCase();
  // Keep real mid-file product issues; only drop "I cannot see the rest" refusals.
  // Require a truncation/scope signal — avoid dropping unrelated "cannot verify X".
  const hasTruncationSignal =
    /truncat/.test(text) ||
    /incomplete review scope/.test(text) ||
    /full change set/.test(text);
  if (!hasTruncationSignal) return false;
  const patterns = [
    /diff truncated/,
    /truncated at \d+ chars for the judge prompt/,
    /incomplete review scope/,
    /chunk truncation/,
    /cannot verify full change set/,
    /truncated mid-(file|hunk|chunk)/,
    /mid-(file|hunk|chunk) truncated/,
    /chunk mid-truncated/,
    /mid-truncated/,
    /middle truncated/,
    /provided (unified )?diff was truncated/,
    /only (the )?visible portions? can be judged/,
    /judge payload/,
    /in the (provided|judge) (chunk|payload|input)/,
    /truncated in (the )?payload/,
    /cannot be verified from this chunk/,
    /not fully (present|provided|visible) in this chunk/,
    /prompt truncated/,
    /full offload/,
    /offloaded prompt/,
    /orchestrator truncation marker/,
    /reading full offload/
  ];
  return patterns.some((re) => re.test(text));
}

/**
 * Build the refute prompt. The judge receives the DIFF, not a summary.
 *
 * Keeps the 120_000-char truncation notice for the single-chunk safety path
 * (do not raise the cap). Callers should pass already-budgeted chunks so the
 * truncation branch is only a last-resort guard, never the release-diff plan.
 *
 * @param slug - App slug.
 * @param commit - HEAD commit.
 * @param diff - Unified diff (full or one chunk).
 * @param meta - Optional multi-chunk context for the judge header.
 * @returns Prompt text.
 */
export function buildRefutePrompt(
  slug: string,
  commit: string,
  diff: string,
  meta?: {
    chunkIndex: number;
    chunkTotal: number;
    coverageChars: number;
    diffChars: number;
    splitFile?: boolean;
    splitFilePath?: string;
    splitPart?: number;
    splitParts?: number;
  }
): string {
  const clipped =
    diff.length > JUDGE_PROMPT_DIFF_BUDGET
      ? `${diff.slice(0, JUDGE_PROMPT_DIFF_BUDGET)}\n\n[diff truncated at ${JUDGE_PROMPT_DIFF_BUDGET} chars for the judge prompt]`
      : diff;

  const chunkHeader =
    meta !== undefined && meta.chunkTotal > 1
      ? [
          ``,
          `## Chunk scope`,
          ``,
          `This is chunk ${meta.chunkIndex + 1} of ${meta.chunkTotal} for the full`,
          `release diff (${meta.diffChars} chars total). Review ONLY the patch in`,
          `this message. Other chunks are reviewed separately; findings are unioned.`,
          meta.splitFile
            ? `NOTE: file "${meta.splitFilePath ?? '(unknown)'}" exceeded the per-prompt ` +
              `budget and was split — this is part ${meta.splitPart ?? '?'} of ` +
              `${meta.splitParts ?? '?'} for that file (not a silent truncation).`
            : `This chunk is packed on file boundaries (no mid-hunk cuts).`,
          ``,
          `IMPORTANT: Do NOT emit a finding titled or about "diff truncated",`,
          `"incomplete review scope", "chunk truncation", or "cannot verify full`,
          `change set" solely because this is one chunk of many. The orchestrator`,
          `already reviews every chunk and aggregates coverage. Only report real`,
          `defects visible in THIS patch. If a file in this chunk is complete here,`,
          `judge it fully; do not invent truncation.`,
          ``
        ].join('\n')
      : '';

  return `You are an INDEPENDENT code judge. You did NOT write this code.

Review the REAL git diff for \`${slug}\` at commit ${commit}.
Your job is to REFUTE the author: find what they missed, cite file:line from
the diff, and FAIL anything you cannot verify.

PASS is the claim that needs proof, not FAIL. If you cannot verify a change,
it does not pass.
${chunkHeader}
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

/**
 * Invoke grok once for a single chunk's prompt file.
 *
 * @param dir - App cwd for the CLI.
 * @param prompt - Full refute prompt text.
 * @param timeoutMs - Per-chunk spawn timeout.
 * @returns stdout text, or an error marker when the binary cannot run.
 */
function invokeGrokForChunk(
  dir: string,
  prompt: string,
  timeoutMs: number
): { stdout: string; unavailable: boolean; detail: string } {
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

  try {
    const grok = spawnSync('grok', finalArgv, {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      shell: useShell,
      // Same allowlist as harness runGrok / lg-grok-no-secrets — not a denylist.
      env: scrubbedEnv([])
    });
    if (grok.error || grok.status === null) {
      return {
        stdout: String(grok.stderr ?? grok.stdout ?? ''),
        unavailable: true,
        detail:
          'grok CLI could not be run — independent review is required before done; ' +
          (grok.error instanceof Error ? grok.error.message : 'non-zero or missing binary')
      };
    }
    const stdout = typeof grok.stdout === 'string' ? grok.stdout : String(grok.stdout ?? '');
    const stderr = typeof grok.stderr === 'string' ? grok.stderr : String(grok.stderr ?? '');
    // Prefer stdout (JSON envelope). stderr is diagnostic only — concat only as
    // a fallback when stdout is empty so parseJudgeJson can still fail closed.
    const raw = stdout.trim().length > 0 ? stdout : `${stdout}\n${stderr}`;
    return { stdout: raw, unavailable: false, detail: '' };
  } finally {
    try {
      rmSync(taskDir, { recursive: true, force: true });
    } catch {
      /* temp dir may hold locked handles; harmless */
    }
  }
}

export function runIndependentDiffReview(opts: IndependentReviewOptions): IndependentReviewReport {
  const dir = resolve(opts.dir);
  const repo = opts.repoRoot ?? gitRoot(dir) ?? dir;
  const slug = basename(dir);
  // Pin to the app's newest SOURCE commit (not repo HEAD). Evidence-only commits
  // the gate itself makes must not force a re-review; a real source edit must.
  const commit = reviewPinCommit(dir) ?? headCommit(dir) ?? 'unknown';
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
    const split = splitDiffIntoChunks(diff);
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
      mode: 'fixture',
      chunkCount: opts.fixtureReport.chunkCount ?? split.chunks.length,
      coverageChars: opts.fixtureReport.coverageChars ?? split.diffChars,
      diffChars: opts.fixtureReport.diffChars ?? split.diffChars,
      coverageComplete: opts.fixtureReport.coverageComplete ?? true
    };
    // Recompute ok from findings when not forced.
    if (opts.fixtureReport.ok === undefined) {
      report.ok = evaluateReviewOk(report);
    }
    writeReport(outPath, report);
    return report;
  }

  // Split on file boundaries so every byte of a release-sized diff is judged.
  // Never raise the per-prompt cap — 843KB will not fit one context.
  const split = splitDiffIntoChunks(
    diff,
    opts.diffBudget ?? JUDGE_PROMPT_DIFF_BUDGET,
    opts.maxChunks ?? MAX_DIFF_REVIEW_CHUNKS
  );
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const chunkResults: ChunkReviewResult[] = [];
  let unavailableDetail: string | null = null;

  for (const chunk of split.chunks) {
    const prompt = buildRefutePrompt(slug, commit, chunk.text, {
      chunkIndex: chunk.index,
      chunkTotal: split.chunks.length,
      coverageChars: chunk.coverageChars,
      diffChars: split.diffChars,
      splitFile: chunk.splitFile,
      splitFilePath: chunk.splitFilePath,
      splitPart: chunk.splitPart,
      splitParts: chunk.splitParts
    });

    let raw: string;
    if (opts.reviewChunk) {
      raw = opts.reviewChunk({
        chunk,
        index: chunk.index,
        total: split.chunks.length,
        prompt
      }).stdout;
    } else {
      const invoked = invokeGrokForChunk(dir, prompt, timeoutMs);
      if (invoked.unavailable) {
        unavailableDetail = invoked.detail;
        chunkResults.push({
          index: chunk.index,
          coverageChars: chunk.coverageChars,
          completed: false,
          foundNothingExplicit: false,
          findings: [
            {
              title: 'judge unavailable',
              citation: 'orchestrator/src/loop/independentReview.ts:1',
              detail: `${invoked.detail} (chunk ${chunk.index + 1}/${split.chunks.length})`,
              passed: false
            }
          ],
          rawExcerpt: invoked.stdout.slice(0, 2000)
        });
        // Still walk remaining chunks' coverage accounting via short-circuit:
        // one unavailable chunk already fails the aggregate; mark the rest incomplete.
        for (let j = chunk.index + 1; j < split.chunks.length; j++) {
          const rest = split.chunks[j]!;
          chunkResults.push({
            index: rest.index,
            coverageChars: rest.coverageChars,
            completed: false,
            foundNothingExplicit: false,
            findings: [
              {
                title: 'judge unavailable',
                citation: 'orchestrator/src/loop/independentReview.ts:1',
                detail: `skipped after unavailable chunk ${chunk.index + 1} — ${invoked.detail}`,
                passed: false
              }
            ],
            rawExcerpt: ''
          });
        }
        break;
      }
      raw = invoked.stdout;
    }

    // One retry on unparseable live output — multi-chunk reviews amplify
    // transient CLI/schema failures, and a single flaky chunk would otherwise
    // discard an otherwise full review (fail-closed still applies if retry fails).
    let parsed = parseJudgeJson(raw);
    if (parsed === null && !opts.reviewChunk) {
      const retry = invokeGrokForChunk(dir, prompt, timeoutMs);
      if (!retry.unavailable) {
        raw = retry.stdout;
        parsed = parseJudgeJson(raw);
      }
    }
    if (parsed === null) {
      chunkResults.push({
        index: chunk.index,
        coverageChars: chunk.coverageChars,
        completed: false,
        foundNothingExplicit: false,
        findings: [
          {
            // See the note at the aggregate site: a reviewer that could not RUN
            // is not one that answered badly. Both fail closed.
            title: REVIEWER_UNREACHABLE_RE.test(raw)
              ? 'judge could not run'
              : 'unparseable judge output',
            citation: 'orchestrator/src/loop/independentReview.ts:1',
            detail: REVIEWER_UNREACHABLE_RE.test(raw)
              ? `chunk ${chunk.index + 1}/${split.chunks.length}: the reviewer could not be reached — ` +
                `${raw.slice(0, 200)} — cannot verify; fail closed`
              : `chunk ${chunk.index + 1}/${split.chunks.length} did not return JSON — ` +
                `cannot verify; fail closed`,
            passed: false
          }
        ],
        rawExcerpt: raw.slice(0, 4000)
      });
    } else {
      chunkResults.push({
        index: chunk.index,
        coverageChars: chunk.coverageChars,
        completed: true,
        foundNothingExplicit: parsed.foundNothingExplicit === true,
        findings: parsed.findings,
        rawExcerpt: raw.slice(0, 4000)
      });
    }
  }

  const aggregated = aggregateChunkReviews({
    diffChars: split.diffChars,
    chunks: split.chunks,
    results: chunkResults,
    chunkLimitExceeded: split.chunkLimitExceeded,
    splitFiles: split.splitFiles
  });

  const mode: IndependentReviewMode =
    unavailableDetail !== null ? 'unavailable' : 'grok';

  const report: IndependentReviewReport = {
    kind: 'independent-diff-review',
    slug,
    commit,
    reviewedAt,
    diffHash,
    completed: aggregated.completed,
    ok: false,
    foundNothingExplicit: aggregated.foundNothingExplicit,
    findings: aggregated.findings,
    rawExcerpt: aggregated.rawExcerpt,
    mode,
    chunkCount: aggregated.chunkCount,
    coverageChars: aggregated.coverageChars,
    diffChars: aggregated.diffChars,
    coverageComplete: aggregated.coverageComplete
  };
  // Re-evaluate so ok never drifts from completed + findings rules.
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
 * Options for release-path acceptance of individual failing findings.
 */
export interface IndependentReviewOkOpts {
  /** App slug the acceptances are scoped to (defaults to report.slug). */
  app?: string;
  /**
   * Per-finding acceptances from `.redanvil/known-issues.json`.
   * Each must name one app, one finding (title+citation), one commit.
   * Wildcards / 'all' are rejected by the loader and never match here.
   */
  acceptedFindings?: ReadonlyArray<AcceptedFinding>;
}

/**
 * Whether isDone may treat the independent judge-over-diff step as satisfied.
 *
 * Fail-closed on every path:
 * - missing / unparseable report → false
 * - reviewed commit ≠ expected (stale or wrong tree) → false
 * - incomplete review / empty-diff → false
 * - empty findings without foundNothingExplicit → false
 * - failing findings not each listed as accepted at this commit → false
 *
 * Clean path: re-evaluates findings rather than trusting a hand-authored `ok`.
 * Acceptance path: every failing finding must be individually listed for the
 * app at the reviewed commit. A waiver records a decision; it does not hide
 * the defect (callers still print the findings).
 *
 * @param report - Loaded report, or null when missing.
 * @param expectedCommit - App's newest SOURCE commit the report must match.
 * @param opts - Optional per-finding acceptances for this release.
 * @returns True only when the review is clean, or every failure is accepted.
 */
export function independentReviewOkFromReport(
  report: IndependentReviewReport | null,
  expectedCommit: string | null,
  opts: IndependentReviewOkOpts = {}
): boolean {
  if (report === null) return false;
  if (expectedCommit === null || expectedCommit.length === 0) return false;
  if (report.commit !== expectedCommit) return false;
  if (report.completed !== true) return false;
  // empty-diff / nothingToReview: no judge ran — never F5 pass.
  if (report.mode === 'empty-diff' || report.nothingToReview === true) return false;

  // Clean path: recompute from findings (hand-stamped ok:true with blockers fails).
  if (evaluateReviewOk(report)) return true;

  // Acceptance path: every failing finding individually accepted at this commit.
  const blockers = report.findings.filter((f) => f.passed === false);
  if (blockers.length === 0) return false;
  const app = opts.app ?? report.slug;
  const accepted = opts.acceptedFindings ?? [];
  return allFailingFindingsAccepted(report, accepted, app);
}
