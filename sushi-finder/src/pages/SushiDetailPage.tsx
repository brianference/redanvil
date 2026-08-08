import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { en } from '../i18n/en';
import { deleteSushi, fetchSushi } from '../lib/api';
import type { SushiRow } from '../lib/schemas';

/**
 * Sushi detail with back link, edit, and confirm-before-delete (PRD F5 / F7).
 */
export function SushiDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [item, setItem] = useState<SushiRow | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setStatus('not-found');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const row = await fetchSushi(id);
      setItem(row);
      setStatus('ready');
    } catch (err) {
      const statusCode = (err as Error & { status?: number }).status;
      if (statusCode === 404 || (err instanceof Error && /not found/i.test(err.message))) {
        setStatus('not-found');
        return;
      }
      setError(err instanceof Error ? err.message : en.detail.error);
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Open native confirm dialog before destructive delete.
   */
  function openConfirm(): void {
    setConfirmOpen(true);
    dialogRef.current?.showModal();
  }

  /**
   * Cancel delete — close dialog, keep row.
   */
  function cancelDelete(): void {
    setConfirmOpen(false);
    dialogRef.current?.close();
  }

  /**
   * Confirm delete and return to list.
   */
  async function confirmDelete(): Promise<void> {
    if (!id) return;
    try {
      await deleteSushi(id);
      setConfirmOpen(false);
      dialogRef.current?.close();
      navigate('/sushis');
    } catch (err) {
      setError(err instanceof Error ? err.message : en.detail.error);
      setConfirmOpen(false);
      dialogRef.current?.close();
      setStatus('error');
    }
  }

  if (status === 'loading') {
    return (
      <>
        <Breadcrumbs
          items={[
            { label: en.brand.name, to: '/' },
            { label: en.sushis.title, to: '/sushis' },
            { label: '…' }
          ]}
        />
        <main id="main">
          <LoadingState message={en.detail.loading} />
        </main>
      </>
    );
  }

  if (status === 'not-found') {
    return (
      <>
        <Breadcrumbs
          items={[
            { label: en.brand.name, to: '/' },
            { label: en.sushis.title, to: '/sushis' },
            { label: en.detail.notFound }
          ]}
        />
        <main id="main">
          <h1 className="page-title">{en.detail.notFound}</h1>
          <EmptyState
            message={en.detail.notFoundHint}
            action={
              <Link className="btn" to="/sushis">
                {en.detail.back}
              </Link>
            }
          />
        </main>
      </>
    );
  }

  if (status === 'error' || !item) {
    return (
      <>
        <Breadcrumbs
          items={[
            { label: en.brand.name, to: '/' },
            { label: en.sushis.title, to: '/sushis' },
            { label: en.detail.error }
          ]}
        />
        <main id="main">
          <ErrorState
            message={error ?? en.detail.error}
            retryLabel={en.detail.retry}
            onRetry={() => void load()}
          />
          <p>
            <Link to="/sushis">{en.detail.back}</Link>
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.sushis.title, to: '/sushis' },
          { label: 'Detail' }
        ]}
      />
      <main id="main">
        <div className="detail-panel">
          <h1 className="page-title">{item.title}</h1>
          <div className="detail-actions">
            <Link className="btn" to="/sushis">
              {en.detail.back}
            </Link>
            <Link className="btn" to={`/sushis/${item.id}/edit`}>
              {en.detail.edit}
            </Link>
            {!confirmOpen ? (
              <button type="button" className="btn btn--danger" onClick={openConfirm}>
                {en.detail.delete}
              </button>
            ) : null}
          </div>
          <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase' }}>
            {en.detail.descriptionLabel}
          </h2>
          <p>{item.description || en.detail.emptyDescription}</p>
        </div>

        <dialog ref={dialogRef} className="dialog" aria-labelledby="delete-dialog-title">
          <h2 id="delete-dialog-title">{en.detail.confirmDelete}</h2>
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={cancelDelete}>
              {en.detail.confirmNo}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                void confirmDelete();
              }}
            >
              {en.detail.confirmYes}
            </button>
          </div>
        </dialog>
      </main>
    </>
  );
}
