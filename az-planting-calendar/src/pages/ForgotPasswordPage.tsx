import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { FormStatus } from '../components/FormStatus';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import { requestPasswordReset } from '../lib/api';
import { fieldError } from '../lib/apiError';
import { formErrorMessage } from '../lib/authForm';
import '../components/Form.css';
import './ProsePage.css';

/**
 * Request a password reset. Always shows the same confirmation copy.
 */
export function ForgotPasswordPage() {
  useDocumentMeta(en.meta.forgotTitle, en.meta.forgotDescription);
  const [address, setAddress] = useState('');
  const [emailErr, setEmailErr] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * POST the address. Success and unknown-account look identical on purpose.
   *
   * @param event - Form submit.
   */
  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = address.trim();
    setEmailErr(trimmed ? undefined : en.auth.emailRequired);
    setFormError(null);
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await requestPasswordReset(trimmed);
      setDone(true);
    } catch (err) {
      setEmailErr(fieldError(err, 'email'));
      setFormError(formErrorMessage(err, en.auth.genericError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="prose shell" data-testid="forgot-page">
      <header className="prose__header">
        <h1>{en.auth.forgotTitle}</h1>
        <p className="prose__intro">{en.auth.forgotLead}</p>
      </header>
      {done ? (
        <div className="auth-form">
          <FormStatus message={en.auth.forgotDone} tone="success" />
          <p className="auth-form__alt">
            <Link to="/signin">{en.auth.haveAccount}</Link>
          </p>
        </div>
      ) : (
        <form
          className="auth-form"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          noValidate
        >
          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="forgot-email">
              {en.auth.emailLabel}
            </label>
            <input
              className="auth-form__input"
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="username"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              aria-invalid={Boolean(emailErr)}
              aria-describedby={emailErr ? 'forgot-email-error' : undefined}
              disabled={submitting}
            />
            {emailErr ? (
              <p id="forgot-email-error" className="auth-form__error">
                {emailErr}
              </p>
            ) : null}
          </div>
          <FormStatus message={formError} tone="error" />
          <div className="auth-form__actions">
            <button type="submit" className="ui-btn ui-btn--primary" disabled={submitting}>
              {submitting ? en.auth.submitting : en.auth.submitForgot}
            </button>
          </div>
          <p className="auth-form__alt">
            <Link to="/signin">{en.auth.haveAccount}</Link>
          </p>
        </form>
      )}
    </article>
  );
}
