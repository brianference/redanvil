import { describe, it, expect } from 'vitest';
import { coderPrompt } from '../src/commands/loop';

describe('coderPrompt', () => {
  const spec = 'Build a thing with a button.';

  it('sends the bare spec on the first iteration', () => {
    const p = coderPrompt(spec, 1, '');
    expect(p).toContain(spec);
    expect(p).not.toContain('Gate failures');
  });

  it('sends the spec plus verbatim gate failures on later iterations', () => {
    const feedback = 'score 40/100\nblockers failed: u-typing-strict';
    const p = coderPrompt(spec, 2, feedback);
    expect(p).toContain('u-typing-strict');
    expect(p).toContain(spec);
    expect(p).toContain('Gate failures');
  });

  it('never invites the coder to weaken a check to pass', () => {
    // The loop is only meaningful if failures are fixed rather than disabled.
    for (const p of [coderPrompt(spec, 1, ''), coderPrompt(spec, 3, 'score 10/100')]) {
      expect(p).toMatch(/do not weaken/i);
    }
  });

  it('treats an empty feedback string on a later iteration as a first pass', () => {
    // Defensive: a gate that produced no feedback must not yield a prompt whose
    // "fix the failures below" section is empty and therefore meaningless.
    const p = coderPrompt(spec, 2, '');
    expect(p).not.toContain('Gate failures');
  });
});
