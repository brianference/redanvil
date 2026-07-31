import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ValidationError } from '../errors';
import { loadRubric } from '../rubric/index';
import { findStaleVerdicts, verdictScope, commitTimeMs } from '../gate/freshness';
import type { ChangeProbe, StaleVerdict } from '../gate/freshness';
import type { Outcome } from '../gate/score';

/**
 * A recorded human/judge verdict for one rule.
 *
 * Verdicts carry the majority of the score — the rules no static check can
 * decide. Previously the file was a bare list of `{ruleId, passed}` with no
 * evidence, no timestamp and no commit, and it was not hashed into provenance,
 * so the CI reproduction fed the same unaudited assertions back to itself and
 * could never contradict them. A verdict now has to say what it looked at.
 */
export const VerdictSchema = z.object({
  ruleId: z.string().min(2),
  passed: z.boolean(),
  /** Only rules a machine cannot decide may be supplied by verdict. */
  method: z.enum(['judge', 'visual']),
  /** Repo-relative paths to what was actually reviewed. Must exist on disk. */
  evidence: z.array(z.string().min(1)).min(1),
  /** One line on what was observed, so a reader can challenge the verdict. */
  note: z.string().min(3),
  reviewedAt: z.string().datetime(),
  reviewedCommit: z.string().min(7),
  /**
   * Repo-relative path prefixes this verdict speaks for. Optional: with no scope
   * the verdict covers the whole app directory, which is the conservative
   * reading. Narrowing it keeps an unrelated edit from expiring a verdict, but
   * a scope that is too narrow is a way to make a verdict immortal, so it is
   * reviewed like any other claim.
   */
  scope: z.array(z.string().min(1)).optional()
});

export const VerdictListSchema = z.array(VerdictSchema).min(1);

export type Verdict = z.infer<typeof VerdictSchema>;

/** The rule whose pass must be backed by a real axe-core report. */
const CONTRAST_RULE_ID = 'fe-a11y-contrast';
/** The rule whose pass must be backed by a real rendered-width measurement. */
const WIDTH_RULE_ID = 'fe-desktop-width';

/**
 * Rules measured by `design_audit.mjs`.
 *
 * Third-audit finding: 15 rules had method `visual` and only three were backed
 * by a machine report. The other twelve rested on a hand-typed note — even
 * though most were genuinely being measured in throwaway scripts whose numbers
 * were then retyped into a sentence. The measurement existed; the evidence
 * chain did not. A passing verdict for any of these must now cite a report in
 * which that specific rule is `ok`.
 */
const DESIGN_AUDIT_RULE_IDS: ReadonlySet<string> = new Set([
  'fe-touch-targets',
  'fe-type-floor',
  'fe-responsive-375',
  'fe-safe-areas',
  'fe-premium-nav',
  'fe-noncolor-state',
  'fe-no-attribution',
  'fe-cross-link',
  'fe-seo-og',
  'fe-light-dark',
  'fe-required-pages',
  'fe-visual-review-recorded',
  'fe-cold-visitor'
]);

/** Shape `design_audit.mjs` writes. */
const DesignAuditSchema = z.object({
  baseUrl: z.string().min(1),
  checkedAt: z.string().min(1),
  findings: z.record(z.string(), z.object({ ok: z.boolean(), detail: z.string() })),
  ok: z.boolean()
});

/**
 * Check that a passing verdict for a design-audit rule cites a report in which
 * THAT rule was measured and passed.
 *
 * @param verdict - The verdict being validated.
 * @param repoRoot - Root that evidence paths resolve against.
 * @returns Problems found; empty when the evidence supports the pass.
 */
function designAuditIssues(verdict: Verdict, repoRoot: string): string[] {
  const reports = verdict.evidence.filter((p) => /\.json$/i.test(p));
  for (const path of reports) {
    const full = join(repoRoot, path);
    if (!existsSync(full)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(full, 'utf8'));
    } catch {
      continue;
    }
    const report = DesignAuditSchema.safeParse(parsed);
    if (!report.success) continue;
    const finding = report.data.findings[verdict.ruleId];
    if (finding === undefined) {
      return [`${verdict.ruleId}: ${path} is a design audit but does not measure this rule`];
    }
    if (!finding.ok) {
      return [
        `${verdict.ruleId}: ${path} records a FAILING measurement (${finding.detail}) — ` +
          `that is not a pass`
      ];
    }
    return [];
  }
  return [
    `${verdict.ruleId}: a passing verdict must cite a report from ` +
      `.github/scripts/design_audit.mjs measuring this rule, not only screenshots`
  ];
}

/** Shape `desktop_width.mjs` writes. Only the fields the gate reads are modelled. */
const WidthReportSchema = z.object({
  baseUrl: z.string().min(1),
  checkedAt: z.string().min(1),
  minPct: z.number(),
  results: z
    .array(
      z.object({
        route: z.string().min(1),
        width: z.number(),
        // `contentPct`, not `mainPct`: the report used to record the width of
        // the `main` container, which is 100% of its parent by default and so
        // read 93% for a page whose content sat in the left third. It now
        // records the PAINTED extent. Requiring the new field name means an old
        // report cannot quietly satisfy the rule it was wrong about.
        contentPct: z.number().nullable(),
        ok: z.boolean()
      })
    )
    .min(1),
  ok: z.boolean()
});

/**
 * Check that a passing desktop-width verdict is backed by a real measurement
 * across more than one desktop width. One width proves nothing: a rem cap reads
 * as 90% at 1600 and 75% at 1920, which is exactly how this shipped narrow four
 * times before the rule existed.
 *
 * @param verdict - The width verdict.
 * @param repoRoot - Root that evidence paths resolve against.
 * @returns Problems found; empty when the evidence supports the pass.
 */
function widthEvidenceIssues(verdict: Verdict, repoRoot: string): string[] {
  const issues: string[] = [];
  const reports = verdict.evidence.filter((p) => /\.json$/i.test(p));
  if (reports.length === 0) {
    return [
      `${WIDTH_RULE_ID}: a passing verdict must cite a report from ` +
        `.github/scripts/desktop_width.mjs, not only screenshots`
    ];
  }
  for (const path of reports) {
    const full = join(repoRoot, path);
    if (!existsSync(full)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(full, 'utf8'));
    } catch {
      issues.push(`${WIDTH_RULE_ID}: ${path} is not parseable JSON`);
      continue;
    }
    const report = WidthReportSchema.safeParse(parsed);
    if (!report.success) {
      issues.push(`${WIDTH_RULE_ID}: ${path} is not a desktop_width report`);
      continue;
    }
    const failed = report.data.results.filter((r) => !r.ok);
    if (failed.length > 0) {
      issues.push(
        `${WIDTH_RULE_ID}: ${path} records ${failed.length} route/width combination(s) ` +
          `under ${report.data.minPct}% — that is a failing measurement, not a pass`
      );
    }
    const widths = new Set(report.data.results.map((r) => r.width));
    if (widths.size < 2) {
      issues.push(
        `${WIDTH_RULE_ID}: ${path} measured only one viewport width; a rem cap passes ` +
          `at one width and fails at another, so at least two are required`
      );
    }
  }
  return issues;
}

/**
 * Shape `a11y_audit.mjs` writes. Only the fields the gate reads are modelled;
 * anything else in the report is ignored rather than rejected.
 */
const AxeReportSchema = z.object({
  url: z.string().min(1),
  theme: z.string().min(1),
  checkedAt: z.string().min(1),
  axeVersion: z.string().min(1),
  contrastViolationNodes: z.number().int().nonnegative()
});

/**
 * Check that a passing contrast verdict is backed by axe reports showing zero
 * contrast violations, in BOTH themes. One theme passing says nothing about the
 * other, and this project shipped a dark-mode contrast regression while light
 * mode was clean.
 *
 * @param verdict - The contrast verdict.
 * @param repoRoot - Root that evidence paths resolve against.
 * @returns Problems found; empty when the evidence supports the pass.
 */
function contrastEvidenceIssues(verdict: Verdict, repoRoot: string): string[] {
  const issues: string[] = [];
  const themesSeen = new Set<string>();

  const reports = verdict.evidence.filter((p) => /\.json$/i.test(p));
  if (reports.length === 0) {
    return [
      `${CONTRAST_RULE_ID}: a passing contrast verdict must cite an axe-core report ` +
        `(a .json written by .github/scripts/a11y_audit.mjs), not only screenshots`
    ];
  }

  for (const path of reports) {
    const full = join(repoRoot, path);
    if (!existsSync(full)) continue; // already reported as missing evidence
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(full, 'utf8'));
    } catch {
      issues.push(`${CONTRAST_RULE_ID}: ${path} is not parseable JSON`);
      continue;
    }
    const report = AxeReportSchema.safeParse(parsed);
    if (!report.success) {
      issues.push(`${CONTRAST_RULE_ID}: ${path} is not an axe report from a11y_audit.mjs`);
      continue;
    }
    if (report.data.contrastViolationNodes > 0) {
      issues.push(
        `${CONTRAST_RULE_ID}: ${path} records ${report.data.contrastViolationNodes} ` +
          `contrast violation node(s) — that is a failing measurement, not a pass`
      );
    }
    themesSeen.add(report.data.theme.toLowerCase());
  }

  for (const theme of ['dark', 'light']) {
    if (!themesSeen.has(theme)) {
      issues.push(`${CONTRAST_RULE_ID}: no axe report for the ${theme} theme`);
    }
  }
  return issues;
}

/** Report shape common to every evidence artifact: it records when it ran. */
const TimestampedReportSchema = z.object({ checkedAt: z.string().min(1) });

/**
 * Reject a verdict whose cited report predates the commit it vouches for.
 *
 * Re-stamping `reviewedCommit` is cheap; re-running the measurement is not, and
 * nothing previously forced the two to happen together.
 *
 * @param verdict - The verdict being validated.
 * @param repoRoot - Repository root.
 * @returns Problems found; empty when every cited report is at least as new as the commit.
 */
function staleReportIssues(verdict: Verdict, repoRoot: string): string[] {
  const commitMs = commitTimeMs(verdict.reviewedCommit, repoRoot);
  if (commitMs === null) return [];
  const issues: string[] = [];
  for (const path of verdict.evidence.filter((p) => /\.json$/i.test(p))) {
    const full = join(repoRoot, path);
    if (!existsSync(full)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(full, 'utf8'));
    } catch {
      continue;
    }
    const report = TimestampedReportSchema.safeParse(parsed);
    if (!report.success) continue;
    const ranMs = Date.parse(report.data.checkedAt);
    if (!Number.isFinite(ranMs)) continue;
    // One minute of slack: a report written moments before the commit that
    // contains it is the normal, honest ordering.
    if (ranMs < commitMs - 60_000) {
      issues.push(
        `${verdict.ruleId}: ${path} was produced at ${report.data.checkedAt}, BEFORE the ` +
          `commit it vouches for (${verdict.reviewedCommit.slice(0, 12)}). Re-run the ` +
          `measurement; re-stamping a verdict is not re-measuring it.`
      );
    }
  }
  return issues;
}

/**
 * Parse and validate a verdicts file, then check it against the rubric and disk.
 *
 * Fails closed on: malformed JSON, a verdict for a rule the rubric decides
 * deterministically (those must be measured, never asserted), a verdict whose
 * declared method disagrees with the rubric, and any evidence path that does
 * not exist.
 *
 * Freshness is checked when `freshness` is supplied: a verdict whose reviewed
 * subject changed since `reviewedCommit` is DROPPED from the returned outcomes
 * and reported separately. Dropping leaves its rule unrecorded, which fails
 * closed. A recorded review that no longer describes the code is not a weaker
 * pass, it is not a review at all.
 *
 * @param raw - Raw file contents.
 * @param source - Path used in error messages.
 * @param repoRoot - Root that evidence paths resolve against.
 * @param freshness - App dir (repo-relative) and change probe. Omit to skip the check.
 * @returns Fresh outcomes for the gate, plus any verdicts found stale.
 */
export function parseVerdicts(
  raw: string,
  source: string,
  repoRoot = process.cwd(),
  freshness?: { appDirRel: string; probe: ChangeProbe }
): { outcomes: Outcome[]; stale: StaleVerdict[] } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ValidationError(`${source}: not valid JSON`, ['file is not parseable JSON']);
  }

  const parsed = VerdictListSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      `${source}: not a valid verdict list`,
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    );
  }

  const byId = new Map(loadRubric().map((r) => [r.id, r]));
  const issues: string[] = [];

  for (const v of parsed.data) {
    const rule = byId.get(v.ruleId);
    if (rule === undefined) {
      issues.push(`${v.ruleId}: not a rule in the rubric`);
      continue;
    }
    if (rule.method === 'det' || rule.method === 'hook') {
      issues.push(
        `${v.ruleId}: method '${rule.method}' is decided by a check — it cannot be supplied as a verdict`
      );
    } else {
      // The declared verdict method must match how the rubric decides the rule.
      // A `visual` rule (contrast, layout) cannot be satisfied by a `judge`
      // (code-reading) verdict, and vice versa — the comment above promised this
      // but only the det/hook case was enforced. `det+judge` accepts the judge
      // half here (the det half runs as a check separately).
      const expected = rule.method === 'det+judge' ? 'judge' : rule.method;
      if (v.method !== expected) {
        issues.push(
          `${v.ruleId}: verdict method '${v.method}' does not match rubric method '${rule.method}' (expected '${expected}')`
        );
      }
    }
    for (const path of v.evidence) {
      if (!existsSync(join(repoRoot, path))) {
        issues.push(`${v.ruleId}: evidence not found: ${path}`);
      }
    }
    // Contrast is the one rule with a standards-based measurement already in the
    // repo. `a11y_audit.mjs` runs axe-core against the live site on a daily
    // cadence, and its result touched nothing: the blocker was decided by a
    // hand-typed note while the real measurement sat unread in evidence/axe.
    // A pass here now has to carry that artifact, and the artifact has to say
    // zero. Base rule 16: use the standard implementation, never a hand reading.
    if (v.ruleId === CONTRAST_RULE_ID && v.passed) {
      issues.push(...contrastEvidenceIssues(v, repoRoot));
    }
    if (v.ruleId === WIDTH_RULE_ID && v.passed) {
      issues.push(...widthEvidenceIssues(v, repoRoot));
    }
    // A verdict can be re-stamped to a newer commit without re-running the
    // measurement it cites. That happened: an e2e report from before a wizard
    // change was carried forward onto a commit where the flow was broken, and
    // the freshness check passed because the FILE had not moved. A cited report
    // must have been produced at or after the commit it vouches for.
    if (v.passed && DESIGN_AUDIT_RULE_IDS.has(v.ruleId)) {
      issues.push(...designAuditIssues(v, repoRoot));
    }
    if (v.passed && freshness !== undefined) {
      issues.push(...staleReportIssues(v, repoRoot));
    }
  }

  if (issues.length > 0) throw new ValidationError(`${source}: invalid verdicts`, issues);

  const stale =
    freshness === undefined
      ? []
      : findStaleVerdicts(
          parsed.data,
          (v) => verdictScope(v, freshness.appDirRel),
          freshness.probe
        );
  const staleIds = new Set(stale.map((s) => s.ruleId));

  return {
    outcomes: parsed.data
      .filter((v) => !staleIds.has(v.ruleId))
      .map((v) => ({ ruleId: v.ruleId, passed: v.passed })),
    stale
  };
}
