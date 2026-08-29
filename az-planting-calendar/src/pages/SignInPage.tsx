import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FormStatus } from '../components/FormStatus';
import { useSession } from '../hooks/useSession';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import { loginAccount } from '../lib/api';
import { fieldError } from '../lib/apiError';
import { formErrorMessage, safeInternalPath } from '../lib/authForm';
import '../components/Form.css';
import './ProsePage.css';

/**
 * Email + password sign-in. Redirects to /account (or a safe `from` path).
 */
export function SignInPage() {
  useDocumentMeta(en.meta.signInTitle, en.meta.signInDescription);
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
    <article className="prose shell" data-testid="signin-page">
      <header className="prose__header">
        <h1>{en.auth.signInTitle}</h1>
        <p className="prose__intro">{en.auth.signInLead}</p>
      </header>
      <form
        className="auth-form"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        noValidate
      >
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="signin-email">
            {en.auth.emailLabel}
          </label>
          <input
            className="auth-form__input"
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
            <p id="signin-email-error" className="auth-form__error">
              {emailErr}
            </p>
          ) : null}
        </div>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="signin-password">
            {en.auth.passwordLabel}
          </label>
          <input
            className="auth-form__input"
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
            <p id="signin-password-error" className="auth-form__error">
              {passwordErr}
            </p>
          ) : null}
        </div>
        <FormStatus message={formError} tone="error" />
        <div className="auth-form__actions">
          <button type="submit" className="ui-btn ui-btn--primary" disabled={submitting}>
            {submitting ? en.auth.submitting : en.auth.submitSignIn}
          </button>
        </div>
        <p className="auth-form__alt">
          <Link to="/signup">{en.auth.needAccount}</Link>
          <Link to="/forgot">{en.auth.forgotLink}</Link>
        </p>
      </form>
    </article>
  );
}
