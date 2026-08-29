import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { FormStatus } from '../components/FormStatus';
import { SaveControl } from '../components/SaveControl';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { useSaves } from '../hooks/useSaves';
import { useSession } from '../hooks/useSession';
import { en } from '../i18n/en';

/**
 * Profile screen: email, confirmation state, sign-out, and saved sushi places.
 */
export function AccountPage(): JSX.Element {
  const { email, emailVerified, loading, signOut } = useSession();
  const saves = useSaves();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  if (!loading && !email) {
    return <Navigate to="/signin" replace />;
  }

  /**
   * Clear the session cookie and return the visitor to a signed-out nav.
   */
  async function onSignOut(): Promise<void> {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : en.auth.genericError);
      setSigningOut(false);
    }
  }

  if (loading || !email) {
    return (
      <>
        <Breadcrumbs
          items={[
            { label: en.brand.name, to: '/' },
            { label: en.account.title }
          ]}
        />
        <main id="main">
          <LoadingState message={en.account.loading} />
        </main>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.account.title }
        ]}
      />
      <main id="main">
        <h1 className="page-title">{en.account.title}</h1>

        <section className="detail-panel" aria-labelledby="account-identity">
          <h2 id="account-identity" className="account-heading">
            {en.account.signedInAs}
          </h2>
          <p className="account-email">{email}</p>
          <p className={emailVerified ? 'account-verified' : 'account-unverified'}>
            {emailVerified ? en.account.emailConfirmed : en.account.emailUnconfirmed}
          </p>
          <FormStatus message={signOutError} tone="error" />
          <div className="detail-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                void onSignOut();
              }}
              disabled={signingOut}
            >
              {signingOut ? en.account.signingOut : en.account.signOut}
            </button>
          </div>
        </section>

        <h2 className="account-heading">{en.account.savedTitle}</h2>
        {saves.items.length > 0 ? <FormStatus message={saves.error} tone="error" /> : null}

        {saves.loading && saves.items.length === 0 ? (
          <LoadingState message={en.account.loading} />
        ) : null}

        {saves.error && saves.items.length === 0 && !saves.loading ? (
          <ErrorState
            message={saves.error}
            retryLabel={en.account.retry}
            onRetry={() => {
              void saves.refresh();
            }}
          />
        ) : null}

        {!saves.loading && saves.items.length === 0 && !saves.error ? (
          <EmptyState
            message={en.account.savedEmpty}
            hint={en.account.savedEmptyHint}
            action={
              <Link className="btn btn--primary" to="/sushis">
                {en.account.catalogLink}
              </Link>
            }
          />
        ) : null}

        {saves.items.length > 0 ? (
          <ul className="sushi-list">
            {saves.items.map((item) => {
              const beenId = `been-${item.sushiId}`;
              const pending = saves.pendingId === item.sushiId;
              return (
                <li key={item.sushiId} className="sushi-card">
                  <h3>
                    <Link to={`/sushis/${item.sushiId}`}>{item.title}</Link>
                  </h3>
                  <p>
                    {item.style ? <span className="chip">{item.style}</span> : null}{' '}
                    {item.city ? <span className="chip">{item.city}</span> : null}
                  </p>
                  <div className="sushi-card__actions">
                    <label className="been-toggle" htmlFor={beenId}>
                      <input
                        id={beenId}
                        type="checkbox"
                        checked={item.beenThere}
                        disabled={pending}
                        onChange={(event) => {
                          void saves.setBeenThere(item.sushiId, event.target.checked).catch(() => undefined);
                        }}
                      />
                      {item.beenThere ? en.account.beenThere : en.account.notBeenThere}
                    </label>
                    <Link className="btn" to={`/sushis/${item.sushiId}`}>
                      {en.account.openPlace}
                    </Link>
                    <SaveControl sushiId={item.sushiId} title={item.title} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </main>
    </>
  );
}
