/**
 * Expand an inclusive half-month window to indices (Worker-side).
 *
 * @param start - Start half 0..23.
 * @param end - End half 0..23.
 */
export function expandHalfMonthRange(start: number, end: number): number[] {
  const out: number[] = [];
  if (start <= end) {
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }
  for (let i = start; i < 24; i++) out.push(i);
  for (let i = 0; i <= end; i++) out.push(i);
  return out;
}
