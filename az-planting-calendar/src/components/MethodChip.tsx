import { en } from '../i18n/en';
import type { Method } from '../lib/schemas';

/**
 * Seed / transplant status chip: color + shape + text label (not color alone).
 *
 * @param method - S or T.
 */
export function MethodChip({ method }: { method: Method }) {
  const isSeed = method === 'S';
  return (
    <span
      className={`method-chip method-chip--${isSeed ? 'seed' : 'transplant'}`}
      data-method={method}
    >
      <span className="method-chip__mark" aria-hidden="true">
        {method}
      </span>
      {isSeed ? en.hero.seed : en.hero.transplant}
    </span>
  );
}
