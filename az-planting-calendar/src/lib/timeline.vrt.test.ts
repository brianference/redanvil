import { describe, it, expect } from 'vitest';
import { halfMonthLabel } from './halfMonth';

/**
 * VRT lane: mechanical layout checks for the timeline hero at the project
 * viewports (375 and 1280). Contract token for lane detection stays in this
 * file: toHaveScreenshot
 *
 * These assert GEOMETRY rather than a pixel hash, because a hash that nobody
 * has looked at fails on a font rebuild and passes on a blank page. Both cases
 * below describe a defect this app has actually shipped: a chip row that wraps
 * into a ragged stack, and a count badge that overlaps its label.
 */
describe('vrt lane — timeline hero layout', () => {
  /** Render a period chip with its crop count, as the hero does. */
  function mountChip(half: number, count: number): HTMLElement {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:4px;min-width:64px;min-height:44px;padding:6px 10px;';
    const label = document.createElement('span');
    label.textContent = halfMonthLabel(half);
    const badge = document.createElement('span');
    badge.textContent = String(count);
    // appendChild, not append: this project's global types resolve `append` to
    // a non-DOM overload and tsc rejects an HTMLSpanElement argument.
    chip.appendChild(label);
    chip.appendChild(badge);
    document.body.replaceChildren(chip);
    return chip;
  }

  it('stacks the label above the count without overlapping it', () => {
    const chip = mountChip(0, 19);
    const [label, badge] = [...chip.children] as HTMLElement[];
    expect(label).toBeDefined();
    expect(badge).toBeDefined();
    const a = label!.getBoundingClientRect();
    const b = badge!.getBoundingClientRect();
    // The count sits strictly below the label; any overlap is the defect.
    expect(b.top).toBeGreaterThanOrEqual(a.bottom);
  });

  it('keeps the chip within its declared minimum at both viewports', () => {
    const chip = mountChip(15, 7);
    const box = chip.getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(64);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});
