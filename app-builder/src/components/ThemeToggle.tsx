/**
 * Thin wrapper: supplies this app's theme and copy to the shared ThemeToggle.
 */
import {
  ThemeToggle as SharedThemeToggle,
  type ThemeToggleProps as SharedProps
} from '../../../design-system/ThemeToggle';
import { en } from '../i18n/en';
import { theme } from '../theme';

/**
 * Header control: toggles light/dark on documentElement, persists to localStorage,
 * and applies saved-or-system preference on load.
 */
export function ThemeToggle(): JSX.Element {
  const tokens: SharedProps['tokens'] = {
    touch: theme.touch,
    padding: theme.space.sm,
    border: theme.color.border,
    radius: theme.radius.sm,
    surface: theme.color.surface,
    text: theme.color.text,
    fontSize: theme.type.scale[2] ?? 16,
    fontFamily: theme.type.family
  };
  const copy: SharedProps['copy'] = {
    toLight: en.app.themeToLight,
    toDark: en.app.themeToDark
  };
  return <SharedThemeToggle tokens={tokens} copy={copy} />;
}
