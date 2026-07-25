import { en } from '../../i18n/en';
import { KpiCard } from './KpiCard';
import { kpiStripStyle } from './styles';

export interface SavedKpiStripProps {
  /** Builds created in the current calendar week. */
  thisWeek: number;
  /** Total builds in the list. */
  total: number;
  /** Saved count (same as total for the public list). */
  saved: number;
}

/**
 * Three-up KPI strip for the Saved dashboard.
 *
 * @param props - thisWeek, total, and saved counts.
 */
export function SavedKpiStrip({ thisWeek, total, saved }: SavedKpiStripProps): JSX.Element {
  const copy = en.pages.saved;
  return (
    <div style={kpiStripStyle} role="group" aria-label={copy.kpiLabel}>
      <KpiCard value={thisWeek} label={copy.kpiThisWeek} />
      <KpiCard value={total} label={copy.kpiTotal} />
      <KpiCard value={saved} label={copy.kpiSaved} />
    </div>
  );
}
