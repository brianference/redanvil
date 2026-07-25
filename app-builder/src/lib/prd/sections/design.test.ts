import { describe, it, expect } from 'vitest';
import {
  buildDesignDirection,
  chooseDesignDirection,
  LAYOUT_ARCHETYPES,
  VISUAL_DIRECTIONS
} from './design';

/**
 * These tests exist because "the apps all look the same" is not something the
 * rubric can catch: every generated app satisfied every design constraint and
 * still shipped the same centred column, because the constraints were the only
 * design input and they are identical for everyone.
 */
describe('design direction', () => {
  const seeds = [
    'a field service app where techs log jobs offline|mobile|jobs, techs',
    'a B2B invoice tracker with Stripe status|dashboard|invoices, customers',
    'a parent coach app with daily prompts|mobile|prompts, children',
    'a marketplace for local makers|marketplace|listings, makers',
    'simple status page for uptime|dashboard|services',
    'a shift scheduling app for small teams|dashboard|shifts, staff',
    'an app to remind you when your plants need water|mobile|plants',
    'a reading list with highlights and tags|mobile|books, highlights'
  ];

  it('is deterministic — a spec that changes on regeneration is not a spec', () => {
    for (const seed of seeds) {
      expect(chooseDesignDirection(seed)).toEqual(chooseDesignDirection(seed));
      expect(buildDesignDirection(seed)).toBe(buildDesignDirection(seed));
    }
  });

  it('gives materially different apps materially different shells', () => {
    const layouts = new Set(seeds.map((s) => chooseDesignDirection(s).archetype.name));
    // The whole point is variation. If eight distinct products collapse onto one
    // or two shells, this module is decoration.
    expect(layouts.size).toBeGreaterThanOrEqual(4);
  });

  it('varies the visual direction independently of the layout', () => {
    const pairs = seeds.map((s) => {
      const d = chooseDesignDirection(s);
      return `${d.archetype.name}::${d.visual.name}`;
    });
    expect(new Set(pairs).size).toBeGreaterThanOrEqual(6);
    // A layout must not be welded to one visual style across every app.
    const byLayout = new Map<string, Set<string>>();
    for (const s of [...seeds, ...seeds.map((x) => `${x} v2`)]) {
      const d = chooseDesignDirection(s);
      const set = byLayout.get(d.archetype.name) ?? new Set<string>();
      set.add(d.visual.name);
      byLayout.set(d.archetype.name, set);
    }
    expect([...byLayout.values()].some((v) => v.size > 1)).toBe(true);
  });

  it('names the shells it must not fall back to', () => {
    const d = chooseDesignDirection(seeds[0] as string);
    expect(d.rejected.length).toBeGreaterThanOrEqual(3);
    expect(d.rejected).not.toContain(d.archetype.name);
  });

  it('renders the chosen archetype and forbids copying RedAnvil', () => {
    const seed = seeds[1] as string;
    const md = buildDesignDirection(seed);
    const chosen = chooseDesignDirection(seed);
    expect(md).toContain(chosen.archetype.name);
    expect(md).toContain(chosen.visual.name);
    expect(md).toMatch(/Do not copy RedAnvil/);
    expect(md).toMatch(/three.{0,20}real references/i);
    // It must still defer to the constraints rather than replace them.
    expect(md).toMatch(/axe-core/);
    expect(md).toMatch(/44px/);
  });

  it('every archetype and direction is reachable and fully specified', () => {
    for (const a of LAYOUT_ARCHETYPES) {
      expect(a.name.length).toBeGreaterThan(2);
      expect(a.desktop.length).toBeGreaterThan(3);
      expect(a.mobile.length).toBeGreaterThan(20);
      expect(a.suits.length).toBeGreaterThan(10);
    }
    for (const v of VISUAL_DIRECTIONS) {
      expect(v.type.length).toBeGreaterThan(10);
      expect(v.shape.length).toBeGreaterThan(10);
      expect(v.density.length).toBeGreaterThan(10);
      expect(v.colour.length).toBeGreaterThan(10);
    }
    // Sweep enough seeds to prove no entry is unreachable dead weight.
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(chooseDesignDirection(`seed-${i}`).archetype.name);
    expect(seen.size).toBe(LAYOUT_ARCHETYPES.length);
  });
});
