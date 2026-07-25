import { kpiLblStyle, kpiStyle, kpiValStyle } from './styles';

export interface KpiCardProps {
  /** Numeric value shown large. */
  value: number;
  /** Uppercase label under the value. */
  label: string;
}

/**
 * One glanceable KPI tile (value + uppercase label).
 *
 * @param props - Value and label for the tile.
 */
export function KpiCard({ value, label }: KpiCardProps): JSX.Element {
  return (
    <div style={kpiStyle}>
      <div style={kpiValStyle}>{value}</div>
      <div style={kpiLblStyle}>{label}</div>
    </div>
  );
}
