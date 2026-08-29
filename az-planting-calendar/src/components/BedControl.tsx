import { Link, useLocation } from 'react-router-dom';
import { useBed } from '../hooks/useBed';
import { useSession } from '../hooks/useSession';
import { useZone } from '../hooks/useZone';
import { en } from '../i18n/en';
import './Form.css';

export interface BedControlProps {
  /** Crop id from the crops table. */
  cropId: string;
  /** Crop name for accessible labels. */
  cropName: string;
  /** Tight layout for the year-grid sticky column. */
  compact?: boolean;
}

/**
 * Add or remove a crop from the signed-in gardener's bed.
 * Signed-out visitors get a sign-in link.
 *
 * @param props - Crop identity and optional compact layout.
 */
export function BedControl({ cropId, cropName, compact = false }: BedControlProps) {
  const location = useLocation();
  const { zone } = useZone();
  const { email, loading: sessionLoading } = useSession();
  const { isInBed, add, remove, pendingId, loading: bedLoading } = useBed();
  const inBed = isInBed(cropId);
  const busy = sessionLoading || bedLoading || pendingId === cropId;
  const btnClass = compact ? 'ui-btn ui-btn--compact' : 'ui-btn';

  if (sessionLoading) {
    return (
      <button type="button" className={btnClass} disabled>
        {compact ? en.account.compactAdd : en.account.add}
      </button>
    );
  }

  if (!email) {
    return (
      <Link
        className={btnClass}
        to="/signin"
        state={{ from: `${location.pathname}${location.search}` }}
        aria-label={en.account.signInToAddAria(cropName)}
      >
        {en.account.signInToAdd}
      </Link>
    );
  }

  /**
   * Toggle membership of this crop on the signed-in user's bed.
   */
  async function onToggle(): Promise<void> {
    if (busy) return;
    try {
      if (inBed) {
        await remove(cropId);
      } else if (zone) {
        await add(cropId, zone.id);
      }
    } catch {
      // useBed records the error; the control stays usable for a retry.
    }
  }

  const label = inBed
    ? compact
      ? en.account.compactRemove
      : en.account.remove
    : compact
      ? en.account.compactAdd
      : en.account.add;

  return (
    <span className="bed-control">
      <button
        type="button"
        className={inBed ? `${btnClass} ui-btn--primary` : btnClass}
        onClick={() => {
          void onToggle();
        }}
        disabled={busy || (!inBed && !zone)}
        aria-pressed={inBed}
        aria-label={inBed ? en.account.removeAria(cropName) : en.account.addAria(cropName)}
        data-testid="bed-control"
      >
        {label}
      </button>
    </span>
  );
}
