import type { ReactNode } from 'react';

/**
 * Shared empty state — catalog empty, search miss, or coverage boundary.
 *
 * @param props.message - Primary explanation.
 * @param props.hint - Optional secondary line (coverage limit, next step).
 * @param props.action - Optional CTA (e.g. clear search, add sushi).
 */
export function EmptyState({
  message,
  hint,
  action
}: {
  message: string;
  hint?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="state state--empty" role="status">
      <p>{message}</p>
      {hint ? <p className="state__hint">{hint}</p> : null}
      {action ? <div className="state__action">{action}</div> : null}
    </div>
  );
}
