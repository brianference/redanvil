import { en } from '../../i18n/en';
import { ErrorBanner } from '../Banner';
import { buttonStyle } from '../ui';
import { errorRetryStyle } from './styles';

export interface SavedErrorProps {
  /** Error message from the list fetch. */
  message: string;
  /** Retry the aborted/failed GET. */
  onRetry: () => void;
}

/**
 * Error banner with retry for a failed saved-list or saved-PRD fetch.
 *
 * @param props - Message and retry handler.
 */
export function SavedError({ message, onRetry }: SavedErrorProps): JSX.Element {
  return (
    <ErrorBanner message={message}>
      <button type="button" style={{ ...buttonStyle(false), ...errorRetryStyle }} onClick={onRetry}>
        {en.pages.saved.errorRetry}
      </button>
    </ErrorBanner>
  );
}
