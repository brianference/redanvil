import { useState } from 'react';
import { Link } from 'react-router-dom';
import { pinForNeighbourhood } from '../../lib/mapPins';
import { en } from '../../i18n/en';
import { AvailabilityRange } from '../AvailabilityRange';
import { PetTypePills } from '../PetTypePills';
import { SitterAvatar } from '../SitterAvatar';
import { SitterRating } from '../SitterRating';
import { CompactSearchField } from './CompactSearchField';
import { ResultsStatus } from './ResultsStatus';
import type { MarketplaceLayoutProps } from './sharedProps';
import { ViewSwitch } from './ViewSwitch';

/**
 * Format a short date chip label from ISO strings.
 *
 * @param from - Check-in ISO date.
 * @param to - Check-out ISO date.
 */
function rangeChipLabel(from: string, to: string): string {
  if (!from && !to) return en.views.flexibleDates;
  if (from && to) {
    const a = new Date(`${from}T12:00:00`);
    const b = new Date(`${to}T12:00:00`);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    return `${fmt(a)}–${fmt(b)}`;
  }
  return from || to;
}

/**
 * Map layout (option B): the map owns the canvas.
 * Results live in a bottom sheet (phone) or side rail (desktop).
 * Sage trust green, soft map wash, avatar pins.
 * No marketing hero — opens on the map.
 *
 * @param props - Shared marketplace controller props.
 */
export function MapView(props: MarketplaceLayoutProps): JSX.Element {
  const {
    sitters,
    state,
    draftQ,
    inputId,
    formTestId,
    status,
    error,
    countLabel,
    onQueryChange,
    onSearchSubmit,
    writeState,
    onViewChange
  } = props;

  const [activeId, setActiveId] = useState<string | null>(sitters[0]?.id ?? null);
  const activeSitter = sitters.find((s) => s.id === activeId) ?? sitters[0] ?? null;

  /**
   * Apply a preset stay window from a date chip.
   *
   * @param from - ISO start.
   * @param to - ISO end.
   */
  function applyRange(from: string, to: string): void {
    writeState({ from, to });
  }

  const hasCustomRange = Boolean(state.from || state.to);

  return (
    <div className="layout-map" data-layout="map">
      <div className="map-stage" data-testid="search-results" data-view="map">
        <div className="map-stage__overlay">
          <CompactSearchField
            inputId={inputId}
            value={draftQ}
            onChange={onQueryChange}
            onSubmit={onSearchSubmit}
            formTestId={formTestId}
            placeholder={en.views.mapSearchPlaceholder}
            submitLabel={en.home.searchGo}
            formClassName="map-search"
            inputClassName="map-search__input"
            buttonClassName="map-search__go"
          />
          <ViewSwitch view={state.view} onChange={onViewChange} />
        </div>

        <div className="map-stage__canvas" role="img" aria-label={en.views.mapAria}>
          <div className="map-stage__grid" aria-hidden="true" />
          {sitters.map((s) => {
            const pos = pinForNeighbourhood(s.neighbourhood);
            const active = s.id === activeId || s.id === activeSitter?.id;
            return (
              <button
                key={s.id}
                type="button"
                className={active ? 'map-pin map-pin--active' : 'map-pin'}
                style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                aria-label={`${s.name} in ${s.neighbourhood}`}
                aria-pressed={active}
                onClick={() => setActiveId(s.id)}
              >
                <SitterAvatar sitterId={s.id} name={s.name} className="map-pin__img" />
              </button>
            );
          })}
        </div>

        <section className="map-sheet" aria-label={en.views.mapResults}>
          <div className="map-sheet__handle" aria-hidden="true" />
          <div className="map-sheet__head">
            <h1 className="map-sheet__title">{countLabel}</h1>
            <p className="map-sheet__sub">{en.views.mapSub}</p>
            <p className="result-meta sr-only" data-testid="result-count" role="status">
              {countLabel}
            </p>
          </div>

          <div className="map-date-row" role="toolbar" aria-label={en.views.stayDates}>
            <button
              type="button"
              className="map-date-chip"
              aria-pressed={state.from === '2026-08-12' && state.to === '2026-08-16'}
              onClick={() => applyRange('2026-08-12', '2026-08-16')}
            >
              {en.views.chipAugRange}
            </button>
            <button
              type="button"
              className="map-date-chip"
              aria-pressed={state.from === '2026-08-08' && state.to === '2026-08-10'}
              onClick={() => applyRange('2026-08-08', '2026-08-10')}
            >
              {en.views.chipWeekend}
            </button>
            <button
              type="button"
              className="map-date-chip"
              aria-pressed={!hasCustomRange}
              onClick={() => applyRange('', '')}
            >
              {en.views.flexibleDates}
            </button>
            {hasCustomRange ? (
              <span className="map-date-chip map-date-chip--readout" aria-live="polite">
                {rangeChipLabel(state.from, state.to)}
              </span>
            ) : null}
          </div>

          <ResultsStatus status={status} error={error} resultCount={sitters.length} />

          {status === 'ready' && sitters.length > 0 ? (
            <ul className="map-rail">
              {sitters.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/sitters/${s.id}`}
                    className={
                      s.id === activeId || s.id === activeSitter?.id
                        ? 'map-rail__row map-rail__row--active'
                        : 'map-rail__row'
                    }
                    data-testid="sitter-list-item"
                    onFocus={() => setActiveId(s.id)}
                    onMouseEnter={() => setActiveId(s.id)}
                  >
                    <SitterAvatar sitterId={s.id} name={s.name} className="map-rail__avatar" />
                    <div className="map-rail__body">
                      <h2 className="map-rail__name">{s.name}</h2>
                      <p className="map-rail__meta">{s.neighbourhood}</p>
                      <SitterRating avgRating={s.avg_rating} reviewCount={s.verified_reviews} />
                      <PetTypePills petTypes={s.pet_types} />
                      <AvailabilityRange
                        availableFrom={s.available_from}
                        availableTo={s.available_to}
                        className="map-rail__avail"
                      />
                    </div>
                    <div className="map-rail__price">
                      ${s.rate_per_night}
                      <span>{en.home.perNight}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
