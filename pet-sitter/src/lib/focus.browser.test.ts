import { describe, it, expect } from 'vitest';

/**
 * Browser lane: real focus behaviour that jsdom cannot prove.
 */
describe('browser lane — focus', () => {
  it('moves focus to a button when it is focused()', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Go';
    document.body.appendChild(btn);
    btn.focus();
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });
});
