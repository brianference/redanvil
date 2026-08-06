import { Link } from 'react-router-dom';
import type { SitterSummary } from '../../lib/api';
import { en } from '../../i18n/en';
import { PetTypePills } from '../PetTypePills';
import { SitterAvatar } from '../SitterAvatar';
import { SitterRating } from '../SitterRating';

export interface DatesViewProps {
  sitters: SitterSummary[];
  /** Check-in ISO date (shared filter). */
  from: string;
  /** Check-out ISO date (shared filter). */
  to: string;
  /** Update shared date range. */
  onRangeChange: (from: string, to: string) => void;
}

/**
 * Build a simple half-month calendar grid for the given month.
 *
 * @param year - Full year.
 * @param month - 0-based month.
 */
function buildMonthCells(year: number, month: number): Array<{ day: number; muted: boolean; iso: string }> {
  const first = new Date(year, month, 1);
  const startPad = first.getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: Array<{ day: number; muted: boolean; iso: string }> = [];

  for (let i = 0; i < startPad; i += 1) {
    const day = prevDays - startPad + i + 1;
    const d = new Date(year, month - 1, day);
    cells.push({ day, muted: true, iso: toIso(d) });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    cells.push({ day, muted: false, iso: toIso(d) });
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - (startPad + daysInMonth) + 1;
    const d = new Date(year, month + 1, day);
    cells.push({ day, muted: true, iso: toIso(d) });
  }
  // Cap at ~5 weeks for compact hero
  return cells.slice(0, 35);
}

/**
 * @param d - Local date.
 */
function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Week availability strip from sitter available_from/to (real seed dates).
 *
 * @param sitter - Row with availability bounds.
 * @param anchor - First day of the 14-day strip.
 */
function weekBarSlots(sitter: SitterSummary, anchor: Date): boolean[] {
  const slots: boolean[] = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    const iso = toIso(d);
    const open =
      (!sitter.available_from || iso >= sitter.available_from) &&
      (!sitter.available_to || iso <= sitter.available_to);
    slots.push(open);
  }
  return slots;
}

/**
 * Option C presentation: calendar hero + timeline rows with availability bars.
 *
 * @param props - Filtered list and shared date controls.
 */
export function DatesView({ sitters, from, to, onRangeChange }: DatesViewProps): JSX.Element {
  const base = from ? new Date(`${from}T12:00:00`) : new Date(2026, 7, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const cells = buildMonthCells(year, month);
  const monthLabel = base.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
  const stripAnchor = new Date(year, month, 1);
  const dows = en.views.dowLabels;

  /**
   * @param iso - Day clicked on the calendar.
   */
  function onDayClick(iso: string): void {
    if (!from || (from && to)) {
      onRangeChange(iso, '');
      return;
    }
    if (iso < from) {
      onRangeChange(iso, from);
      return;
    }
    onRangeChange(from, iso);
  }

  return (
    <div className="dates-view" data-testid="search-results" data-view="dates">
      <section className="dates-hero" aria-label={en.views.calendarAria}>
        <h2 className="dates-hero__title">{en.views.datesTitle}</h2>
        <p className="dates-hero__lead">{en.views.datesLead}</p>
        <div className="dates-range">
          <label className="dates-range__field">
            {en.views.checkIn}
            <input
              type="date"
              value={from}
              onChange={(e) => onRangeChange(e.target.value, to)}
              data-testid="filter-from"
            />
          </label>
          <label className="dates-range__field">
            {en.views.checkOut}
            <input
              type="date"
              value={to}
              onChange={(e) => onRangeChange(from, e.target.value)}
              data-testid="filter-to"
            />
          </label>
        </div>
        <div className="dates-month">
          <div className="dates-month__title">{monthLabel}</div>
          <div className="cal-grid" role="grid" aria-label={monthLabel}>
            {dows.map((d) => (
              <div key={d} className="cal-dow" role="columnheader">
                {d}
              </div>
            ))}
            {cells.map((cell) => {
              const inRange =
                from && to && cell.iso >= from && cell.iso <= to
                  ? true
                  : from && !to && cell.iso === from;
              const isStart = from && cell.iso === from;
              const isEnd = to && cell.iso === to;
              const hasSitters = sitters.some(
                (s) =>
                  (!s.available_from || cell.iso >= s.available_from) &&
                  (!s.available_to || cell.iso <= s.available_to)
              );
              const cls = [
                'cal-day',
                cell.muted ? 'cal-day--muted' : '',
                inRange ? 'cal-day--in-range' : '',
                isStart ? 'cal-day--start' : '',
                isEnd ? 'cal-day--end' : '',
                hasSitters ? 'cal-day--has-sitters' : ''
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={`${cell.iso}-${cell.muted ? 'm' : 'd'}`}
                  type="button"
                  className={cls}
                  onClick={() => onDayClick(cell.iso)}
                  disabled={cell.muted}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <div className="dates-timeline">
        <div className="dates-timeline__meta">
          <span>
            <strong>{sitters.length}</strong> {en.home.resultCountLabel}
          </span>
          <span>{en.views.timelineHint}</span>
        </div>
        <ul className="timeline">
          {sitters.map((s) => {
            const slots = weekBarSlots(s, stripAnchor);
            return (
              <li key={s.id}>
                <Link to={`/sitters/${s.id}`} className="timeline-row" data-testid="sitter-list-item">
                  <SitterAvatar sitterId={s.id} name={s.name} className="timeline-row__avatar" />
                  <div className="timeline-row__body">
                    <h3 className="timeline-row__name">{s.name}</h3>
                    <p className="timeline-row__hood">{s.neighbourhood}</p>
                    <SitterRating avgRating={s.avg_rating} reviewCount={s.verified_reviews} />
                    <PetTypePills petTypes={s.pet_types} />
                    <div
                      className="week-bar"
                      aria-label={
                        s.available_from && s.available_to
                          ? `${en.detail.availability}: ${s.available_from} → ${s.available_to}`
                          : en.detail.availability
                      }
                    >
                      {slots.map((open, i) => (
                        <span
                          key={i}
                          className={open ? 'week-bar__slot week-bar__slot--open' : 'week-bar__slot'}
                        />
                      ))}
                    </div>
                    <div className="timeline-row__foot">
                      <span className="timeline-row__price">
                        ${s.rate_per_night}
                        <span>{en.home.perNight}</span>
                      </span>
                      {s.available_from && s.available_to ? (
                        <span className="timeline-row__avail">
                          {s.available_from} → {s.available_to}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
