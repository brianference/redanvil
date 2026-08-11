/**
 * Theme preference for az-planting-calendar.
 *
 * The logic is shared with every other RedAnvil app in
 * `design-system/theme.ts`; this module only re-exports it so app code keeps
 * importing `../theme`.
 *
 * Note for whoever touches the toggle next: the shared `applyThemeMode` takes a
 * `persist` flag that defaults to true, which is what this app has always done.
 * sushi-finder passes `false` on its initial apply, because persisting there
 * stored `dark` on first load and pinned the visitor to it forever. This app has
 * not been audited for that, and the default preserves its current behaviour
 * rather than changing it as a side effect of sharing the code.
 */
export {
  applyThemeMode,
  nextThemeMode,
  readThemeMode,
  resolveTheme,
  type ThemeMode
} from '../../design-system/theme';
