import { Link } from 'react-router-dom';
import type { SitterSummary } from '../../lib/api';
import { en } from '../../i18n/en';
import { PetTypePills } from '../PetTypePills';
import { SitterAvatar } from '../SitterAvatar';
import { SitterRating } from '../SitterRating';

export interface PhotosViewProps {
  sitters: SitterSummary[];
}

/**
 * Option A presentation: full-bleed photo cards with price badges.
 *
 * @param props - Filtered sitter list (shared dataset).
 */
export function PhotosView({ sitters }: PhotosViewProps): JSX.Element {
  return (
    <ul className="photo-grid" data-testid="search-results" data-view="photos">
      {sitters.map((s) => (
        <li key={s.id} className="photo-card" data-testid="sitter-list-item">
          <Link to={`/sitters/${s.id}`} className="photo-card__link">
            <div className="photo-card__media">
              <SitterAvatar sitterId={s.id} name={s.name} className="photo-card__img" />
              <div className="photo-card__price">
                ${s.rate_per_night}
                <span>{en.home.perNight}</span>
              </div>
            </div>
            <div className="photo-card__body">
              <div className="photo-card__top">
                <div>
                  <h2 className="photo-card__name">{s.name}</h2>
                  <p className="photo-card__hood">{s.neighbourhood}</p>
                </div>
                <SitterRating avgRating={s.avg_rating} reviewCount={s.verified_reviews} />
              </div>
              <PetTypePills petTypes={s.pet_types} />
              {s.available_from && s.available_to ? (
                <p className="photo-card__avail">
                  {en.detail.availability}: {s.available_from} → {s.available_to}
                </p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
