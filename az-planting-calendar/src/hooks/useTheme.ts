import { useCallback, useEffect, useState } from 'react';
import {
  applyThemeMode,
  nextThemeMode,
  readThemeMode,
  type ThemeMode
} from '../theme';

/**
 * Theme preference with system default and localStorage persistence.
 */
export function useTheme(): {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  cycle: () => void;
  setMode: (mode: ThemeMode) => void;
} {
  const [mode, setModeState] = useState<ThemeMode>(() => readThemeMode());
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => applyThemeMode(readThemeMode()));

  useEffect(() => {
    setResolved(applyThemeMode(mode));
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(applyThemeMode('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const cycle = useCallback(() => {
    // Advance from what is actually STORED, not from React state. Anything that
    // changes the preference outside React (another tab, devtools, an automated
    // check writing localStorage) leaves this hook's state stale, and the next
    // click then re-selects the theme already showing — the toggle appears dead.
    setModeState(nextThemeMode(readThemeMode()));
  }, []);

  return { mode, resolved, cycle, setMode };
}
