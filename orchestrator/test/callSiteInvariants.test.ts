import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Source-level invariants that unit tests structurally cannot see.
 *
 * A unit test of a helper proves the helper is correct; it says nothing about
 * how a caller uses it. The Wizard remount bug lived entirely in the call site —
 * the key format was fine, and `key={\`wizard-${id}-${step}\` + prompt}` would
 * still have remounted on every keystroke and dropped keyboard focus.
 *
 * These live in the orchestrator package because they scan repo source with Node
 * APIs. Keeping them in the browser app required `@types/node` there, which
 * resolved locally through workspace hoisting and then failed CI, where each app
 * installs standalone.
 */
const HOME = 'app-builder/src/pages/Home.tsx';

describe('app-builder call-site invariants', () => {
  it('has the Home.tsx source available to scan', () => {
    // Fail loudly if the file moves, rather than silently asserting nothing.
    expect(existsSync(HOME), `${HOME} not found — update this test's path`).toBe(true);
  });

  it('keys the Wizard on session state only, never on prompt content', () => {
    const source = readFileSync(HOME, 'utf8');
    // Inlined session key (no wizardInstanceKey helper) — only sessionId + startStep.
    const keyMatch = /key=\{\s*`wizard-\$\{([^}]+)\}-\$\{([^}]+)\}`\s*\}/.exec(source);
    expect(
      keyMatch,
      'expected key={`wizard-${sessionId}-${startStep}`} on the Wizard in Home.tsx'
    ).not.toBeNull();

    const keyArgs = `${keyMatch![1] ?? ''} ${keyMatch![2] ?? ''}`;
    expect(keyArgs, 'prompt content in the Wizard key remounts it on every keystroke').not.toMatch(
      /\bprompt\b/i
    );
    expect(keyArgs).not.toMatch(/\banswers\b/i);

    // Concatenating onto the key is the same bug wearing a different shape.
    const keyLine = source
      .split('\n')
      .find((line) => line.includes('key=') && line.includes('wizard-'));
    expect(keyLine).toBeDefined();
    expect(keyLine!).not.toMatch(/\+.*\b(prompt|answers)\b/i);
    expect(keyLine!).not.toMatch(/\b(prompt|answers)\b.*\+/i);
  });
});
