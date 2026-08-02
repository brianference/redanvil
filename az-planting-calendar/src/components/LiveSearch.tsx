import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from 'react';
import { useNavigate } from 'react-router-dom';
import { CropArt } from './CropArt';
import { en } from '../i18n/en';
import type { CropListItem } from '../lib/schemas';
import './LiveSearch.css';

/** Max suggestion rows shown in the combobox listbox. */
const SUGGESTION_CAP = 8;

export interface LiveSearchProps {
  value: string;
  onChange: (q: string) => void;
  /** Debounced search results (null when query empty). */
  results: CropListItem[] | null;
  /** True while a search request is in flight. */
  searching: boolean;
  /** Distinct fail-closed error; never painted as zero matches. */
  searchError: string | null;
  onRetry: () => void;
  /**
   * When true, render as a compact bar slot (no independent sticky chrome).
   * Used inside CompactHeader (option 3).
   */
  embedded?: boolean;
}

/**
 * Crop search: combobox typeahead, labelled Search button, form Enter.
 * Suggestions use /api/crops?q= (via parent). Choosing one goes to crop detail.
 * Button and Enter (without a highlighted option) reach the same search state.
 */
export function LiveSearch({
  value,
  onChange,
  results,
  searching,
  searchError,
  onRetry,
  embedded = false
}: LiveSearchProps) {
  const navigate = useNavigate();
  const listboxId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  /** Index into the visible suggestion slice; -1 means none highlighted. */
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listOpen, setListOpen] = useState(false);

  const trimmed = value.trim();
  const showPanel = trimmed.length > 0;
  const matchCount = results?.length ?? 0;
  const suggestions = results?.slice(0, SUGGESTION_CAP) ?? [];
  const hiddenCount = Math.max(0, matchCount - suggestions.length);
  const expanded =
    listOpen && showPanel && !searchError && results !== null && suggestions.length > 0;
  const activeOptionId =
    expanded && activeIndex >= 0 && activeIndex < suggestions.length
      ? `${listboxId}-opt-${activeIndex}`
      : undefined;

  /**
   * Navigate to a crop detail page and close the list.
   *
   * @param cropId - Crop id for the route.
   */
  function selectCrop(cropId: string): void {
    setListOpen(false);
    setActiveIndex(-1);
    void navigate(`/crop/${cropId}`);
  }

  /**
   * Commit the search (same path for the Search button and form Enter).
   * Keeps live results + grid filter; focuses the status count when present.
   */
  function commitSearch(): void {
    setListOpen(true);
    setActiveIndex(-1);
    // Parent already debounces /api/crops; ensure the input value is current.
    onChange(value);
    const countEl = document.getElementById('search-result-count');
    countEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /**
   * Form submit: highlighted suggestion wins; otherwise run search.
   *
   * @param event - Form submit event.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (expanded && activeIndex >= 0) {
      const crop = suggestions[activeIndex];
      if (crop) {
        selectCrop(crop.id);
        return;
      }
    }
    commitSearch();
  }

  /**
   * Combobox keyboard: arrows move highlight, Enter selects or submits, Escape closes.
   *
   * @param event - Key event from the input.
   */
  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!showPanel || searchError) return;

    if (event.key === 'ArrowDown') {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setListOpen(true);
      setActiveIndex((i) => {
        if (i < 0) return 0;
        return Math.min(i + 1, suggestions.length - 1);
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setListOpen(true);
      setActiveIndex((i) => {
        if (i <= 0) return suggestions.length - 1;
        return i - 1;
      });
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setListOpen(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
      return;
    }

    if (event.key === 'Home' && expanded && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === 'End' && expanded && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex(suggestions.length - 1);
    }
  }

  /**
   * Update query text; reopen list and clear highlight.
   *
   * @param next - New input value.
   */
  function handleChange(next: string): void {
    onChange(next);
    setListOpen(true);
    setActiveIndex(-1);
  }

  const rootClass = embedded ? 'live-search live-search--embedded' : 'live-search';

  return (
    <div className={rootClass} data-testid="live-search">
      <form
        className="live-search__bar"
        onSubmit={handleSubmit}
        role="search"
        data-testid="search-form"
      >
        <label className="live-search__field" htmlFor={inputId}>
          <span className="live-search__label">{en.filters.search}</span>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            name="search"
            className="live-search__input"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onFocus={() => {
              if (trimmed) setListOpen(true);
            }}
            onBlur={(event) => {
              // Keep the list open when focus moves to the Search button (or other
              // form control). Closing on that blur raced commitSearch and hid
              // results after a successful submit.
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.form?.contains(next)) {
                return;
              }
              // Delay so option mousedown can fire before the list unmounts.
              window.setTimeout(() => setListOpen(false), 150);
            }}
            placeholder={en.filters.searchPlaceholder}
            autoComplete="off"
            data-testid="filter-search"
            role="combobox"
            aria-label={en.filters.search}
            aria-expanded={expanded}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-describedby={showPanel ? 'search-result-count' : undefined}
          />
        </label>
        <button
          type="submit"
          className="live-search__submit"
          data-testid="search-submit"
        >
          {en.filters.searchButton}
        </button>
      </form>

      {showPanel ? (
        <div className="live-search__results" data-testid="search-results">
          {searchError ? (
            <div
              className="live-search__error"
              role="alert"
              data-testid="search-live-error"
            >
              <p>{en.filters.searchError}</p>
              <p className="mono">{searchError}</p>
              <button
                type="button"
                className="live-search__retry"
                onClick={onRetry}
                data-testid="search-live-retry"
              >
                {en.filters.searchRetry}
              </button>
            </div>
          ) : null}

          {!searchError && searching && results === null ? (
            <p className="live-search__status" role="status" data-testid="search-live-loading">
              {en.filters.searching}
            </p>
          ) : null}

          {!searchError && results !== null ? (
            <>
              <p
                id="search-result-count"
                className="live-search__count mono"
                data-testid="search-result-count"
                role="status"
              >
                {matchCount === 0
                  ? en.filters.searchEmpty(trimmed)
                  : en.filters.searchCount(matchCount, trimmed)}
              </p>
              {matchCount === 0 ? (
                <p className="live-search__empty" data-testid="search-live-empty">
                  {en.filters.searchEmptyHint}
                </p>
              ) : null}

              {/*
                List stays open while listOpen (typing / focus / submit).
                Escape sets listOpen false so the popup closes; the count above remains.
              */}
              {matchCount > 0 && listOpen ? (
                <>
                  <ul
                    id={listboxId}
                    className="live-search__list"
                    role="listbox"
                    aria-label={en.filters.searchSuggestions}
                    data-testid="search-result-list"
                    data-suggestions-open={expanded ? 'true' : 'false'}
                  >
                    {suggestions.map((crop, index) => {
                      const optionId = `${listboxId}-opt-${index}`;
                      const isActive = index === activeIndex;
                      return (
                        <li key={crop.id} role="presentation">
                          <button
                            type="button"
                            id={optionId}
                            role="option"
                            aria-selected={isActive}
                            className={[
                              'live-search__item',
                              isActive ? 'live-search__item--active' : ''
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            data-testid="search-result-item"
                            data-crop-id={crop.id}
                            onMouseDown={(e) => {
                              // Prevent input blur from closing before click.
                              e.preventDefault();
                            }}
                            onClick={() => selectCrop(crop.id)}
                            onMouseEnter={() => setActiveIndex(index)}
                          >
                            <CropArt
                              cropId={crop.id}
                              alt=""
                              size="thumb"
                              priority={index < 4}
                            />
                            <span className="live-search__item-name">{crop.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {hiddenCount > 0 ? (
                    <p className="live-search__more mono" data-testid="search-more">
                      {en.filters.searchMore(hiddenCount)}
                    </p>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
