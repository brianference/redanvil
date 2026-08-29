import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FormStatus } from '../components/FormStatus';
import { Page } from '../components/Page';
import { ShortlistControl } from '../components/ShortlistControl';
import { useSession } from '../hooks/useSession';
import { useShortlist } from '../hooks/useShortlist';
import { en } from '../i18n/en';
import type { AccountRole } from '../lib/schemas';

/**
 * Profile screen: email, confirmation state, sign-out, role, and sitter shortlist.
 */
export function Account(): JSX.Element {
  const { email, emailVerified, loading, signOut } = useSession();
  const shortlist = useShortlist();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AccountRole | ''>('');
  const [nameErr, setNameErr] = useState<string | undefined>();
  const [roleErr, setRoleErr] = useState<string | undefined>();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(shortlist.profile.display_name ?? '');
    setRole(shortlist.profile.role ?? '');
  }, [shortlist.profile.display_name, shortlist.profile.role]);

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

  /**
   * Persist display name and owner/sitter role.
   *
   * @param event - Form submit.
   */
  async function onSaveProfile(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = displayName.trim();
    const nextName = trimmed ? undefined : en.account.displayNameRequired;
    const nextRole = role ? undefined : en.account.roleRequired;
    setNameErr(nextName);
    setRoleErr(nextRole);
    setProfileError(null);
    setProfileSaved(null);
    if (nextName || nextRole || !role) return;

    try {
      await shortlist.saveProfile({ display_name: trimmed, role });
      setProfileSaved(en.account.profileSaved);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : en.account.error);
    }
  }

  if (loading || !email) {
    return (
      <Page title={en.account.title}>
        <p className="state">{en.account.loading}</p>
      </Page>
    );
  }

  return (
    <Page title={en.account.title}>
      <section className="account-panel" aria-labelledby="account-identity">
        <h2 id="account-identity">{en.account.signedInAs}</h2>
        <p className="account-email">{email}</p>
        <p className={emailVerified ? 'account-verified' : 'account-unverified'}>
          {emailVerified ? en.account.emailConfirmed : en.account.emailUnconfirmed}
        </p>
        <FormStatus message={signOutError} tone="error" />
        <button
          type="button"
          className="auth-form__submit auth-form__submit--secondary"
          onClick={() => {
            void onSignOut();
          }}
          disabled={signingOut}
        >
          {signingOut ? en.account.signingOut : en.account.signOut}
        </button>
      </section>

      <section className="account-panel" aria-labelledby="account-profile">
        <h2 id="account-profile">{en.account.profileTitle}</h2>
        <form
          className="auth-form"
          onSubmit={(event) => {
            void onSaveProfile(event);
          }}
          noValidate
        >
          <div className="auth-form__field">
            <label htmlFor="account-display-name">{en.account.displayName}</label>
            <input
              id="account-display-name"
              name="display_name"
              type="text"
              autoComplete="nickname"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              aria-invalid={Boolean(nameErr)}
              aria-describedby={
                nameErr ? 'account-display-name-hint account-display-name-error' : 'account-display-name-hint'
              }
              disabled={shortlist.savingProfile}
            />
            <p id="account-display-name-hint" className="auth-form__hint">
              {en.account.displayNameHint}
            </p>
            {nameErr ? (
              <p id="account-display-name-error" className="auth-form__error">
                {nameErr}
              </p>
            ) : null}
          </div>
          <fieldset
            className="auth-form__field"
            aria-describedby={roleErr ? 'account-role-error' : undefined}
          >
            <legend>{en.account.roleLabel}</legend>
            <label className="auth-form__choice">
              <input
                type="radio"
                name="role"
                value="owner"
                checked={role === 'owner'}
                onChange={() => setRole('owner')}
                disabled={shortlist.savingProfile}
              />
              {en.account.roleOwner}
            </label>
            <label className="auth-form__choice">
              <input
                type="radio"
                name="role"
                value="sitter"
                checked={role === 'sitter'}
                onChange={() => setRole('sitter')}
                disabled={shortlist.savingProfile}
              />
              {en.account.roleSitter}
            </label>
            {roleErr ? (
              <p id="account-role-error" className="auth-form__error" aria-live="polite">
                {roleErr}
              </p>
            ) : null}
          </fieldset>
          <FormStatus message={profileError} tone="error" />
          <FormStatus message={profileSaved} tone="success" />
          <button type="submit" className="auth-form__submit" disabled={shortlist.savingProfile}>
            {shortlist.savingProfile ? en.account.savingProfile : en.account.saveProfile}
          </button>
        </form>
      </section>

      <h2>{en.account.shortlistTitle}</h2>
      {role === 'sitter' ? <p className="auth-form__hint">{en.account.shortlistOwnerHint}</p> : null}
      {shortlist.items.length > 0 ? <FormStatus message={shortlist.error} tone="error" /> : null}

      {shortlist.loading && shortlist.items.length === 0 ? (
        <p className="state">{en.account.loading}</p>
      ) : null}

      {shortlist.error && shortlist.items.length === 0 && !shortlist.loading ? (
        <div className="state state--error">
          <p>{shortlist.error}</p>
          <button
            type="button"
            className="auth-form__submit auth-form__submit--secondary"
            onClick={() => {
              void shortlist.refresh();
            }}
          >
            {en.account.retry}
          </button>
        </div>
      ) : null}

      {!shortlist.loading && shortlist.items.length === 0 && !shortlist.error ? (
        <div className="state state--empty">
          <p>{en.account.shortlistEmpty}</p>
          <p className="auth-form__hint">{en.account.shortlistEmptyHint}</p>
          <p>
            <Link className="auth-form__submit" to="/sitters">
              {en.account.catalogLink}
            </Link>
          </p>
        </div>
      ) : null}

      {shortlist.items.length > 0 ? (
        <ul className="shortlist">
          {shortlist.items.map((item) => (
            <li key={item.sitter_id} className="shortlist__item">
              <div>
                <h3>
                  <Link to={`/sitters/${item.sitter_id}`}>{item.name}</Link>
                </h3>
                <p>
                  {item.neighbourhood} · ${item.rate_per_night}
                  {en.home.perNight}
                </p>
              </div>
              <div className="shortlist__actions">
                <Link className="shortlist-btn" to={`/sitters/${item.sitter_id}`}>
                  {en.account.openSitter}
                </Link>
                <ShortlistControl sitterId={item.sitter_id} name={item.name} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Page>
  );
}
