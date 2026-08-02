import { Link } from 'react-router-dom';
import { en } from '../i18n/en';
import type { PlantableItem, PlantableResponse, Zone } from '../lib/schemas';
import { MethodChip } from './MethodChip';
import './PlantableHero.css';

interface PlantableHeroProps {
  data: PlantableResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  date: string;
  onDateChange: (date: string) => void;
  /** Crop name search (single control; narrows year grid). */
  searchQ: string;
  onSearchChange: (q: string) => void;
  /** Active planning zone for citation context. */
  zone: Zone | null;
}

/**
 * Focus-hero: first viewport answers "what can I plant now?"
 * Date + crop search live here so plantable results and search stay above the fold.
 * Order: title → controls → meta → list so the first plantable card clears a 375×844 fold
 * after the taller brand mark (item 2).
 */
export function PlantableHero({
  data,
  loading,
  error,
  onRetry,
  date,
  onDateChange,
  searchQ,
  onSearchChange,
  zone
}: PlantableHeroProps) {
  return (
    <section
      id="plantable-now"
      className="hero"
      data-testid="plantable-hero"
      aria-labelledby="hero-title"
    >
      <div className="hero__banner" aria-hidden="true">
        <img
          className="hero__banner-img"
          src="/hero-desert.jpg"
          alt=""
          width={1280}
          height={320}
          decoding="async"
        />
      </div>
      <div className="hero__inner shell">
        <p className="hero__kicker mono">{en.hero.kicker}</p>
        <h1 id="hero-title" className="hero__title">
          {en.hero.title}
        </h1>
        <p className="hero__subtitle">{en.hero.subtitle}</p>

        {zone ? (
          <p className="hero__zone-context mono" data-testid="hero-zone-context">
            {en.zone.contextLine(zone)}
            {zone.elevation_ft != null
              ? ` · ${en.zone.elevation(zone.elevation_ft)}`
              : ''}
            {zone.county ? ` · ${zone.county} County` : ''}
          </p>
        ) : null}

        <div className="hero__controls">
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

          <label className="hero__search">
            <span className="hero__search-label">{en.filters.search}</span>
            <input
              id="crop-search"
              type="search"
              name="search"
              className="hero__search-input"
              value={searchQ}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={en.filters.searchPlaceholder}
              autoComplete="off"
              data-testid="filter-search"
              aria-label={en.filters.search}
            />
          </label>
        </div>

        {data ? (
          <div className="hero__meta mono" data-testid="hero-meta">
            <span>
              {en.hero.asOf} <strong>{data.date}</strong>
            </span>
            <span className="hero__meta-sep" aria-hidden="true">
              ·
            </span>
            <span>
              {en.hero.halfMonth} <strong>{data.half_month_label}</strong>
            </span>
            <span className="hero__meta-sep" aria-hidden="true">
              ·
            </span>
            <span data-testid="hero-count">{en.hero.count(data.items.length)}</span>
            {/* Zone name is display:none under 640px; omit trailing separator so we
                never paint a dangling "7 crops ·" with nothing after it. */}
            {data.zone ? (
              <span className="hero__meta-zone" data-testid="hero-zone-name">
                <span className="hero__meta-sep" aria-hidden="true">
                  ·
                </span>
                {data.zone.name}
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="hero__source-note mono" data-testid="hero-source-note">
          {en.hero.sourceNote}
        </p>

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
  const granularity = item.windows[0]?.source_granularity;

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
      {granularity === 'month' ? (
        <p className="plant-card__granularity mono" data-testid="source-granularity">
          {en.detail.granularityMonth}
        </p>
      ) : null}
      <Link className="plant-card__detail" to={`/crop/${item.crop.id}`}>
        {en.hero.viewCrop}
      </Link>
    </article>
  );
}
