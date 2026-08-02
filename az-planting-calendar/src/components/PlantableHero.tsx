import { Link } from 'react-router-dom';
import { en } from '../i18n/en';
import type { PlantableItem, PlantableResponse } from '../lib/schemas';
import { CropArt } from './CropArt';
import { MethodChip } from './MethodChip';
import './PlantableHero.css';

interface PlantableHeroProps {
  data: PlantableResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * Crop rows for the selected half-month (secondary to the timeline hero).
 * Larger crop art so the 45 illustrations are distinguishable at a glance.
 */
export function PlantableHero({ data, loading, error, onRetry }: PlantableHeroProps) {
  const heading =
    data != null
      ? en.timeline.plantableHeading(data.half_month_label)
      : en.hero.title;

  return (
    <section
      id="plantable-now"
      className="plantable"
      data-testid="plantable-hero"
      aria-labelledby="hero-title"
    >
      <div className="plantable__inner">
        <div className="plantable__head">
          <h2 id="hero-title" className="plantable__title">
            {heading}
          </h2>
          {data ? (
            <div className="plantable__meta mono" data-testid="hero-meta">
              <span>
                {en.hero.asOf} <strong>{data.date}</strong>
              </span>
              <span className="plantable__meta-sep" aria-hidden="true">
                ·
              </span>
              <span>
                {en.hero.halfMonth} <strong>{data.half_month_label}</strong>
              </span>
              <span className="plantable__meta-sep" aria-hidden="true">
                ·
              </span>
              <span data-testid="hero-count">{en.hero.count(data.items.length)}</span>
              {data.zone ? (
                <span className="plantable__meta-zone" data-testid="hero-zone-name">
                  <span className="plantable__meta-sep" aria-hidden="true">
                    ·
                  </span>
                  {data.zone.name}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="plantable__source mono" data-testid="hero-source-note">
            {en.hero.sourceNote}
          </p>
        </div>

        {loading ? (
          <p className="plantable__status" role="status">
            {en.hero.loading}
          </p>
        ) : null}

        {error ? (
          <div className="plantable__error" role="alert">
            <p>{en.hero.error}</p>
            <p className="mono">{error}</p>
            <button type="button" className="plantable__retry" onClick={onRetry}>
              {en.hero.retry}
            </button>
          </div>
        ) : null}

        {data && !loading && !error ? (
          data.items.length === 0 ? (
            <p className="plantable__status" data-testid="hero-empty">
              {en.hero.empty}
            </p>
          ) : (
            <ul className="plantable__list" data-testid="hero-list">
              {data.items.map((item, index) => (
                <li key={item.crop.id}>
                  <PlantableRow item={item} priority={index < 4} />
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </section>
  );
}

/**
 * One plantable crop row with larger art, methods, and source link.
 *
 * @param props - Crop item and load priority.
 */
function PlantableRow({
  item,
  priority = false
}: {
  item: PlantableItem;
  priority?: boolean;
}) {
  const harvest =
    item.crop.days_to_harvest_min != null && item.crop.days_to_harvest_max != null
      ? `${item.crop.days_to_harvest_min}–${item.crop.days_to_harvest_max}`
      : item.crop.notes;

  const primarySource = item.windows[0]?.source;
  const granularity = item.windows[0]?.source_granularity;

  return (
    <article className="plant-row" data-testid="plant-card">
      <CropArt cropId={item.crop.id} alt="" size="row" priority={priority} />
      <div className="plant-row__body">
        <div className="plant-row__head">
          <h3 className="plant-row__name">
            <Link to={`/crop/${item.crop.id}`}>{item.crop.name}</Link>
          </h3>
          <div className="plant-row__methods">
            {item.methods.map((m) => (
              <MethodChip key={m} method={m} />
            ))}
          </div>
        </div>
        {harvest ? (
          <p className="plant-row__harvest mono">
            <span className="plant-row__label">{en.hero.daysHarvest}</span> {harvest}
          </p>
        ) : null}
        {primarySource ? (
          <p className="plant-row__source">
            <span className="plant-row__label">{en.hero.source}</span>{' '}
            <a
              href={primarySource.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="source-link"
            >
              {primarySource.title}
            </a>
          </p>
        ) : null}
        {granularity === 'month' ? (
          <p className="plant-row__granularity mono" data-testid="source-granularity">
            {en.detail.granularityMonth}
          </p>
        ) : null}
        <Link className="plant-row__detail" to={`/crop/${item.crop.id}`}>
          {en.hero.viewCrop}
        </Link>
      </div>
    </article>
  );
}
