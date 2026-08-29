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
      ? 'state state--error'
      : tone === 'success'
        ? 'state state--ok'
        : 'state';
  return (
    <p className={className} aria-live="polite">
      {message}
    </p>
  );
}
