import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { FormStatus } from '../components/FormStatus';
import { LoadingState } from '../components/states';
import { useSession } from '../hooks/useSession';
import { en } from '../i18n/en';
import { confirmEmailOnce } from '../lib/api';

type ConfirmStatus = 'working' | 'success' | 'expired' | 'missing';

/**
 * Redeem `?token=` on mount and show success or an expired-link message.
 */
export function ConfirmEmailPage(): JSX.Element {
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
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.auth.confirmTitle }
        ]}
      />
      <main id="main">
        <h1 className="page-title">{en.auth.confirmTitle}</h1>
        {status === 'working' ? <LoadingState message={en.auth.confirmWorking} /> : null}
        {status !== 'working' ? (
          <div className="detail-panel">
            <FormStatus message={message} tone={status === 'success' ? 'success' : 'error'} />
            {failed || status === 'success' ? (
              <p className="auth-alt">
                <Link to="/account">{en.auth.confirmBack}</Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </main>
    </>
  );
}
