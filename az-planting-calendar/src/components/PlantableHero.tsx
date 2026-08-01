import { Link } from 'react-router-dom';
import { en } from '../i18n/en';
import type { PlantableItem, PlantableResponse } from '../lib/schemas';
import { MethodChip } from './MethodChip';
import './PlantableHero.css';

interface PlantableHeroProps {
  data: PlantableResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  date: string;
  onDateChange: (date: string) => void;
}

/**
 * Focus-hero: first viewport answers "what can I plant now?"
 * Date control lives here so plantable results stay in the first screen.
 */
export function PlantableHero({
  data,
  loading,
  error,
  onRetry,
  date,
  onDateChange
}: PlantableHeroProps) {
  return (
    <section className="hero" data-testid="plantable-hero" aria-labelledby="hero-title">
      <div className="hero__inner shell">
        <p className="hero__kicker mono">{en.hero.kicker}</p>
        <h1 id="hero-title" className="hero__title">
          {en.hero.title}
        </h1>
        <p className="hero__subtitle">{en.hero.subtitle}</p>

        <label className="hero__date">
          <span className="hero__date-label">{en.filters.date}</span>
          <input
            type="date"
            className="hero__date-input mono"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            data-testid="filter-date"
          />
        </label>

        {data ? (
          <div className="hero__meta mono" data-testid="hero-meta">
            <span>
              {en.hero.asOf} <strong>{data.date}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {en.hero.halfMonth} <strong>{data.half_month_label}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span data-testid="hero-count">{en.hero.count(data.items.length)}</span>
          </div>
        ) : null}

        {loading ? (
          <p className="hero__status" role="status">
            {en.hero.loading}
          </p>
        ) : null}

        {error ? (
          <div className="hero__error" role="alert">
            <p>{en.hero.error}</p>
            <p className="mono">{error}</p>
            <button type="button" className="hero__retry" onClick={onRetry}>
              {en.hero.retry}
            </button>
          </div>
        ) : null}

        {data && !loading && !error ? (
          data.items.length === 0 ? (
            <p className="hero__status" data-testid="hero-empty">
              {en.hero.empty}
            </p>
          ) : (
            <ul className="hero__list" data-testid="hero-list">
              {data.items.map((item) => (
                <li key={item.crop.id}>
                  <PlantableCard item={item} />
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
 * One plantable crop card with methods and source link.
 */
function PlantableCard({ item }: { item: PlantableItem }) {
  const harvest =
    item.crop.days_to_harvest_min != null && item.crop.days_to_harvest_max != null
      ? `${item.crop.days_to_harvest_min}–${item.crop.days_to_harvest_max}`
      : item.crop.notes;

  const primarySource = item.windows[0]?.source;

  return (
    <article className="plant-card" data-testid="plant-card">
      <div className="plant-card__head">
        <h2 className="plant-card__name">
          <Link to={`/crop/${item.crop.id}`}>{item.crop.name}</Link>
        </h2>
        <div className="plant-card__methods">
          {item.methods.map((m) => (
            <MethodChip key={m} method={m} />
          ))}
        </div>
      </div>
      {harvest ? (
        <p className="plant-card__harvest mono">
          <span className="plant-card__harvest-label">{en.hero.daysHarvest}</span> {harvest}
        </p>
      ) : null}
      {primarySource ? (
        <p className="plant-card__source">
          <span className="plant-card__source-label">{en.hero.source}</span>{' '}
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
      <Link className="plant-card__detail" to={`/crop/${item.crop.id}`}>
        {en.hero.viewCrop}
      </Link>
    </article>
  );
}
