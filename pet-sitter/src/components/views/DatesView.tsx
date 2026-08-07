import { Link } from 'react-router-dom';
import type { SitterSummary } from '../../lib/api';
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
 * Build a simple half-month calendar grid for the given month.
 *
 * @param year - Full year.
 * @param month - 0-based month.
 */
function buildMonthCells(
  year: number,
  month: number
): Array<{ day: number; muted: boolean; iso: string }> {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
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
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, nextDay);
    cells.push({ day: nextDay, muted: true, iso: toIso(d) });
    nextDay += 1;
  }
  // Full month grid (never drop the last days of the month).
  return cells;
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
 * Dates layout (option C): the calendar owns the fold.
 * Check-in/out + half-month calendar, then timeline rows with availability strips.
 * Indigo Porch tokens; availability bars use --success. No marketing hero above the calendar.
 *
 * @param props - Shared marketplace controller props.
 */
export function DatesView(props: MarketplaceLayoutProps): JSX.Element {
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

  const from = state.from;
  const to = state.to;
  const base = from ? new Date(`${from}T12:00:00`) : new Date(2026, 7, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const cells = buildMonthCells(year, month);
  const monthLabel = base.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
  const stripAnchor = new Date(year, month, 1);
  const dows = en.views.dowLabels;

  /**
   * Shift the visible month while keeping range selection.
   *
   * @param delta - Months to move (−1 or +1).
   */
  function shiftMonth(delta: number): void {
    const next = new Date(year, month + delta, 1);
    const iso = toIso(next);
    // Anchor month via from when no range yet; otherwise keep range and only view month via from if empty
    if (!from && !to) {
      writeState({ from: iso });
    } else if (from) {
      const f = new Date(`${from}T12:00:00`);
      f.setMonth(f.getMonth() + delta);
      const t = to ? new Date(`${to}T12:00:00`) : null;
      if (t) t.setMonth(t.getMonth() + delta);
      writeState({
        from: toIso(f),
        to: t ? toIso(t) : to
      });
    }
  }

  /**
   * @param iso - Day clicked on the calendar.
   */
  function onDayClick(iso: string): void {
    if (!from || (from && to)) {
      writeState({ from: iso, to: '' });
      return;
    }
    if (iso < from) {
      writeState({ from: iso, to: from });
      return;
    }
    writeState({ from, to: iso });
  }

  return (
    <div className="layout-dates" data-layout="dates">
      <div className="dates-view" data-testid="search-results" data-view="dates">
        <section className="dates-hero" aria-label={en.views.calendarAria} data-measure="hero">
          <h1 className="dates-hero__title">{en.views.datesTitle}</h1>
          <p className="dates-hero__lead">{en.views.datesLead}</p>

          <div className="dates-range">
            <label className="dates-range__field">
              {en.views.checkIn}
              <input
                type="date"
                value={from}
                onChange={(e) => writeState({ from: e.target.value })}
                data-testid="filter-from"
              />
            </label>
            <label className="dates-range__field">
              {en.views.checkOut}
              <input
                type="date"
                value={to}
                onChange={(e) => writeState({ to: e.target.value })}
                data-testid="filter-to"
              />
            </label>
          </div>

          <div className="dates-month">
            <div className="dates-month__title">
              <span>{monthLabel}</span>
              <div className="dates-month__nav">
                <button type="button" aria-label={en.views.prevMonth} onClick={() => shiftMonth(-1)}>
                  ‹
                </button>
                <button type="button" aria-label={en.views.nextMonth} onClick={() => shiftMonth(1)}>
                  ›
                </button>
              </div>
            </div>
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
                    : Boolean(from && !to && cell.iso === from);
                const isStart = Boolean(from && cell.iso === from);
                const isEnd = Boolean(to && cell.iso === to);
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

          <CompactSearchField
            inputId={inputId}
            value={draftQ}
            onChange={onQueryChange}
            onSubmit={onSearchSubmit}
            formTestId={formTestId}
            placeholder={en.views.mapSearchPlaceholder}
            submitLabel={en.views.findSitters}
            formClassName="dates-search-inline"
          />
        </section>

        <div className="dates-timeline">
          <div className="dates-timeline__meta">
            <span data-testid="result-count" role="status" aria-live="polite">
              {countLabel}
            </span>
            <ViewSwitch view={state.view} onChange={onViewChange} />
          </div>
          <p className="dates-timeline__hint">{en.views.timelineHint}</p>

          <ResultsStatus status={status} error={error} resultCount={sitters.length} />

          {status === 'ready' && sitters.length > 0 ? (
            <ul className="timeline">
              {sitters.map((s) => {
                const slots = weekBarSlots(s, stripAnchor);
                return (
                  <li key={s.id}>
                    <Link
                      to={`/sitters/${s.id}`}
                      className="timeline-row"
                      data-testid="sitter-list-item"
                    >
                      <SitterAvatar sitterId={s.id} name={s.name} className="timeline-row__avatar" />
                      <div className="timeline-row__body">
                        <h2 className="timeline-row__name">{s.name}</h2>
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
                              className={
                                open ? 'week-bar__slot week-bar__slot--open' : 'week-bar__slot'
                              }
                            />
                          ))}
                        </div>
                        <div className="timeline-row__foot">
                          <span className="timeline-row__price">
                            ${s.rate_per_night}
                            <span>{en.home.perNight}</span>
                          </span>
                          <AvailabilityRange
                            availableFrom={s.available_from}
                            availableTo={s.available_to}
                            className="timeline-row__avail"
                            as="span"
                          />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
