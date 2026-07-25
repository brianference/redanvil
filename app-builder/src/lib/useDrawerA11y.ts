/**
 * Re-export of the shared drawer accessibility helpers.
 *
 * Implementation lives in design-system/hooks so the two apps cannot drift and
 * the duplication budget stops counting 190 identical lines twice. Kept at this
 * path so existing imports and tests are unchanged.
 */
export {
  queryFocusable,
  resolveDrawerKeyAction,
  resolveDrawerOpenFocus,
  useDrawerA11y
} from '../../../design-system/hooks/useDrawerA11y';
export type {
  DrawerKeyAction,
  UseDrawerA11yOptions
} from '../../../design-system/hooks/useDrawerA11y';
