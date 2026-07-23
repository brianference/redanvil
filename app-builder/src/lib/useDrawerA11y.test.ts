import { describe, it, expect } from 'vitest';
import { resolveDrawerKeyAction, resolveDrawerOpenFocus } from './useDrawerA11y';

/** Minimal stand-in for HTMLElement identity checks in pure unit tests. */
function fakeEl(id: string): HTMLElement {
  return { id } as unknown as HTMLElement;
}

describe('resolveDrawerKeyAction', () => {
  const first = fakeEl('first');
  const mid = fakeEl('mid');
  const last = fakeEl('last');
  const focusables = [first, mid, last];

  it('closes the drawer on Escape', () => {
    expect(resolveDrawerKeyAction('Escape', false, focusables, mid)).toEqual({
      type: 'close'
    });
  });

  it('traps Tab from the last focusable back to the first', () => {
    expect(resolveDrawerKeyAction('Tab', false, focusables, last)).toEqual({
      type: 'trap',
      target: first
    });
  });

  it('traps Shift+Tab from the first focusable to the last', () => {
    expect(resolveDrawerKeyAction('Tab', true, focusables, first)).toEqual({
      type: 'trap',
      target: last
    });
  });

  it('does not trap Tab when focus is in the middle', () => {
    expect(resolveDrawerKeyAction('Tab', false, focusables, mid)).toEqual({
      type: 'none'
    });
  });
});

describe('resolveDrawerOpenFocus', () => {
  it('moves focus into the drawer via the close button when present', () => {
    const closeBtn = fakeEl('close');
    const drawer = fakeEl('drawer');
    expect(resolveDrawerOpenFocus(closeBtn, drawer)).toBe(closeBtn);
  });

  it('falls back to the drawer container when no close button exists', () => {
    const drawer = fakeEl('drawer');
    expect(resolveDrawerOpenFocus(null, drawer)).toBe(drawer);
  });
});
