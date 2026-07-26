/**
 * Thin wrapper: supplies this app's theme and copy to the shared Breadcrumbs.
 */
import {
  Breadcrumbs as SharedBreadcrumbs,
  type BreadcrumbsProps as SharedProps
} from '../../../design-system/Breadcrumbs';
import { en } from '../i18n/en';
import { theme } from '../theme';

export interface BreadcrumbsProps {
  /** Current page label (not linked). */
  current: string;
}

/**
 * Inner-page trail: Home / &lt;page&gt;. Home links to /.
 */
export function Breadcrumbs({ current }: BreadcrumbsProps): JSX.Element {
  const tokens: SharedProps['tokens'] = {
    marginBottom: theme.space.md,
    gap: theme.space.xs,
    fontSize: theme.type.scale[2] ?? 16,
    touch: theme.touch,
    muted: theme.color.muted,
    text: theme.color.text
  };
  const copy: SharedProps['copy'] = {
    navLabel: en.app.breadcrumbNav,
    homeLabel: en.app.breadcrumbHome
  };
  return <SharedBreadcrumbs current={current} tokens={tokens} copy={copy} />;
}
