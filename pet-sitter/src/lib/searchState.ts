/**
 * Shared marketplace search state persisted in the URL query string.
 * View switch selects a full layout architecture; filters survive reloads and pasteable links.
 */

/** Supported result-view modes (URL `view` param). */
export type MarketplaceView = 'photos' | 'map' | 'dates';

/** Filter + view state shared across the three renderers. */
export interface MarketplaceState {
  view: MarketplaceView;
  q: string;
  from: string;
  to: string;
  neighbourhood: string;
  petType: string;
}

const VIEWS: readonly MarketplaceView[] = ['photos', 'map', 'dates'];

/**
 * Parse marketplace state from a URLSearchParams object.
 *
 * @param params - Current location search params.
 */
export function parseMarketplaceState(params: URLSearchParams): MarketplaceState {
  const rawView = params.get('view') ?? 'photos';
  const view = (VIEWS as readonly string[]).includes(rawView)
    ? (rawView as MarketplaceView)
    : 'photos';
  return {
    view,
    q: params.get('q') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    neighbourhood: params.get('neighbourhood') ?? '',
    petType: params.get('pet_type') ?? ''
  };
}

/**
 * Serialize marketplace state into URLSearchParams (omit empty defaults).
 *
 * @param state - Next state to write.
 */
export function serializeMarketplaceState(state: MarketplaceState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view !== 'photos') params.set('view', state.view);
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.from) params.set('from', state.from);
  if (state.to) params.set('to', state.to);
  if (state.neighbourhood.trim()) params.set('neighbourhood', state.neighbourhood.trim());
  if (state.petType.trim()) params.set('pet_type', state.petType.trim());
  return params;
}

/**
 * True when the stay range overlaps the sitter's available window.
 * Missing sitter bounds treat the sitter as always available.
 *
 * @param availableFrom - ISO date or null.
 * @param availableTo - ISO date or null.
 * @param from - Requested start ISO date or empty.
 * @param to - Requested end ISO date or empty.
 */
export function availabilityOverlaps(
  availableFrom: string | null,
  availableTo: string | null,
  from: string,
  to: string
): boolean {
  if (!from && !to) return true;
  const reqStart = from || to;
  const reqEnd = to || from;
  if (!reqStart || !reqEnd) return true;
  if (availableFrom && reqEnd < availableFrom) return false;
  if (availableTo && reqStart > availableTo) return false;
  return true;
}
