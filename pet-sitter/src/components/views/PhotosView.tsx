import { Link } from 'react-router-dom';
import { en } from '../../i18n/en';
import { AvailabilityRange } from '../AvailabilityRange';
import { PetTypePills } from '../PetTypePills';
import { SitterAvatar } from '../SitterAvatar';
import { SitterRating } from '../SitterRating';
import { ResultsStatus } from './ResultsStatus';
import type { MarketplaceLayoutProps } from './sharedProps';
import { ViewSwitch } from './ViewSwitch';

const PET_FILTERS = [
  { id: 'all', labelKey: 'allPets' as const, value: '' },
  { id: 'dogs', labelKey: 'dogs' as const, value: 'dogs' },
  { id: 'cats', labelKey: 'cats' as const, value: 'cats' },
  { id: 'small', labelKey: 'smallMammals' as const, value: 'small mammals' }
];

/**
 * Photos layout (option A): search capsule owns the fold, then full-bleed photo cards.
 * Indigo Porch tokens, 20px radii, price-on-photo badges.
 *
 * @param props - Shared marketplace controller props.
 */
export function PhotosView(props: MarketplaceLayoutProps): JSX.Element {
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

  return (
    <div className="layout-photos" data-layout="photos">
      <section className="photos-hero" data-measure="hero">
        <h1 className="photos-hero__title">{en.views.photosHeroTitle}</h1>
        <p className="photos-hero__lead">{en.views.photosHeroLead}</p>
        <form
          className="search-capsule"
          role="search"
          onSubmit={onSearchSubmit}
          data-testid={formTestId}
          aria-label={en.home.searchLabel}
        >
          <div className="search-capsule__fields">
            <label className="search-capsule__field" htmlFor={inputId}>
              <span className="search-capsule__label">{en.views.whereLabel}</span>
              <input
                id={inputId}
                type="search"
                name="q"
                className="search-capsule__input"
                placeholder={en.home.searchPlaceholder}
                value={draftQ}
                onChange={(e) => onQueryChange(e.target.value)}
                autoComplete="off"
                data-testid="filter-search"
                aria-label={en.home.searchLabel}
              />
            </label>
            <label className="search-capsule__field">
              <span className="search-capsule__label">{en.views.checkIn}</span>
              <input
                type="date"
                name="from"
                className="search-capsule__input"
                value={state.from}
                onChange={(e) => writeState({ from: e.target.value })}
                data-testid="filter-from-capsule"
              />
            </label>
            <label className="search-capsule__field">
              <span className="search-capsule__label">{en.views.checkOut}</span>
              <input
                type="date"
                name="to"
                className="search-capsule__input"
                value={state.to}
                onChange={(e) => writeState({ to: e.target.value })}
                data-testid="filter-to-capsule"
              />
            </label>
            <button type="submit" className="search-capsule__go" aria-label={en.home.searchSubmit}>
              <span className="search-capsule__go-full">{en.home.searchSubmit}</span>
              <span className="search-capsule__go-short" aria-hidden="true">
                {en.home.searchGo}
              </span>
            </button>
          </div>
        </form>
      </section>

      <div className="filter-chips" role="toolbar" aria-label={en.views.petFilters}>
        {PET_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className="filter-chip"
            aria-pressed={state.petType === filter.value}
            onClick={() => writeState({ petType: filter.value })}
            data-testid={`filter-pet-${filter.id}`}
          >
            {en.views[filter.labelKey]}
          </button>
        ))}
      </div>

      <div className="results-toolbar">
        <p className="result-meta" data-testid="result-count" role="status" aria-live="polite">
          {countLabel}
        </p>
        <ViewSwitch view={state.view} onChange={onViewChange} />
      </div>

      <ResultsStatus status={status} error={error} resultCount={sitters.length} />

      {status === 'ready' && sitters.length > 0 ? (
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
                  <AvailabilityRange
                    availableFrom={s.available_from}
                    availableTo={s.available_to}
                    className="photo-card__avail"
                    withLabel
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
