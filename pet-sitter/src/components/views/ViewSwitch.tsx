import { en } from '../../i18n/en';
import type { MarketplaceView } from '../../lib/searchState';

export interface ViewSwitchProps {
  /** Active view from URL state. */
  view: MarketplaceView;
  /** Persist the next view without dropping filters. */
  onChange: (view: MarketplaceView) => void;
}

const VIEW_OPTIONS: Array<{ id: MarketplaceView; label: string }> = [
  { id: 'photos', label: en.views.photos },
  { id: 'map', label: en.views.map },
  { id: 'dates', label: en.views.dates }
];

/**
 * Segmented control that switches between the three layout architectures.
 * Shared filter state lives in the URL; this only changes `view`.
 *
 * @param props - Active view and change handler.
 */
export function ViewSwitch({ view, onChange }: ViewSwitchProps): JSX.Element {
  return (
    <div
      className="view-switch"
      role="tablist"
      aria-label={en.views.switchLabel}
      data-testid="view-switch"
    >
      {VIEW_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          className="view-switch__btn"
          aria-selected={view === option.id}
          data-testid={`view-${option.id}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
