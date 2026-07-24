/** Default timeout for list/detail GETs that use AbortController. */
export const FETCH_TIMEOUT_MS = 10_000;

/**
 * True when the failure is an AbortError (effect cleanup or timed abort).
 * Aborted requests must not be rendered as user-visible errors from the catch
 * path; timeouts that should surface UI errors set state before/around abort
 * while the effect is still active.
 *
 * @param err - Value caught from a fetch or other abortable operation.
 * @returns Whether the error is an abort.
 */
export function isAbortError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'AbortError';
  }
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Per-effect-run guard matching the dashboard `useRuns` active-flag pattern.
 * Call `deactivate` from cleanup; guard every setState with `ifActive`.
 *
 * @returns Guard with isActive, deactivate, and ifActive.
 */
export function createActiveFlag(): {
  /** Whether this effect run is still current. */
  isActive: () => boolean;
  /** Mark this run inactive (call from effect cleanup). */
  deactivate: () => void;
  /**
   * Run `fn` only while still active.
   *
   * @param fn - Side effect, typically a setState call.
   * @returns Whether `fn` ran.
   */
  ifActive: (fn: () => void) => boolean;
} {
  let active = true;
  return {
    isActive: () => active,
    deactivate: () => {
      active = false;
    },
    ifActive: (fn) => {
      if (!active) return false;
      fn();
      return true;
    }
  };
}

/**
 * Map a fetch catch into a UI error message, or null when no state update
 * should occur (inactive effect run, or AbortError from cleanup/timeout abort).
 *
 * An abort must never produce an error state from this helper — that is what
 * the prior race bug did (cleanup abort → error banner while a newer fetch loads).
 * Timeouts should set the error via `ifActive` when the timer fires, not here.
 *
 * @param err - Caught value from the fetch path.
 * @param active - Whether this effect run is still current.
 * @param errorMessage - User-facing message for real network/parse failures.
 * @returns Error message to set, or null to leave state unchanged.
 */
export function errorMessageFromFetchCatch(
  err: unknown,
  active: boolean,
  errorMessage: string
): string | null {
  if (!active) return null;
  if (isAbortError(err)) return null;
  return errorMessage;
}
