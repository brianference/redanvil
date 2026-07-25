import { en } from '../../i18n/en';
import { buttonStyle, errorBannerStyle } from '../ui';
import { errorBodyStyle, errorMessageStyle, errorRetryStyle } from './styles';

export interface SavedErrorProps {
  /** Error message from the list fetch. */
  message: string;
  /** Retry the aborted/failed GET. */
  onRetry: () => void;
}

/**
 * Error banner with retry for the Saved list fetch.
 *
 * @param props - Message and retry handler.
 */
export function SavedError({ message, onRetry }: SavedErrorProps): JSX.Element {
  const copy = en.pages.saved;
  return (
    <div role="alert" style={errorBannerStyle()}>
      <span aria-hidden="true">!</span>
      <div style={errorBodyStyle}>
        <p style={errorMessageStyle}>{message}</p>
        <button
          type="button"
          style={{ ...buttonStyle(false), ...errorRetryStyle }}
          onClick={onRetry}
        >
          {copy.errorRetry}
        </button>
      </div>
    </div>
  );
}
