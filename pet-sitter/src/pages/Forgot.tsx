import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { FormStatus } from '../components/FormStatus';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { requestPasswordReset } from '../lib/api';
import { fieldError } from '../lib/apiError';
import { formErrorMessage } from '../lib/authForm';

/**
 * Request a password reset. Always shows the same confirmation copy.
 */
export function Forgot(): JSX.Element {
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
    <Page title={en.auth.forgotTitle}>
      <p className="page-intro">{en.auth.forgotLead}</p>
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
            <label htmlFor="forgot-email">{en.auth.emailLabel}</label>
            <input
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
          <button type="submit" className="auth-form__submit" disabled={submitting}>
            {submitting ? en.auth.submitting : en.auth.submitForgot}
          </button>
          <p className="auth-form__alt">
            <Link to="/signin">{en.auth.haveAccount}</Link>
          </p>
        </form>
      )}
    </Page>
  );
}
