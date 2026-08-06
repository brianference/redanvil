/**
 * Stable layout positions for map pins by neighbourhood (presentation only).
 * Not GPS coordinates — decorative map wash for the Map view.
 */

/** Percent left/top for a pin inside the map stage. */
export interface PinPosition {
  left: number;
  top: number;
}

const HOOD_PINS: Record<string, PinPosition> = {
  Leslieville: { left: 72, top: 58 },
  'The Annex': { left: 38, top: 36 },
  Riverdale: { left: 68, top: 48 },
  'The Beaches': { left: 88, top: 62 },
  'Liberty Village': { left: 32, top: 64 },
  'High Park': { left: 18, top: 52 },
  'Distillery District': { left: 58, top: 70 },
  Yorkville: { left: 42, top: 28 }
};

/**
 * Pin position for a neighbourhood, with a deterministic fallback.
 *
 * @param neighbourhood - Seed neighbourhood label.
 */
export function pinForNeighbourhood(neighbourhood: string): PinPosition {
  const known = HOOD_PINS[neighbourhood];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < neighbourhood.length; i += 1) {
    hash = (hash * 31 + neighbourhood.charCodeAt(i)) % 10_000;
  }
  return {
    left: 20 + (hash % 60),
    top: 25 + (Math.floor(hash / 60) % 50)
  };
}
