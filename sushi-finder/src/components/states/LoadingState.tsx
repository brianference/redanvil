/**
 * Shared loading state for async screens.
 *
 * @param props.message - Status text announced to assistive tech.
 */
export function LoadingState({ message }: { message: string }): JSX.Element {
  return (
    <p className="state state--loading" role="status" aria-live="polite">
      {message}
    </p>
  );
}
