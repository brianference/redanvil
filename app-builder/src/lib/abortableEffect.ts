/** Default timeout for every client JSON request. */
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
