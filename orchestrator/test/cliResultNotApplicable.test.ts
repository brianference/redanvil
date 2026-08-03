import { describe, it, expect } from 'vitest';
import { resultNotApplicable } from '../src/cli';

describe('resultNotApplicable', () => {
  it('returns the report notApplicable set, not a caller-supplied waiver list', () => {
    // The regression this guards: cli.ts's `gate` and `loop` commands once
    // wrote the raw --na flag value into the result file's
    // provenance.notApplicable instead of report.notApplicable (the full set
    // a gate run actually decided, including every rule a det check itself
    // reported n/a for). A det check reporting its own subject absent -- e.g.
    // proc-pr-title-ticket with no GITHUB_TOKEN -- never appears in the raw
    // --na list, so that bug silently dropped it from the written file while
    // the console's own "n/a: ..." line reported it handled correctly.
    // lg-result-reproduces then read the missing id as an invented gap.
    const report = {
      notApplicable: ['proc-pr-title-ticket', 'u-claims-covered']
    };
    expect(resultNotApplicable(report)).toEqual(['proc-pr-title-ticket', 'u-claims-covered']);
  });

  it('returns an empty set when the gate found nothing not-applicable', () => {
    expect(resultNotApplicable({ notApplicable: [] })).toEqual([]);
  });
});
