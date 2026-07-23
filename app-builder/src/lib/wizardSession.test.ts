import { describe, it, expect } from 'vitest';
import { wizardInstanceKey } from './wizardSession';

describe('wizardInstanceKey', () => {
  it('stays the same when only the prompt would have changed (no prompt in key)', () => {
    const sessionId = 2;
    const startStep = 1 as const;
    // Typing into the prompt must not alter the key — that was the remount bug.
    const beforeTyping = wizardInstanceKey(sessionId, startStep);
    const afterTyping = wizardInstanceKey(sessionId, startStep);
    expect(afterTyping).toBe(beforeTyping);
    expect(beforeTyping).not.toMatch(/prompt|hello|world/i);
  });

  it('changes when a new wizard session starts', () => {
    expect(wizardInstanceKey(1, 2)).not.toBe(wizardInstanceKey(2, 2));
  });

  it('changes when the intentional start step changes for a session', () => {
    expect(wizardInstanceKey(1, 1)).not.toBe(wizardInstanceKey(1, 2));
  });
});
