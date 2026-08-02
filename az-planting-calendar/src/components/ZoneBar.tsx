import { formatFrostDate } from '../lib/halfMonth';
import { en } from '../i18n/en';
import type { Zone } from '../lib/schemas';
import { ZoneSelector } from './ZoneSelector';
import './ZoneBar.css';

interface ZoneBarProps {
  zone: Zone | null;
}

/**
 * Full-width planning zone bar above search.
 * Frost dates come from the active zone row (D1), never hardcoded mockup values.
 */
export function ZoneBar({ zone }: ZoneBarProps) {
  return (
    <div className="zone-bar" data-testid="zone-bar">
      <div className="zone-bar__inner">
        <ZoneSelector />
        {zone ? (
          <p className="zone-bar__frost mono" data-testid="zone-frost">
            <span>
              {en.zone.lastFrostShort} {formatFrostDate(zone.last_frost)}
            </span>
            <span className="zone-bar__sep" aria-hidden="true">
              ·
            </span>
            <span>
              {en.zone.firstFrostShort} {formatFrostDate(zone.first_frost)}
            </span>
            {zone.elevation_ft != null ? (
              <>
                <span className="zone-bar__sep" aria-hidden="true">
                  ·
                </span>
                <span>{en.zone.elevation(zone.elevation_ft)}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
