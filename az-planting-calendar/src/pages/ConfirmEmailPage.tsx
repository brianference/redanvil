import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FormStatus } from '../components/FormStatus';
import { useSession } from '../hooks/useSession';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import { confirmEmailOnce } from '../lib/api';
import '../components/Form.css';
import './ProsePage.css';

type ConfirmStatus = 'working' | 'success' | 'expired' | 'missing';

/**
 * Redeem `?token=` on mount and show success or an expired-link message.
 */
export function ConfirmEmailPage() {
  useDocumentMeta(en.meta.confirmTitle, en.meta.confirmDescription);
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const { refresh } = useSession();
  const [status, setStatus] = useState<ConfirmStatus>(token ? 'working' : 'missing');

  useEffect(() => {
    if (!token) {
      setStatus('missing');
      return;
    }
    let cancelled = false;
    void confirmEmailOnce(token)
      .then(async () => {
        await refresh();
        if (!cancelled) setStatus('success');
      })
      .catch(() => {
        if (!cancelled) setStatus('expired');
      });
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  const failed = status === 'expired' || status === 'missing';
  const message =
    status === 'success'
      ? en.auth.confirmSuccess
      : status === 'missing'
        ? en.auth.confirmMissingToken
        : en.auth.confirmExpired;

  return (
    <article className="prose shell" data-testid="confirm-page">
      <header className="prose__header">
        <h1>{en.auth.confirmTitle}</h1>
      </header>
      {status === 'working' ? (
        <p role="status">{en.auth.confirmWorking}</p>
      ) : (
        <div className="auth-form">
          <FormStatus message={message} tone={status === 'success' ? 'success' : 'error'} />
          {failed || status === 'success' ? (
            <p className="auth-form__alt">
              <Link to="/account">{en.auth.confirmBack}</Link>
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
