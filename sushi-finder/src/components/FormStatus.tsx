/**
 * Polite live region for form-level success or error copy.
 *
 * @param props.message - Status text, or null to render nothing.
 * @param props.tone - Visual treatment; errors use the danger token.
 */
export function FormStatus({
  message,
  tone = 'info'
}: {
  message: string | null;
  tone?: 'info' | 'error' | 'success';
}): JSX.Element | null {
  if (!message) return null;
  const className =
    tone === 'error'
      ? 'form-status form-status--error'
      : tone === 'success'
        ? 'form-status form-status--success'
        : 'form-status';
  return (
    <p className={className} aria-live="polite">
      {message}
    </p>
  );
}
