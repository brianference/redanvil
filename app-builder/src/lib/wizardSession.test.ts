import { describe, it, expect } from 'vitest';
import { wizardInstanceKey } from './wizardSession';

describe('wizardInstanceKey', () => {
  it('uses the exact documented format wizard-{sessionId}-{startStep}', () => {
    expect(wizardInstanceKey(2, 1)).toBe('wizard-2-1');
    expect(wizardInstanceKey(1, 3)).toBe('wizard-1-3');
  });

  it('is defined with arity 2 so prompt content cannot be part of the key by construction', () => {
    // A broken optional-prompt third argument would still be callable as arity 2 and
    // would pass identical-call tautologies. Length is the signature contract.
    expect(wizardInstanceKey.length).toBe(2);
    const key = wizardInstanceKey(2, 1);
    expect(key).toBe('wizard-2-1');
    expect(key).not.toMatch(/prompt|hello|world/i);
  });

  it('changes when a new wizard session starts', () => {
    expect(wizardInstanceKey(1, 2)).not.toBe(wizardInstanceKey(2, 2));
  });

  it('changes when the intentional start step changes for a session', () => {
    expect(wizardInstanceKey(1, 1)).not.toBe(wizardInstanceKey(1, 2));
  });
});
