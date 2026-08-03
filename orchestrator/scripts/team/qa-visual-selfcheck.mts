/**
 * Validate the QA-visual measurer against its own known-bad/known-good fixtures.
 *
 * `decide-qa-visual.mjs` keeps a mirrored JS copy of the pure decision for
 * pytest. This instead re-runs the REAL TypeScript implementation
 * (`src/team/qaVisual.ts`) against `knownBadBelowFoldMetrics()` and
 * `knownGoodInViewMetrics()`, so a harness run that reports "everything
 * passed" on its first try can be told apart from a harness that is broken --
 * per the repo rule that a big win with no code change is a measurement bug,
 * not a product improvement.
 *
 * Usage: npx tsx qa-visual-selfcheck.mts
 * Prints one JSON line: { badVerdict, badReasons, goodVerdict, goodReasons, ok }
 * Exits 0 when badVerdict === 'fail' AND goodVerdict === 'pass', else 1.
 */
import {
  decideQaVisual,
  knownBadBelowFoldMetrics,
  knownGoodInViewMetrics
} from '../../src/team/qaVisual';

const bad = decideQaVisual([knownBadBelowFoldMetrics()]);
const good = decideQaVisual([knownGoodInViewMetrics()]);
const ok = bad.verdict === 'fail' && good.verdict === 'pass';

process.stdout.write(
  `${JSON.stringify({
    badVerdict: bad.verdict,
    badReasons: bad.failReasons,
    goodVerdict: good.verdict,
    goodReasons: good.failReasons,
    ok
  })}\n`
);
process.exit(ok ? 0 : 1);
