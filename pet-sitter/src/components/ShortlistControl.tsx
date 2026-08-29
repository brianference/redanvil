import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useShortlist } from '../hooks/useShortlist';
import { en } from '../i18n/en';
import { interpolate } from '../lib/interpolate';

/**
 * Add or remove a sitter from the signed-in owner's shortlist.
 * Signed-out visitors get a sign-in link.
 *
 * @param props.sitterId - Catalog sitter id.
 * @param props.name - Sitter name, used in the accessible name.
 */
export function ShortlistControl({
  sitterId,
  name
}: {
  sitterId: string;
  name: string;
}): JSX.Element {
  const location = useLocation();
  const { email, loading: sessionLoading } = useSession();
  const { isShortlisted, add, remove, pendingId, loading: listLoading } = useShortlist();
  const saved = isShortlisted(sitterId);
  const busy = sessionLoading || listLoading || pendingId === sitterId;

  if (sessionLoading) {
    return (
      <button type="button" className="shortlist-btn" disabled>
        {en.account.add}
      </button>
    );
  }

  if (!email) {
    return (
      <Link
        className="shortlist-btn"
        to="/signin"
        state={{ from: `${location.pathname}${location.search}` }}
        aria-label={interpolate(en.account.signInToAddAria, { name })}
      >
        {en.account.signInToAdd}
      </Link>
    );
  }

  /**
   * Toggle membership of this sitter on the signed-in user's shortlist.
   */
  async function onToggle(): Promise<void> {
    if (busy) return;
    try {
      if (saved) {
        await remove(sitterId);
      } else {
        await add(sitterId);
      }
    } catch {
      // useShortlist records the error; the button stays usable for a retry.
    }
  }

  return (
    <button
      type="button"
      className={saved ? 'shortlist-btn shortlist-btn--on' : 'shortlist-btn'}
      onClick={() => {
        void onToggle();
      }}
      disabled={busy}
      aria-pressed={saved}
      aria-label={interpolate(saved ? en.account.removeAria : en.account.addAria, { name })}
    >
      {saved ? en.account.remove : en.account.add}
    </button>
  );
}
