import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyThemeMode, nextThemeMode, readThemeMode, resolveTheme } from './theme';

/**
 * Theme storage + cycle behaviour (localStorage key `theme`).
 * Minimal DOM stubs — no jsdom dependency.
 */
describe('theme', () => {
  const store = new Map<string, string>();
  const attrs = new Map<string, string>();
  /** Simulates the OS dark-mode preference so the default can be tested against it. */
  let matchMediaDark = false;

  beforeEach(() => {
    store.clear();
    attrs.clear();
    matchMediaDark = false;

    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      }
    });

    vi.stubGlobal('document', {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          attrs.set(k, v);
        },
        getAttribute: (k: string) => (attrs.has(k) ? attrs.get(k)! : null),
        removeAttribute: (k: string) => {
          attrs.delete(k);
        }
      }
    });

    vi.stubGlobal('window', {
      matchMedia: () => ({
        matches: matchMediaDark,
        addEventListener: () => undefined,
        removeEventListener: () => undefined
      })
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cycles forward, skipping the step that would look identical', () => {
    // Base order is system → light → dark → system, but a step is skipped when
    // it resolves to the appearance already showing, so every press repaints.
    // OS light (the default stub): `system` already looks light, so light is
    // skipped and the cycle reads as a plain light/dark switch.
    expect(resolveTheme('system')).toBe('light');
    expect(nextThemeMode('system')).toBe('dark');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');

    // OS dark: now `system` looks dark, so it is the skipped step instead.
    matchMediaDark = true;
    expect(nextThemeMode('dark')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
  });

  it('persists light and dark to localStorage and sets data-theme', () => {
    expect(applyThemeMode('light')).toBe('light');
    expect(store.get('theme')).toBe('light');
    expect(attrs.get('data-theme')).toBe('light');
    expect(readThemeMode()).toBe('light');

    expect(applyThemeMode('dark')).toBe('dark');
    expect(store.get('theme')).toBe('dark');
    expect(attrs.get('data-theme')).toBe('dark');
    expect(readThemeMode()).toBe('dark');
  });

  it('never advances to a mode that looks identical to the current one', () => {
    // On a dark-OS device, `system` and `dark` paint the same, so the plain
    // system → light → dark → system cycle produced a click that changed
    // nothing. Fails against that cycle.
    matchMediaDark = true;
    expect(resolveTheme('system')).toBe('dark');
    const next = nextThemeMode('dark');
    expect(resolveTheme(next)).not.toBe('dark');
    expect(next).toBe('light');
  });

  it('defaults to light when nothing is stored, even if the OS prefers dark', () => {
    // Regression: the default was `system`, so a phone set to dark got a dark
    // first paint before the visitor had chosen anything. Fails against that.
    matchMediaDark = true;
    expect(readThemeMode()).toBe('light');
    expect(applyThemeMode(readThemeMode())).toBe('light');
    expect(attrs.get('data-theme')).toBe('light');
  });

  it('persists system preference (never leaves storage null after apply)', () => {
    expect(applyThemeMode('system')).toBe('light'); // matchMedia matches:false → light
    expect(store.get('theme')).toBe('system');
    expect(store.get('theme')).not.toBeUndefined();
    expect(readThemeMode()).toBe('system');
    expect(attrs.get('data-theme')).toBe('light');
  });
});
