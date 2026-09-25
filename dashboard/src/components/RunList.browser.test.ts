import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import { sampleRun } from '../lib/runFixture';
import { mountRunList, type MountedRunList } from '../test-support/mountRunList';

/**
 * Browser lane: the run card is an `<article tabIndex=0>` with its own
 * Enter/Space handler and nested links. Whether the keyboard really reaches it,
 * in what order, and whether a real key press navigates, only a real browser
 * can answer — the unit lane renders to a string and has no focus at all.
 */

// The dashboard row as results/all.json records it: 0/90, 84/84 rules, 1 iteration, no deploy.
const dashboardRun = sampleRun({
  slug: 'dashboard',
  finalScore: 0,
  passed: false,
  evaluated: 84,
  total: 84,
  iterations: [{ index: 1, score: 0, blockers: [] }],
  deployUrl: null
});

let mounted: MountedRunList | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/**
 * The card for a slug (its accessible name is the slug).
 *
 * @param slug - Run slug.
 * @returns The card element.
 */
function card(slug: string): HTMLElement {
  const el = mounted?.container.querySelector<HTMLElement>(`article[aria-label="${slug}"]`);
  if (el === null || el === undefined) throw new Error(`no card for ${slug}`);
  return el;
}

/** Heading text of the detail probe once the router has navigated. */
function landedOn(): string | null {
  return document.querySelector('h1')?.textContent ?? null;
}

describe('RunList in a real browser', () => {
  it('opens the focused run on Enter', async () => {
    mounted = mountRunList([sampleRun(), dashboardRun]);
    card('dashboard').focus();
    expect(document.activeElement).toBe(card('dashboard'));
    await userEvent.keyboard('{Enter}');
    await expect.poll(landedOn).toBe('detail:dashboard');
  });

  it('opens the focused run on Space', async () => {
    mounted = mountRunList([sampleRun(), dashboardRun]);
    card('app-builder').focus();
    await userEvent.keyboard(' ');
    await expect.poll(landedOn).toBe('detail:app-builder');
  });

  it('opens the run when the card surface, not its link, is clicked', async () => {
    mounted = mountRunList([dashboardRun]);
    const icon = card('dashboard').querySelector('div[aria-hidden="true"]');
    if (icon === null) throw new Error('status icon not rendered');
    await userEvent.click(icon);
    await expect.poll(landedOn).toBe('detail:dashboard');
  });

  it('tabs card -> title link -> deploy link, in that order', async () => {
    mounted = mountRunList([sampleRun()]);
    const before = document.createElement('button');
    before.textContent = 'before';
    mounted.container.prepend(before);
    before.focus();

    await userEvent.tab();
    expect(document.activeElement).toBe(card('app-builder'));
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('href')).toBe('/run/app-builder');
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('href')).toBe('https://redanvil.pages.dev');
  });
});
