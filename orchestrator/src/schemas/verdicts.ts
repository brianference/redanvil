import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ValidationError } from '../errors';
import { loadRubric } from '../rubric/index';
import { findStaleVerdicts, verdictScope } from '../gate/freshness';
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
