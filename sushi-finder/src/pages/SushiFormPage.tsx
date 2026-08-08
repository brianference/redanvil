import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ErrorState, LoadingState } from '../components/states';
import { en } from '../i18n/en';
import { createSushi, fetchSushi, updateSushi } from '../lib/api';

/**
 * Create or edit sushi. Empty title is submitted so the API can return 400 (F7).
 *
 * @param props.mode - create | edit
 */
export function SushiFormPage({ mode }: { mode: 'create' | 'edit' }): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    void fetchSushi(id)
      .then((row) => {
        if (cancelled) return;
        setTitle(row.title);
        setDescription(row.description);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : en.detail.error);
        setLoadFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, id]);

  /**
   * Submit create/update. Does not use HTML required so empty title POSTs for 400.
   *
   * @param event - Form submit.
   */
  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const created = await createSushi({ title, description });
        navigate(`/sushis/${created.id}`);
        return;
      }
      if (!id) {
        setError(en.form.notFound);
        return;
      }
      const updated = await updateSushi(id, { title, description });
      navigate(`/sushis/${updated.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : en.form.saveError);
    } finally {
      setSaving(false);
    }
  }

  const heading = mode === 'create' ? en.sushis.createTitle : en.sushis.editTitle;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.sushis.title, to: '/sushis' },
          { label: heading }
        ]}
      />
      <main id="main">
        <h1 className="page-title">{heading}</h1>

        {loading ? <LoadingState message={en.form.loading} /> : null}

        {!loading && loadFailed ? (
          <ErrorState
            message={error ?? en.detail.error}
            retryLabel={en.detail.retry}
            onRetry={() => {
              if (!id) return;
              setLoading(true);
              setLoadFailed(false);
              setError(null);
              void fetchSushi(id)
                .then((row) => {
                  setTitle(row.title);
                  setDescription(row.description);
                  setLoading(false);
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : en.detail.error);
                  setLoadFailed(true);
                  setLoading(false);
                });
            }}
          />
        ) : null}

        {!loading && !loadFailed ? (
          <form
            className="detail-panel"
            onSubmit={(event) => {
              void onSubmit(event);
            }}
            noValidate
          >
            <div className="field">
              <label htmlFor="sushi-title">{en.sushis.fieldTitle}</label>
              <input
                id="sushi-title"
                name="title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="sushi-description">{en.sushis.fieldDescription}</label>
              <textarea
                id="sushi-description"
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
              />
            </div>
            {error ? (
              <p className="state state--error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="detail-actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {mode === 'create' ? en.sushis.create : en.sushis.save}
              </button>
              <Link className="btn" to={id ? `/sushis/${id}` : '/sushis'}>
                {en.sushis.cancel}
              </Link>
            </div>
          </form>
        ) : null}
      </main>
    </>
  );
}
