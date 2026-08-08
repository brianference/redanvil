import { useEffect, useState } from 'react';
import { en } from '../i18n/en';
import {
  applyThemeMode,
  nextThemeMode,
  readThemeMode,
  resolveTheme,
  type ThemeMode
} from '../theme';

/**
 * Theme control: cycles system / light / dark with a visible label.
 */
export function ThemeToggle(): JSX.Element {
  const [mode, setMode] = useState<ThemeMode>(() => readThemeMode());
  const resolved = resolveTheme(mode);

  useEffect(() => {
    applyThemeMode(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeMode('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  return (
    <button
      type="button"
      className="btn btn--ghost"
      aria-label={en.theme.toggle}
      title={`${en.theme.toggle}: ${mode} (${resolved})`}
      onClick={() => setMode((current) => nextThemeMode(current))}
    >
      {resolved === 'dark' ? '◐' : '◑'}
    </button>
  );
}
