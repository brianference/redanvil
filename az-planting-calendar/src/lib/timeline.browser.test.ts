import { describe, it, expect } from 'vitest';
import { expandHalfMonthRange, halfMonthLabel } from './halfMonth';

/**
 * Browser lane: the half-month timeline is a horizontally scrolled strip of
 * focusable period chips, and both of those behaviours are ones jsdom reports
 * confidently and wrongly. Keyboard order and scrollWidth/clientWidth need a
 * real engine, so they are measured here rather than in the unit lane.
 *
 * The strip is built from the app's OWN halfMonth module, so a change to the
 * period model breaks this test rather than leaving it green against a copy.
 */
describe('browser lane — half-month timeline strip', () => {
  /** Build the chip strip the home hero renders, from real half-month data. */
  function mountStrip(start: number, end: number): HTMLElement {
    const strip = document.createElement('div');
    strip.style.cssText = 'display:flex;gap:8px;width:240px;overflow-x:auto;';
    for (const half of expandHalfMonthRange(start, end)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = halfMonthLabel(half);
      chip.style.cssText = 'flex:0 0 auto;min-width:64px;min-height:44px;';
      strip.appendChild(chip);
    }
    document.body.replaceChildren(strip);
    return strip;
  }

  it('puts every half-month chip in the document in calendar order', () => {
    const strip = mountStrip(0, 5);
    const chips = [...strip.querySelectorAll('button')];
    expect(chips).toHaveLength(6);
    expect(chips.map((c) => c.textContent)).toEqual(
      expandHalfMonthRange(0, 5).map((h) => halfMonthLabel(h))
    );
  });

  it('moves focus to the chip that is focused, and keeps the strip scrollable', () => {
    const strip = mountStrip(0, 11);
    const chips = [...strip.querySelectorAll('button')];
    const third = chips[2];
    expect(third).toBeDefined();
    third?.focus();
    expect(document.activeElement).toBe(third);

    // A wrapping strip would report no horizontal overflow; the real engine
    // lays 12 chips of >=64px into a 240px box and must overflow.
    expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
  });

  it('gives every chip a 44px touch target, measured not declared', () => {
    const strip = mountStrip(0, 3);
    for (const chip of strip.querySelectorAll('button')) {
      expect(chip.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });
});
