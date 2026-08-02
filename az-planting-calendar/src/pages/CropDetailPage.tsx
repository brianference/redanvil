import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CropArt } from '../components/CropArt';
import { MethodChip } from '../components/MethodChip';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import { fetchCropDetail } from '../lib/api';
import { halfMonthLabel } from '../lib/halfMonth';
import type { CropDetailResponse } from '../lib/schemas';
import './ProsePage.css';

/**
 * Crop detail: windows, harvest range, and working citation links.
 */
export function CropDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CropDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentMeta(
    data ? `${data.crop.name} — ${en.appName}` : en.meta.homeTitle,
    data
      ? `Planting windows for ${data.crop.name} in the Arizona low desert (Cave Creek / Maricopa).`
      : en.meta.homeDescription
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchCropDetail(id)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'error');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <article className="prose shell" data-testid="crop-detail">
      <p className="prose__back">
        <Link to="/">{en.detail.back}</Link>
      </p>

      {loading ? <p role="status">{en.detail.loading}</p> : null}
      {error ? (
        <p role="alert">
          {en.detail.error} {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="detail-hero">
            <CropArt
              cropId={data.crop.id}
              alt={data.crop.name}
              size="detail"
              priority
            />
            <h1>{data.crop.name}</h1>
          </div>
          <dl className="detail-meta mono">
            <div>
              <dt>{en.detail.harvest}</dt>
              <dd>
                {data.crop.days_to_harvest_min != null && data.crop.days_to_harvest_max != null
                  ? `${data.crop.days_to_harvest_min}–${data.crop.days_to_harvest_max}`
                  : '—'}
              </dd>
            </div>
            {data.crop.notes ? (
              <div>
                <dt>{en.detail.notes}</dt>
                <dd>{data.crop.notes}</dd>
              </div>
            ) : null}
          </dl>

          <h2>{en.detail.windows}</h2>
          {data.windows.length === 0 ? (
            <p>{en.detail.noWindows}</p>
          ) : (
            <ul className="window-list" data-testid="window-list">
              {data.windows.map((w) => (
                <li key={w.id} className="window-card" data-testid="window-card">
                  <div className="window-card__row">
                    <MethodChip method={w.method} />
                    <span className="window-card__range mono">
                      {halfMonthLabel(w.start_half_month)}
                      {w.start_half_month !== w.end_half_month
                        ? ` – ${halfMonthLabel(w.end_half_month)}`
                        : ''}
                    </span>
                  </div>
                  {w.source_granularity === 'month' ? (
                    <p className="window-card__granularity mono" data-testid="source-granularity">
                      {en.detail.granularityMonth}
                    </p>
                  ) : (
                    <p className="window-card__granularity mono" data-testid="source-granularity">
                      {en.detail.granularityHalf}
                    </p>
                  )}
                  <p className="window-card__cite">
                    <span className="window-card__cite-label">{en.detail.citation}</span>{' '}
                    <a
                      href={w.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="citation-link"
                    >
                      {w.source.title}
                    </a>
                    <span className="window-card__cite-meta mono">
                      {' '}
                      — {w.source.author}, {w.source.publisher}. {en.detail.retrieved}{' '}
                      {w.source.retrieved_at}.
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </article>
  );
}
