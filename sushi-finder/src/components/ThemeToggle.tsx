import { useEffect, useRef, useState } from 'react';
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

  // Persist only a DELIBERATE change. This effect also fires on mount, and
  // persisting there wrote a preference the visitor never chose -- which pinned
  // the theme and made the OS setting unreachable for good.
  const userChanged = useRef(false);

  useEffect(() => {
    applyThemeMode(mode, userChanged.current);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    // Following the OS is not a choice to record, so this never persists.
    const onChange = () => applyThemeMode('system', false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  return (
    <button
      type="button"
      className="btn btn--ghost"
      aria-label={en.theme.toggle}
      title={`${en.theme.toggle}: ${mode} (${resolved})`}
      onClick={() => {
        userChanged.current = true;
        setMode((current) => nextThemeMode(current));
      }}
    >
      {resolved === 'dark' ? '◐' : '◑'}
    </button>
  );
}
