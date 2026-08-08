import { describe, expect, it } from 'vitest';
import { nextThemeMode, resolveTheme } from './theme';

describe('theme', () => {
  it('resolveTheme keeps light and dark', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('nextThemeMode advances', () => {
    expect(nextThemeMode('light')).toBe('dark');
  });
});
