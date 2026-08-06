import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SitterSummary } from '../../lib/api';
import { pinForNeighbourhood } from '../../lib/mapPins';
import { en } from '../../i18n/en';
import { PetTypePills } from '../PetTypePills';
import { SitterAvatar } from '../SitterAvatar';
import { SitterRating } from '../SitterRating';

export interface MapViewProps {
  sitters: SitterSummary[];
}

/**
 * Option B presentation: map stage with avatar pins + sheet/rail list.
 *
 * @param props - Filtered sitter list (shared dataset).
 */
export function MapView({ sitters }: MapViewProps): JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(sitters[0]?.id ?? null);

  return (
    <div className="map-stage" data-testid="search-results" data-view="map">
      <div className="map-stage__canvas" role="img" aria-label={en.views.mapAria}>
        <div className="map-stage__grid" aria-hidden="true" />
        {sitters.map((s) => {
          const pos = pinForNeighbourhood(s.neighbourhood);
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              className={active ? 'map-pin map-pin--active' : 'map-pin'}
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
              aria-label={s.name}
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
          <h2 className="map-sheet__title">
            {sitters.length} {en.home.resultCountLabel}
          </h2>
          <p className="map-sheet__sub">{en.views.mapSub}</p>
        </div>
        <ul className="map-rail">
          {sitters.map((s) => (
            <li key={s.id}>
              <Link
                to={`/sitters/${s.id}`}
                className={
                  s.id === activeId ? 'map-rail__row map-rail__row--active' : 'map-rail__row'
                }
                data-testid="sitter-list-item"
                onFocus={() => setActiveId(s.id)}
                onMouseEnter={() => setActiveId(s.id)}
              >
                <SitterAvatar sitterId={s.id} name={s.name} className="map-rail__avatar" />
                <div className="map-rail__body">
                  <h3 className="map-rail__name">{s.name}</h3>
                  <p className="map-rail__meta">{s.neighbourhood}</p>
                  <SitterRating avgRating={s.avg_rating} reviewCount={s.verified_reviews} />
                  <PetTypePills petTypes={s.pet_types} />
                  {s.available_from && s.available_to ? (
                    <p className="map-rail__avail">
                      {s.available_from} → {s.available_to}
                    </p>
                  ) : null}
                </div>
                <div className="map-rail__price">
                  ${s.rate_per_night}
                  <span>{en.home.perNight}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
