import { en } from '../../i18n/en';
import { listCountLabel } from '../../lib/savedList';
import { KpiCard } from './KpiCard';
import { kpiStripStyle } from './styles';

export interface SavedKpiStripProps {
  /** Builds created in the current calendar week. */
  thisWeek: number;
  /** Total builds in the list. */
  total: number;
  /** Whether the list hit the API's row limit, so older builds may be missing. */
  truncated: boolean;
}

/**
 * KPI strip for the Saved dashboard. When the list is cut off, the total is a
 * lower bound.
 *
 * @param props - thisWeek and total counts, and whether the list is cut off.
 */
export function SavedKpiStrip({ thisWeek, total, truncated }: SavedKpiStripProps): JSX.Element {
  const copy = en.pages.saved;
  // Rows past the limit are older than every loaded row, so this week's count
  // can only be short when every loaded row is from this week.
  const thisWeekMayBeHigher = truncated && thisWeek === total;
  return (
    <div
      className="ra-saved-col ra-saved-grid"
      style={kpiStripStyle}
      role="group"
      aria-label={copy.kpiLabel}
    >
      <KpiCard value={listCountLabel(thisWeek, thisWeekMayBeHigher)} label={copy.kpiThisWeek} />
      <KpiCard value={listCountLabel(total, truncated)} label={copy.kpiTotal} />
    </div>
  );
}
