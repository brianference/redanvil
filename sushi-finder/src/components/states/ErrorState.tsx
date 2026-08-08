/**
 * Shared error state with optional retry control.
 * Failures must never render as empty success.
 *
 * @param props.message - Error text for role=alert.
 * @param props.retryLabel - Accessible name for retry (when onRetry provided).
 * @param props.onRetry - Optional reload handler.
 */
export function ErrorState({
  message,
  retryLabel,
  onRetry
}: {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="state state--error">
      <p role="alert">{message}</p>
      {onRetry && retryLabel ? (
        <button type="button" className="btn" aria-label={retryLabel} onClick={onRetry}>
          ↻
        </button>
      ) : null}
    </div>
  );
}
