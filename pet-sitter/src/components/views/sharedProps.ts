import type { FormEvent } from 'react';
import type { SitterSummary } from '../../lib/api';
import type { MarketplaceState, MarketplaceView } from '../../lib/searchState';

/** Shared controller props passed into each full-layout view. */
export interface MarketplaceLayoutProps {
  /** Filtered sitters for the current filters. */
  sitters: SitterSummary[];
  /** Full marketplace URL state. */
  state: MarketplaceState;
  /** Live draft for the text search field. */
  draftQ: string;
  /** Search input element id (unique per page). */
  inputId: string;
  /** Optional form test id for home probe. */
  formTestId?: string;
  /** Status of the catalog fetch. */
  status: 'loading' | 'ready' | 'error';
  /** Human-readable load error. */
  error: string | null;
  /** Result count / loading label. */
  countLabel: string;
  /** Update draft + URL query. */
  onQueryChange: (value: string) => void;
  /** Form submit (commit draft query). */
  onSearchSubmit: (event: FormEvent) => void;
  /** Merge partial state into the URL. */
  writeState: (patch: Partial<MarketplaceState>) => void;
  /** Switch layout architecture. */
  onViewChange: (view: MarketplaceView) => void;
}
