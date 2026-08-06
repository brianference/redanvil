import { Link, useParams } from 'react-router-dom';
import { SafeExternalLink } from '../../../design-system/SafeExternalLink';
import { CropArt } from '../components/CropArt';
import { MethodChip } from '../components/MethodChip';
import { useAsyncLoad } from '../hooks/useAsyncLoad';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import { fetchCropDetail } from '../lib/api';
import { halfMonthLabel } from '../lib/halfMonth';
import type { CropGuide } from '../lib/schemas';
import './ProsePage.css';

/**
 * Crop detail: windows, optional growing guide (how), harvest range, citations.
 */
export function CropDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useAsyncLoad(
    id ?? '',
    () => fetchCropDetail(id as string),
    Boolean(id)
  );

  useDocumentMeta(
    data ? `${data.crop.name} — ${en.appName}` : en.meta.homeTitle,
    data
      ? `Planting windows for ${data.crop.name} in the Arizona low desert (Cave Creek / Maricopa).`
      : en.meta.homeDescription
  );

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

          <GrowingGuideSection guide={data.guide ?? null} />

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
                    <SafeExternalLink href={w.source.url} data-testid="citation-link">
                      {w.source.title}
                    </SafeExternalLink>
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

/**
 * Render sourced growing guidance, or an honest missing-guide message.
 *
 * @param props - Guide payload or null.
 */
function GrowingGuideSection({ guide }: { guide: CropGuide | null }) {
  return (
    <section className="detail-guide" data-testid="crop-guide">
      <h2>{en.detail.guide}</h2>
      {!guide ? (
        <p className="detail-guide__missing" data-testid="crop-guide-missing">
          {en.detail.guideMissing}
        </p>
      ) : (
        <>
          <p className="detail-guide__partial mono">{en.detail.guidePartial}</p>
          <dl className="detail-guide__fields mono" data-testid="crop-guide-fields">
            <GuideField label={en.detail.guideDepth} value={guide.depth} testId="guide-depth" />
            <GuideField
              label={en.detail.guideSpacingInRow}
              value={guide.spacing_in_row}
              testId="guide-spacing-in-row"
            />
            <GuideField
              label={en.detail.guideSpacingBetweenRows}
              value={guide.spacing_between_rows}
              testId="guide-spacing-between-rows"
            />
            <GuideField label={en.detail.guideSun} value={guide.sun} testId="guide-sun" />
            <GuideField label={en.detail.guideWater} value={guide.water} testId="guide-water" />
            <GuideField
              label={en.detail.guideHarvest}
              value={guide.harvest_note}
              testId="guide-harvest"
            />
          </dl>
          <p className="window-card__cite">
            <span className="window-card__cite-label">{en.detail.guideCitation}</span>{' '}
            <SafeExternalLink href={guide.source.url} data-testid="guide-citation-link">
              {guide.source.title}
            </SafeExternalLink>
            <span className="window-card__cite-meta mono">
              {' '}
              — {guide.source.author}, {guide.source.publisher}. {en.detail.retrieved}{' '}
              {guide.source.retrieved_at}.
            </span>
          </p>
        </>
      )}
    </section>
  );
}

/**
 * One optional guide field; omitted entirely when the source left it null.
 *
 * @param props - Label, value, test id.
 */
function GuideField({
  label,
  value,
  testId
}: {
  label: string;
  value: string | null;
  testId: string;
}) {
  if (value == null || value.trim().length === 0) return null;
  return (
    <div data-testid={testId}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
