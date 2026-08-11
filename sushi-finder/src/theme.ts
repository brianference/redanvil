/**
 * Theme preference for sushi-finder.
 *
 * The logic is shared with every other RedAnvil app in
 * `design-system/theme.ts`; this module only re-exports it so app code keeps
 * importing `../theme` and the choice of cold default stays documented in one
 * place rather than drifting per app.
 *
 * One local note worth keeping: two documents disagreed about the cold default
 * and the enforced one wins. pet-sitter/CLAUDE.md says the default follows the
 * system; `cold_visitor.mjs`, dated 2026-08-03, records the standard change --
 * "a first-time visitor gets LIGHT, whatever the OS says" -- and it is the
 * artifact that actually gates. The rule-pack prose was never updated. Flagged
 * for the owner rather than silently resolved.
 */
export {
  applyThemeMode,
  nextThemeMode,
  readThemeMode,
  resolveTheme,
  type ThemeMode
} from '../../design-system/theme';
