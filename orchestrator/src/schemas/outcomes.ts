import { z } from 'zod';
import { ValidationError } from '../errors';
import type { Outcome } from '../gate/score';

/**
 * A recorded rule verdict, as supplied by a judge pass or a visual review.
 *
 * `passed` must be a real boolean. This was previously loaded with an unchecked
 * `JSON.parse(...) as Outcome[]`, so a file with `"passed": "yes"` produced a
 * `Map<string, boolean>` holding the string `"yes"`. `!"yes"` is `false`, so no
 * blocker gated the score and the gate reported 100/100 while simultaneously
 * printing 28 failed blockers — and exited 0. The verdicts that back a score
 * are exactly the input that must not be trusted unvalidated.
 */
export const OutcomeSchema = z.object({
  ruleId: z.string().min(2),
  passed: z.boolean()
});

export const OutcomeListSchema = z.array(OutcomeSchema);

/**
 * Parse a judge/verdict file's contents into outcomes, failing closed with a
 * readable error rather than casting.
 *
 * @param raw - Raw file contents.
 * @param source - Path shown in the error message.
 * @returns The validated outcomes.
 * @throws ValidationError when the file is not valid JSON or not a well-formed outcome list.
 */
export function parseOutcomes(raw: string, source: string): Outcome[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ValidationError(`${source}: not valid JSON`, ['file is not parseable JSON']);
  }
  const result = OutcomeListSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new ValidationError(`${source}: not a valid verdict list`, issues);
  }
  return result.data;
}
