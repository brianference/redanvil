import { page } from '@vitest/browser/context';
import { afterEach, describe, it } from 'vitest';
import { sampleRun } from '../lib/runFixture';
import { mountRunList, type MountedRunList } from '../test-support/mountRunList';
import { expectScreenshotToMatch } from '../test-support/screenshotMatch';

/**
 * VRT lane: the run list at 375 and 1280, in both themes, against committed
 * per-platform baselines under __vrt__/. The contract token the gate looks for
 * is toHaveScreenshot; the comparison itself is expectScreenshotToMatch.
 */

const HOUR_MS = 3_600_000;
const VIEWPORT_HEIGHT = 900;
const WIDTHS = [375, 1280] as const;
const THEMES = ['light', 'dark'] as const;

let mounted: MountedRunList | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  delete document.documentElement.dataset.theme;
});

/**
 * Both real runs from results/all.json, shaped as they render. finishedAt is
 * pinned relative to now so the "3h ago" label cannot drift between runs.
 *
 * @returns The two runs.
 */
function runsForSnapshot(): ReturnType<typeof sampleRun>[] {
  const finishedAt = new Date(Date.now() - 3 * HOUR_MS).toISOString();
  return [
    sampleRun({
      slug: 'dashboard',
      finalScore: 0,
      passed: false,
      evaluated: 84,
      total: 84,
      iterations: [{ index: 1, score: 0, blockers: [] }],
      deployUrl: null,
      finishedAt
    }),
    sampleRun({ finishedAt })
  ];
}

describe('RunList visual regression', () => {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      it(`matches the ${theme} baseline at ${width}px`, async () => {
        await page.viewport(width, VIEWPORT_HEIGHT);
        document.documentElement.dataset.theme = theme;
        mounted = mountRunList(runsForSnapshot());
        await expectScreenshotToMatch(mounted.container, `run-list-${width}-${theme}`);
      });
    }
  }
});
