import { en } from '../../i18n/en';
import { KpiCard } from './KpiCard';
import { kpiStripStyle } from './styles';

export interface SavedKpiStripProps {
  /** Builds created in the current calendar week. */
  thisWeek: number;
  /** Total builds in the list. */
  total: number;
}

/**
 * KPI strip for the Saved dashboard.
 *
 * @param props - thisWeek and total counts.
 */
export function SavedKpiStrip({ thisWeek, total }: SavedKpiStripProps): JSX.Element {
  const copy = en.pages.saved;
  return (
    <div
      className="ra-saved-col ra-saved-grid"
      style={kpiStripStyle}
      role="group"
      aria-label={copy.kpiLabel}
    >
      <KpiCard value={thisWeek} label={copy.kpiThisWeek} />
      <KpiCard value={total} label={copy.kpiTotal} />
    </div>
  );
}
