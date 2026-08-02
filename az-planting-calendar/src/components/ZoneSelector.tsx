import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react';
import {
  closeListbox,
  nextDownIndex,
  nextUpIndex,
  openListAndClearHighlight,
  useListboxActiveIndex
} from '../hooks/useListboxActiveIndex';
import { en } from '../i18n/en';
import { isStateQuery, matchOutOfCoveragePlace } from '../lib/coverage';
import type { Zone } from '../lib/schemas';
import { useZone } from '../hooks/useZone';
import './ZoneSelector.css';

/**
 * Planning-zone combobox: open to browse all zones, or type to filter by
 * city, ZIP, county, or state. Zero-match states explain Maricopa coverage
 * and keep the full zone list visible for discovery.
 */
export function ZoneSelector() {
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { zone, zones, loading, setZone } = useZone();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  /** Index into the visible option list; -1 means none highlighted. */
  const [activeIndex, setActiveIndex] = useListboxActiveIndex();

  const trimmed = query.trim();
  const matches = useMemo(() => filterZones(zones, trimmed), [zones, trimmed]);
  const zeroMatch = trimmed.length > 0 && matches.length === 0;
  /** When filter misses, still show every zone so the popup is never empty. */
  const visibleZones = zeroMatch ? zones : matches;
  const outsidePlace = zeroMatch ? matchOutOfCoveragePlace(trimmed) : null;
  const expanded = open && zones.length > 0;
  const activeOptionId =
    expanded && activeIndex >= 0 && activeIndex < visibleZones.length
      ? `${listboxId}-opt-${activeIndex}`
      : undefined;

  /**
   * Apply a zone from the list and close the popup.
   *
   * @param next - Selected zone row.
   */
  function pick(next: Zone): void {
    setZone(next);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  }

  /**
   * Combobox keyboard: arrows move highlight, Enter selects, Escape closes.
   * Matches LiveSearch behaviour.
   *
   * @param event - Key event from the input.
   */
  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!expanded || visibleZones.length === 0) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => nextDownIndex(i, visibleZones.length));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => nextUpIndex(i, visibleZones.length));
      return;
    }

    if (event.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < visibleZones.length) {
        event.preventDefault();
        const next = visibleZones[activeIndex];
        if (next) pick(next);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeListbox(setOpen, setActiveIndex, inputRef);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(visibleZones.length - 1);
    }
  }

  /**
   * Update filter text; reopen list and clear highlight.
   *
   * @param next - New input value.
   */
  function handleChange(next: string): void {
    setQuery(next);
    openListAndClearHighlight(setOpen, setActiveIndex);
  }

  const inputDisplay = open || trimmed.length > 0 ? query : zoneLabel(zone);

  return (
    <div className="zone-selector" data-testid="zone-selector">
      <label className="zone-selector__label" htmlFor={inputId}>
        {en.zone.switchLabel}
      </label>
      <p className="zone-selector__coverage mono" data-testid="zone-coverage-hint">
        {en.zone.coverageHint}
      </p>
      <div className="zone-selector__controls">
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          className="zone-selector__input mono"
          value={inputDisplay}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setActiveIndex(-1);
          }}
          onBlur={() => {
            // Delay so option mousedown can fire before the list unmounts.
            window.setTimeout(() => {
              setOpen(false);
              setActiveIndex(-1);
            }, 150);
          }}
          placeholder={en.zone.searchPlaceholder}
          autoComplete="off"
          disabled={loading || zones.length === 0}
          data-testid="zone-search"
          role="combobox"
          aria-label={en.zone.comboboxLabel}
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
        />
        {expanded ? (
          <div
            className="zone-selector__popup"
            data-testid="zone-popup"
            data-zero-match={zeroMatch ? 'true' : 'false'}
          >
            {zeroMatch ? (
              <div
                className="zone-selector__coverage-panel"
                role="status"
                data-testid="zone-no-match"
              >
                <p data-testid="zone-no-match-message">
                  {outsidePlace
                    ? en.zone.noMatchOutside(outsidePlace)
                    : en.zone.noMatch(trimmed)}
                </p>
                <p className="zone-selector__coverage-hint mono">{en.zone.noMatchHint}</p>
              </div>
            ) : null}

            <p className="zone-selector__group-label mono" id={`${listboxId}-group`}>
              {en.zone.groupMaricopa}
            </p>
            <ul
              id={listboxId}
              className="zone-selector__list"
              role="listbox"
              aria-label={en.zone.listLabel}
              aria-labelledby={`${listboxId}-group`}
              data-testid="zone-list"
            >
              {visibleZones.map((z, index) => {
                const optionId = `${listboxId}-opt-${index}`;
                const isActive = index === activeIndex;
                const isSelected = zone?.id === z.id;
                return (
                  <li key={z.id} role="presentation">
                    <button
                      type="button"
                      id={optionId}
                      className={[
                        'zone-selector__option',
                        isSelected ? 'zone-selector__option--selected' : '',
                        isActive ? 'zone-selector__option--active' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      role="option"
                      aria-selected={isSelected || isActive}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(z)}
                      onMouseEnter={() => setActiveIndex(index)}
                      data-testid="zone-option"
                      data-zone-id={z.id}
                    >
                      <span className="zone-selector__option-name">{z.name}</span>
                      <span className="zone-selector__option-meta mono">
                        {z.zip}
                        {z.county ? ` · ${z.county} County` : ''}
                        {z.elevation_ft != null ? ` · ${z.elevation_ft} ft` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Filter zones by city name, ZIP, id, county, or state (case-insensitive partial).
 *
 * @param zones - Full zone list from the API.
 * @param q - Trimmed query (empty returns all).
 */
export function filterZones(zones: Zone[], q: string): Zone[] {
  if (!q) return zones;
  if (isStateQuery(q)) {
    // All current zones are Arizona; keep matching open for future multi-state rows.
    return zones.filter((z) => zoneMatchesState(z, q));
  }
  const lower = q.toLowerCase();
  return zones.filter((z) => {
    if (z.name.toLowerCase().includes(lower)) return true;
    if (z.zip.includes(q)) return true;
    if (z.id.toLowerCase().includes(lower)) return true;
    if (z.county && z.county.toLowerCase().includes(lower)) return true;
    return false;
  });
}

/**
 * State match for AZ / Arizona against zone name (contains "AZ") or future state field.
 *
 * @param zone - Zone row.
 * @param q - State query token.
 */
function zoneMatchesState(zone: Zone, q: string): boolean {
  const token = q.trim().toLowerCase();
  if (token === 'az' || token === 'arizona') {
    return /\bAZ\b/i.test(zone.name) || /arizona/i.test(zone.name);
  }
  return false;
}

/**
 * Compact label for the closed input at narrow widths.
 * Full names like "Cave Creek AZ (low desert, Maricopa County)" truncate inside
 * a 375px search field; show city + ZIP so the value fits without ellipsis.
 *
 * @param zone - Selected zone or null.
 */
function zoneLabel(zone: Zone | null): string {
  if (!zone) return '';
  const short = zone.name.replace(/\s*\(.*?\)\s*/g, '').trim();
  return `${short} ${zone.zip}`.trim();
}
