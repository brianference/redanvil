export interface Check {
  /** The rubric rule this check decides. */
  ruleId: string;
  command: string;
  args: string[];
  /** Per-check wall-clock ceiling; defaults applied by the runner. */
  timeoutMs?: number;
}

/*
 * `DEFAULT_CHECKS` used to sit here: a five-entry check list, exported, and
 * referenced by nothing in the repository — commands/gate.ts owns the real list
 * (APP_CHECKS) and always has.
 *
 * It is deleted rather than updated because it was actively harmful. It carried
 * a SECOND wiring of u-test-presence (`npm test`), so the question "what does
 * u-test-presence actually run?" had two answers in two files, and both were
 * wrong in the same way — they ran the suite and never read the diff, while the
 * rubric line promised "changed source files have tests". A dead duplicate of a
 * definition is where a stale answer hides; keeping one that also contradicts
 * its own rule text is how a blocker stays green for months over a hole it was
 * written to close. u-conc-dead-code asks for exactly this deletion.
 */
