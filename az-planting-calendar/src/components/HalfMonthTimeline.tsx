import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { HALF_MONTH_LABELS, HALF_MONTHS_PER_YEAR } from '../lib/halfMonth';
import { en } from '../i18n/en';
import './HalfMonthTimeline.css';

export interface HalfMonthTimelineProps {
  /** Counts of plantable crops per half-month (length 24). */
  counts: readonly number[];
  /** Currently selected half-month (0..23). */
  selected: number;
  /** Half-month index for "today" (marked separately). */
  now: number;
  /**
   * Select a half-month; parent loads plantable for a representative date.
   *
   * @param half - Index 0..23.
   */
  onSelect: (half: number) => void;
  /** When true, show loading state without disabling selection. */
  loading?: boolean;
}

/**
 * Scroll a cell into view inside the timeline scroller only (never the page).
 *
 * @param scroller - Horizontal scroll container.
 * @param cell - Half-month button to bring into view.
 * @param behavior - Scroll behavior.
 */
function scrollCellIntoScroller(
  scroller: HTMLElement,
  cell: HTMLElement,
  behavior: ScrollBehavior = 'smooth'
): void {
  const pad = 8;
  const cellLeft = cell.offsetLeft;
  const cellRight = cellLeft + cell.offsetWidth;
  const viewLeft = scroller.scrollLeft;
  const viewRight = viewLeft + scroller.clientWidth;
  if (cellLeft < viewLeft + pad) {
    scroller.scrollTo({ left: Math.max(0, cellLeft - pad), behavior });
  } else if (cellRight > viewRight - pad) {
    scroller.scrollTo({
      left: cellRight - scroller.clientWidth + pad,
      behavior
    });
  }
}

/**
 * Horizontal half-month timeline hero: count per half-month, current marked.
 * All 24 cells are reachable via container scroll and keyboard arrows.
 * Selecting a half-month is a real control that drives the list below.
 */
export function HalfMonthTimeline({
  counts,
  selected,
  now,
  onSelect,
  loading = false
}: HalfMonthTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  /**
   * Update edge-fade flags from the scroller's scroll position.
   */
  const updateFades = useCallback((): void => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollStart(el.scrollLeft > 2);
    setCanScrollEnd(max > 2 && el.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener('scroll', updateFades, { passive: true });
    const ro = new ResizeObserver(() => updateFades());
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateFades);
      ro.disconnect();
    };
  }, [updateFades, counts]);

  /**
   * Keep the selected half-month inside the scroller on load and when it changes.
   * Uses the container only -- element.scrollIntoView would scroll the page.
   */
  useEffect(() => {
    const scroller = scrollerRef.current;
    const cell = cellRefs.current[selected];
    if (!scroller || !cell) return;
    // Instant on first paint so "now" is visible without hunting.
    scrollCellIntoScroller(scroller, cell, 'auto');
    updateFades();
  }, [selected, updateFades]);

  /**
   * Move focus and selection to a half-month; scroll it into the scroller.
   *
   * @param half - Target index 0..23.
   */
  function focusHalf(half: number): void {
    const clamped = Math.max(0, Math.min(HALF_MONTHS_PER_YEAR - 1, half));
    onSelect(clamped);
    const cell = cellRefs.current[clamped];
    const scroller = scrollerRef.current;
    if (cell) {
      cell.focus();
      if (scroller) scrollCellIntoScroller(scroller, cell, 'smooth');
    }
  }

  /**
   * Keyboard: arrows move between cells; Home/End jump ends.
   *
   * @param event - Key event from a cell button.
   * @param half - Current cell index.
   */
  function handleCellKeyDown(event: KeyboardEvent<HTMLButtonElement>, half: number): void {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusHalf(half + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusHalf(half - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusHalf(0);
        break;
      case 'End':
        event.preventDefault();
        focusHalf(HALF_MONTHS_PER_YEAR - 1);
        break;
      default:
        break;
    }
  }

  return (
    <section
      className="timeline"
      data-testid="half-month-timeline"
      aria-labelledby="timeline-title"
    >
      <div className="timeline__header shell">
        <h1 id="timeline-title" className="timeline__title">
          {en.timeline.title}
        </h1>
        <p className="timeline__lede">{en.timeline.lede}</p>
        {loading ? (
          <p className="timeline__status" role="status">
            {en.timeline.loadingCounts}
          </p>
        ) : null}
      </div>
      <div className="timeline__track" data-testid="timeline-track">
        <div
          className={[
            'timeline__fade',
            'timeline__fade--start',
            canScrollStart ? 'timeline__fade--visible' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
          data-testid="timeline-fade-start"
        />
        <div
          className={[
            'timeline__fade',
            'timeline__fade--end',
            canScrollEnd ? 'timeline__fade--visible' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
          data-testid="timeline-fade-end"
        />
        <div
          ref={scrollerRef}
          className="timeline__scroll"
          role="listbox"
          aria-label={en.timeline.listLabel}
          aria-orientation="horizontal"
          data-testid="timeline-scroll"
        >
          {Array.from({ length: HALF_MONTHS_PER_YEAR }, (_, half) => {
            const count = counts[half] ?? 0;
            const isSelected = half === selected;
            const isNow = half === now;
            return (
              <button
                key={half}
                ref={(node) => {
                  cellRefs.current[half] = node;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                className={[
                  'timeline__half',
                  isSelected ? 'timeline__half--selected' : '',
                  isNow ? 'timeline__half--now' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(half)}
                onKeyDown={(event) => handleCellKeyDown(event, half)}
                data-testid="timeline-half"
                data-half={half}
              >
                <span className="timeline__label mono">{HALF_MONTH_LABELS[half]}</span>
                <span className="timeline__count mono" data-testid="timeline-count">
                  {count}
                </span>
                {isNow ? (
                  <span className="timeline__now-badge mono">{en.timeline.now}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
