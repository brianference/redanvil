import { en } from '../../i18n/en';

export interface ResultsStatusProps {
  /** Catalog fetch status. */
  status: 'loading' | 'ready' | 'error';
  /** Human-readable load error when status is error. */
  error: string | null;
  /** Number of sitters in the current result set. */
  resultCount: number;
}

/**
 * Shared loading / error / empty messaging for marketplace result lists.
 * Extracted so Photos / Map / Dates stay architecturally separate without
 * copy-pasting the same status markup.
 *
 * @param props - Fetch status and result count.
 */
export function ResultsStatus({
  status,
  error,
  resultCount
}: ResultsStatusProps): JSX.Element | null {
  if (status === 'error') {
    return (
      <p className="state state--error" role="alert">
        {error ?? en.home.loadError}
      </p>
    );
  }
  if (status === 'loading') {
    return <p className="state">{en.home.loading}</p>;
  }
  if (status === 'ready' && resultCount === 0) {
    return (
      <p className="state state--empty" data-testid="empty-sitters" role="status">
        {en.home.empty}
      </p>
    );
  }
  return null;
}
