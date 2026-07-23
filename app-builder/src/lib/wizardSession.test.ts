import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  it('Home.tsx Wizard key expression does not reference prompt or answers', () => {
    // Call-site regression: key={wizardInstanceKey(id, step) + prompt} remounts on
    // every keystroke. Unit tests of wizardInstanceKey alone cannot see that.
    const homePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'Home.tsx');
    const source = readFileSync(homePath, 'utf8');
    const keyMatch = /key=\{\s*wizardInstanceKey\(([^}]*)\)\s*\}/.exec(source);
    expect(keyMatch, 'expected Wizard key={wizardInstanceKey(...)} in Home.tsx').not.toBeNull();
    const keyArgs = keyMatch![1];
    expect(keyArgs).not.toMatch(/\bprompt\b/i);
    expect(keyArgs).not.toMatch(/\banswers\b/i);
    // Surrounding JSX expression must not concatenate prompt into the key either.
    const keyLine = source
      .split('\n')
      .find((line) => line.includes('wizardInstanceKey(') && line.includes('key='));
    expect(keyLine).toBeDefined();
    expect(keyLine!).not.toMatch(/\+.*\b(prompt|answers)\b/i);
    expect(keyLine!).not.toMatch(/\b(prompt|answers)\b.*\+/i);
  });
});
