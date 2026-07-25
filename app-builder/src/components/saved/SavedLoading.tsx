import { en } from '../../i18n/en';
import { statusBannerStyle } from '../ui';

/**
 * Loading status banner while the Saved list is fetching.
 */
export function SavedLoading(): JSX.Element {
  const copy = en.pages.saved;
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={statusBannerStyle()}>
      <span aria-hidden="true">…</span>
      <span>{copy.loading}</span>
    </div>
  );
}
