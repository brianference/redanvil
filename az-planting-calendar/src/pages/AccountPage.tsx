import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BedControl } from '../components/BedControl';
import { FormStatus } from '../components/FormStatus';
import { MethodChip } from '../components/MethodChip';
import { useBed } from '../hooks/useBed';
import { useSession } from '../hooks/useSession';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import '../components/Form.css';
import './ProsePage.css';

/**
 * Profile screen: email, confirmation state, sign-out, and garden bed.
 */
export function AccountPage() {
  useDocumentMeta(en.meta.accountTitle, en.meta.accountDescription);
  const { email, emailVerified, loading, signOut } = useSession();
  const bed = useBed();
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
      <article className="prose shell" data-testid="account-page">
        <p role="status">{en.account.loading}</p>
      </article>
    );
  }

  return (
    <article className="prose shell" data-testid="account-page">
      <header className="prose__header">
        <h1>{en.account.title}</h1>
      </header>

      <section className="account-panel" aria-labelledby="account-identity">
        <h2 id="account-identity" className="account-heading">
          {en.account.signedInAs}
        </h2>
        <p className="account-email">{email}</p>
        <p className={emailVerified ? 'account-verified' : 'account-unverified'}>
          {emailVerified ? en.account.emailConfirmed : en.account.emailUnconfirmed}
        </p>
        <FormStatus message={signOutError} tone="error" />
        <div className="auth-form__actions">
          <button
            type="button"
            className="ui-btn"
            onClick={() => {
              void onSignOut();
            }}
            disabled={signingOut}
          >
            {signingOut ? en.account.signingOut : en.account.signOut}
          </button>
        </div>
      </section>

      <h2 className="account-heading">{en.account.bedTitle}</h2>
      {bed.items.length > 0 ? <FormStatus message={bed.error} tone="error" /> : null}

      {bed.loading && bed.items.length === 0 ? (
        <p role="status">{en.account.loading}</p>
      ) : null}

      {bed.error && bed.items.length === 0 && !bed.loading ? (
        <div className="account-panel" role="alert">
          <p>{bed.error}</p>
          <button
            type="button"
            className="ui-btn"
            onClick={() => {
              void bed.refresh();
            }}
          >
            {en.account.retry}
          </button>
        </div>
      ) : null}

      {!bed.loading && bed.items.length === 0 && !bed.error ? (
        <div className="account-panel">
          <p>{en.account.bedEmpty}</p>
          <p className="auth-form__hint">{en.account.bedEmptyHint}</p>
          <p className="auth-form__alt">
            <Link className="ui-btn ui-btn--primary" to="/grid">
              {en.account.gridLink}
            </Link>
          </p>
        </div>
      ) : null}

      {bed.items.length > 0 ? (
        <ul className="bed-list">
          {bed.items.map((item) => (
            <li key={item.cropId} className="bed-card">
              <h3>
                <Link to={`/crop/${item.cropId}`}>{item.cropName}</Link>
              </h3>
              <p className="bed-card__meta mono">
                {en.account.zoneLine(item.zoneName ?? item.zone, item.usdaZone)}
              </p>
              <p className="bed-card__meta">
                {item.inWindow
                  ? en.account.plantableNow
                  : item.nextHalfMonthLabel
                    ? en.account.nextWindow(item.nextHalfMonthLabel)
                    : en.account.noWindows}
              </p>
              {item.windows.length > 0 ? (
                <ul className="bed-card__windows">
                  {item.windows.map((window) => (
                    <li
                      key={`${window.method}-${window.start_half_month}-${window.end_half_month}`}
                      className="bed-card__window"
                    >
                      <MethodChip method={window.method} />
                      <span className="mono">
                        {en.account.windowRange(window.startLabel, window.endLabel)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="bed-card__meta">{en.account.noWindows}</p>
              )}
              <div className="bed-card__actions">
                <Link className="ui-btn" to={`/crop/${item.cropId}`}>
                  {en.account.openCrop}
                </Link>
                <BedControl cropId={item.cropId} cropName={item.cropName} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
