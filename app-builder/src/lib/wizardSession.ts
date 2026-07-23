/**
 * Stable React key for the Wizard tree.
 * Must change only on a new wizard session (or intentional start-step change),
 * never on live prompt content — a prompt-derived key remounts the Wizard on
 * every keystroke and drops keyboard focus in the prompt field.
 *
 * @param sessionId - Monotonic counter bumped when a new wizard session starts.
 * @param startStep - Step the Wizard should open on for this session.
 * @returns Key string suitable for React's `key` prop.
 */
export function wizardInstanceKey(sessionId: number, startStep: 1 | 2 | 3): string {
  return `wizard-${sessionId}-${startStep}`;
}
