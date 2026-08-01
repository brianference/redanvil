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
    setModeState((m) => nextThemeMode(m));
  }, []);

  return { mode, resolved, cycle, setMode };
}
