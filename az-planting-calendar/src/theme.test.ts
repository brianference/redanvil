import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyThemeMode, nextThemeMode, readThemeMode } from './theme';

/**
 * Theme storage + cycle behaviour (localStorage key `theme`).
 * Minimal DOM stubs — no jsdom dependency.
 */
describe('theme', () => {
  const store = new Map<string, string>();
  const attrs = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    attrs.clear();

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
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined
      })
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cycles system → light → dark → system', () => {
    expect(nextThemeMode('system')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
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

  it('persists system preference (never leaves storage null after apply)', () => {
    expect(applyThemeMode('system')).toBe('light'); // matchMedia matches:false → light
    expect(store.get('theme')).toBe('system');
    expect(store.get('theme')).not.toBeUndefined();
    expect(readThemeMode()).toBe('system');
    expect(attrs.get('data-theme')).toBe('light');
  });
});
