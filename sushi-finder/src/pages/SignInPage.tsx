import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { FormStatus } from '../components/FormStatus';
import { useSession } from '../hooks/useSession';
import { en } from '../i18n/en';
import { loginAccount } from '../lib/api';
import { fieldError } from '../lib/apiError';
import { formErrorMessage, safeInternalPath } from '../lib/authForm';

/**
 * Email + password sign-in. Redirects to /account (or a safe `from` path).
 */
export function SignInPage(): JSX.Element {
  const { email, loading, refresh } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | undefined>();
  const [passwordErr, setPasswordErr] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && email) {
    const next = safeInternalPath((location.state as { from?: unknown } | null)?.from);
    return <Navigate to={next ?? '/account'} replace />;
  }

  /**
   * POST credentials, then refresh the shared session.
   *
   * @param event - Form submit.
   */
  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = address.trim();
    setEmailErr(trimmed ? undefined : en.auth.emailRequired);
    setPasswordErr(password ? undefined : en.auth.passwordRequired);
    setFormError(null);
    if (!trimmed || !password) return;

    setSubmitting(true);
    try {
      await loginAccount(trimmed, password);
      await refresh();
      const next = safeInternalPath((location.state as { from?: unknown } | null)?.from);
      navigate(next ?? '/account', { replace: true });
    } catch (err) {
      setEmailErr(fieldError(err, 'email'));
      setPasswordErr(fieldError(err, 'password'));
      setFormError(formErrorMessage(err, en.auth.genericError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.auth.signInTitle }
        ]}
      />
      <main id="main">
        <h1 className="page-title">{en.auth.signInTitle}</h1>
        <p className="lead">{en.auth.signInLead}</p>
        <form
          className="detail-panel"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          noValidate
        >
          <div className="field">
            <label htmlFor="signin-email">{en.auth.emailLabel}</label>
            <input
              id="signin-email"
              name="email"
              type="email"
              autoComplete="username"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              aria-invalid={Boolean(emailErr)}
              aria-describedby={emailErr ? 'signin-email-error' : undefined}
              disabled={submitting}
            />
            {emailErr ? (
              <p id="signin-email-error" className="field__error">
                {emailErr}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="signin-password">{en.auth.passwordLabel}</label>
            <input
              id="signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(passwordErr)}
              aria-describedby={passwordErr ? 'signin-password-error' : undefined}
              disabled={submitting}
            />
            {passwordErr ? (
              <p id="signin-password-error" className="field__error">
                {passwordErr}
              </p>
            ) : null}
          </div>
          <FormStatus message={formError} tone="error" />
          <div className="detail-actions">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? en.auth.submitting : en.auth.submitSignIn}
            </button>
          </div>
          <p className="auth-alt">
            <Link to="/signup">{en.auth.needAccount}</Link>
            <Link to="/forgot">{en.auth.forgotLink}</Link>
          </p>
        </form>
      </main>
    </>
  );
}
