import { kpiLblStyle, kpiStyle, kpiValStyle } from './styles';

export interface KpiCardProps {
  /** Value shown large: a count, or a lower bound such as "50+". */
  value: string;
  /** Uppercase label under the value. */
  label: string;
}

/**
 * One glanceable KPI tile (value + uppercase label). The group's name reads
 * label then value, so a screen reader hears "This week: 3", not "3 THIS WEEK".
 *
 * @param props - Value and label for the tile.
 */
export function KpiCard({ value, label }: KpiCardProps): JSX.Element {
  return (
    <div role="group" aria-label={`${label}: ${value}`} style={kpiStyle}>
      <div style={kpiValStyle}>{value}</div>
      <div style={kpiLblStyle}>{label}</div>
    </div>
  );
}
