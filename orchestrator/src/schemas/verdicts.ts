import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ValidationError } from '../errors';
import { loadRubric } from '../rubric/index';
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
  reviewedCommit: z.string().min(7)
});

export const VerdictListSchema = z.array(VerdictSchema).min(1);

export type Verdict = z.infer<typeof VerdictSchema>;

/**
 * Parse and validate a verdicts file, then check it against the rubric and disk.
 *
 * Fails closed on: malformed JSON, a verdict for a rule the rubric decides
 * deterministically (those must be measured, never asserted), a verdict whose
 * declared method disagrees with the rubric, and any evidence path that does
 * not exist.
 *
 * @param raw - Raw file contents.
 * @param source - Path used in error messages.
 * @param repoRoot - Root that evidence paths resolve against.
 * @returns Outcomes suitable for the gate.
 */
export function parseVerdicts(raw: string, source: string, repoRoot = process.cwd()): Outcome[] {
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
  }

  if (issues.length > 0) throw new ValidationError(`${source}: invalid verdicts`, issues);

  return parsed.data.map((v) => ({ ruleId: v.ruleId, passed: v.passed }));
}
