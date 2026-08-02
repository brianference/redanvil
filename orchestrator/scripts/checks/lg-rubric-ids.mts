/**
 * Print every rubric rule id as JSON, with NO lane exclusions applied.
 *
 * A sibling of `lg-result-reproduces-score.mts`. It exists as a file rather than
 * an inline `npx tsx -e` because the inline form has to pass quotes and an arrow
 * function through a Windows shell, which mangles them -- the spawn failed while
 * the identical script ran fine when typed at a prompt.
 *
 * Used by `lg-result-reproduces` to decide whether a recorded rule id was
 * invented. The scored id set has `notApplicable` lanes already removed, so a
 * run with `--na process` legitimately records rules the scored set omits.
 */
import { RULES } from '../../src/rubric/rules';

process.stdout.write(JSON.stringify(RULES.map((r) => r.id)));
