import { FormEvent, useState } from 'react';
import { Page } from '../components/Page';
import { en } from '../i18n/en';

/**
 * Register / sign-in form (Web Crypto sessions via /api/auth).
 */
export function Login(): JSX.Element {
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Submit auth form.
   *
   * @param event - Form submit.
   */
  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: mode,
          email,
          password,
          display_name: displayName || undefined
        })
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? en.login.failed);
        return;
      }
      setMessage(mode === 'register' ? en.login.registered : en.login.signedIn);
    } catch {
      setError(en.login.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page title={en.login.title}>
      <p className="page-intro">{en.login.intro}</p>
      <div className="auth-tabs">
        <button
          type="button"
          className={mode === 'sign-in' ? 'auth-tabs__btn is-active' : 'auth-tabs__btn'}
          onClick={() => setMode('sign-in')}
        >
          {en.login.signIn}
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'auth-tabs__btn is-active' : 'auth-tabs__btn'}
          onClick={() => setMode('register')}
        >
          {en.login.register}
        </button>
      </div>
      <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
        {mode === 'register' ? (
          <label className="auth-form__field">
            <span>{en.login.displayName}</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </label>
        ) : null}
        <label className="auth-form__field">
          <span>{en.login.email}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="auth-form__field">
          <span>{en.login.password}</span>
          <input
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </label>
        <button type="submit" className="auth-form__submit" disabled={loading}>
          {loading ? en.login.working : mode === 'register' ? en.login.register : en.login.signIn}
        </button>
      </form>
      {error ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="state state--ok">{message}</p> : null}
    </Page>
  );
}
