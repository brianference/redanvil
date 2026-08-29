import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useSaves } from '../hooks/useSaves';
import { en } from '../i18n/en';
import { interpolate } from '../lib/interpolate';

/**
 * Save or unsave a catalog place. Signed-out visitors get a sign-in link.
 *
 * @param props.sushiId - Catalog id.
 * @param props.title - Place title, used in the accessible name.
 */
export function SaveControl({ sushiId, title }: { sushiId: string; title: string }): JSX.Element {
  const location = useLocation();
  const { email, loading: sessionLoading } = useSession();
  const { isSaved, save, unsave, pendingId, loading: savesLoading } = useSaves();
  const saved = isSaved(sushiId);
  const busy = sessionLoading || savesLoading || pendingId === sushiId;

  if (sessionLoading) {
    return (
      <button type="button" className="btn" disabled>
        {en.account.save}
      </button>
    );
  }

  if (!email) {
    return (
      <Link
        className="btn"
        to="/signin"
        state={{ from: `${location.pathname}${location.search}` }}
        aria-label={interpolate(en.account.signInToSaveAria, { title })}
      >
        {en.account.signInToSave}
      </Link>
    );
  }

  /**
   * Toggle membership of this place on the signed-in user's list.
   */
  async function onToggle(): Promise<void> {
    if (busy) return;
    try {
      if (saved) {
        await unsave(sushiId);
      } else {
        await save(sushiId);
      }
    } catch {
      // useSaves records the error; the button stays usable for a retry.
    }
  }

  return (
    <button
      type="button"
      className={saved ? 'btn btn--primary' : 'btn'}
      onClick={() => {
        void onToggle();
      }}
      disabled={busy}
      aria-pressed={saved}
      aria-label={interpolate(saved ? en.account.unsaveAria : en.account.saveAria, { title })}
    >
      {saved ? en.account.unsave : en.account.save}
    </button>
  );
}
