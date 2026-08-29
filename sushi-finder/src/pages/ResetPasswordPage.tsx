import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { FormStatus } from '../components/FormStatus';
import { useSession } from '../hooks/useSession';
import { en } from '../i18n/en';
import { resetPassword } from '../lib/api';
import { fieldError } from '../lib/apiError';
import { formErrorMessage, passwordLengthError } from '../lib/authForm';

/**
 * Redeem `?token=` with a new password that meets the 12-character minimum.
 */
export function ResetPasswordPage(): JSX.Element {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [passwordErr, setPasswordErr] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Set the new password and open a session.
   *
   * @param event - Form submit.
   */
  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const lengthErr = passwordLengthError(password);
    setPasswordErr(password ? lengthErr ?? undefined : en.auth.passwordRequired);
    setFormError(null);
    if (!password || lengthErr) return;

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      await refresh();
      navigate('/account', { replace: true });
    } catch (err) {
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
          { label: en.auth.resetTitle }
        ]}
      />
      <main id="main">
        <h1 className="page-title">{en.auth.resetTitle}</h1>
        {!token ? (
          <div className="detail-panel">
            <FormStatus message={en.auth.resetMissingToken} tone="error" />
            <p className="auth-alt">
              <Link to="/forgot">{en.auth.resetRequestNew}</Link>
            </p>
          </div>
        ) : (
          <form
            className="detail-panel"
            onSubmit={(event) => {
              void onSubmit(event);
            }}
            noValidate
          >
            <div className="field">
              <label htmlFor="reset-password">{en.auth.passwordLabel}</label>
              <input
                id="reset-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(passwordErr)}
                aria-describedby={
                  passwordErr ? 'reset-password-hint reset-password-error' : 'reset-password-hint'
                }
                disabled={submitting}
              />
              <p id="reset-password-hint" className="field__hint">
                {en.auth.passwordHint}
              </p>
              {passwordErr ? (
                <p id="reset-password-error" className="field__error">
                  {passwordErr}
                </p>
              ) : null}
            </div>
            <FormStatus message={formError} tone="error" />
            <div className="detail-actions">
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? en.auth.submitting : en.auth.submitReset}
              </button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
