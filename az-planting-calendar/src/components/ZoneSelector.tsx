import { useEffect, useId, useMemo, useState } from 'react';
import { en } from '../i18n/en';
import type { Zone } from '../lib/schemas';
import { useZone } from '../hooks/useZone';
import './ZoneSelector.css';

/**
 * Searchable zone control: match by city name, ZIP, or zone id.
 * Selection is persisted via useZone (localStorage).
 */
export function ZoneSelector() {
  const listId = useId();
  const { zone, zones, loading, setZone } = useZone();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (zone && !open) {
      setQuery('');
    }
  }, [zone, open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter(
      (z) =>
        z.name.toLowerCase().includes(q) ||
        z.zip.includes(q) ||
        z.id.toLowerCase().includes(q)
    );
  }, [zones, query]);

  /**
   * Apply a zone from the list.
   *
   * @param next - Selected zone row.
   */
  function pick(next: Zone): void {
    setZone(next);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="zone-selector" data-testid="zone-selector">
      <label className="zone-selector__label" htmlFor={listId}>
        {en.zone.switchLabel}
      </label>
      <div className="zone-selector__controls">
        <input
          id={listId}
          type="search"
          className="zone-selector__input mono"
          value={open || query ? query : zoneLabel(zone)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onBlur={() => {
            // Delay so option mousedown can fire first.
            window.setTimeout(() => setOpen(false), 150);
          }}
          placeholder={en.zone.searchPlaceholder}
          autoComplete="off"
          disabled={loading || zones.length === 0}
          data-testid="zone-search"
          aria-label={en.zone.switchLabel}
        />
        {open ? (
          <ul
            id={`${listId}-list`}
            className="zone-selector__list"
            role="listbox"
            data-testid="zone-list"
          >
            {matches.length === 0 ? (
              <li className="zone-selector__empty" role="option" aria-selected="false">
                {en.zone.noMatch}
              </li>
            ) : (
              matches.map((z) => (
                <li key={z.id} role="presentation">
                  <button
                    type="button"
                    className={
                      zone?.id === z.id
                        ? 'zone-selector__option zone-selector__option--active'
                        : 'zone-selector__option'
                    }
                    role="option"
                    aria-selected={zone?.id === z.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(z)}
                    data-testid="zone-option"
                    data-zone-id={z.id}
                  >
                    <span className="zone-selector__option-name">{z.name}</span>
                    <span className="zone-selector__option-meta mono">
                      {z.zip}
                      {z.elevation_ft != null ? ` · ${z.elevation_ft} ft` : ''}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
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
