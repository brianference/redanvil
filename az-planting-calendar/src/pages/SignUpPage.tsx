import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FormStatus } from '../components/FormStatus';
import { useSession } from '../hooks/useSession';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import { registerAccount } from '../lib/api';
import { fieldError } from '../lib/apiError';
import { formErrorMessage, passwordLengthError } from '../lib/authForm';
import '../components/Form.css';
import './ProsePage.css';

/**
 * Email + password registration. States the 12-character minimum before submit.
 */
export function SignUpPage() {
  useDocumentMeta(en.meta.signUpTitle, en.meta.signUpDescription);
  const { email, loading, refresh } = useSession();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | undefined>();
  const [passwordErr, setPasswordErr] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && email) {
    return <Navigate to="/account" replace />;
  }

  /**
   * Create the account, then refresh the shared session.
   *
   * @param event - Form submit.
   */
  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = address.trim();
    const lengthErr = passwordLengthError(password);
    setEmailErr(trimmed ? undefined : en.auth.emailRequired);
    setPasswordErr(password ? (lengthErr ?? undefined) : en.auth.passwordRequired);
    setFormError(null);
    if (!trimmed || !password || lengthErr) return;

    setSubmitting(true);
    try {
      await registerAccount(trimmed, password);
      await refresh();
      navigate('/account', { replace: true });
    } catch (err) {
      setEmailErr(fieldError(err, 'email'));
      setPasswordErr(fieldError(err, 'password'));
      setFormError(formErrorMessage(err, en.auth.genericError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="prose shell" data-testid="signup-page">
      <header className="prose__header">
        <h1>{en.auth.signUpTitle}</h1>
        <p className="prose__intro">{en.auth.signUpLead}</p>
      </header>
      <form
        className="auth-form"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        noValidate
      >
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="signup-email">
            {en.auth.emailLabel}
          </label>
          <input
            className="auth-form__input"
            id="signup-email"
            name="email"
            type="email"
            autoComplete="username"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-invalid={Boolean(emailErr)}
            aria-describedby={emailErr ? 'signup-email-error' : undefined}
            disabled={submitting}
          />
          {emailErr ? (
            <p id="signup-email-error" className="auth-form__error">
              {emailErr}
            </p>
          ) : null}
        </div>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="signup-password">
            {en.auth.passwordLabel}
          </label>
          <input
            className="auth-form__input"
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(passwordErr)}
            aria-describedby={
              passwordErr ? 'signup-password-hint signup-password-error' : 'signup-password-hint'
            }
            disabled={submitting}
          />
          <p id="signup-password-hint" className="auth-form__hint">
            {en.auth.passwordHint}
          </p>
          {passwordErr ? (
            <p id="signup-password-error" className="auth-form__error">
              {passwordErr}
            </p>
          ) : null}
        </div>
        <FormStatus message={formError} tone="error" />
        <div className="auth-form__actions">
          <button type="submit" className="ui-btn ui-btn--primary" disabled={submitting}>
            {submitting ? en.auth.submitting : en.auth.submitSignUp}
          </button>
        </div>
        <p className="auth-form__alt">
          <Link to="/signin">{en.auth.haveAccount}</Link>
        </p>
      </form>
    </article>
  );
}
