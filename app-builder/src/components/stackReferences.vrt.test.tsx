/**
 * VRT lane: the saved-PRD detail components, pixel-compared against committed
 * baselines at 375 and 1280 in both themes.
 *
 * The markdown is the real architecture section every generated PRD carries,
 * so the reference list is the one a reader actually sees on /prd/:id.
 */
import { afterEach, describe, it } from 'vitest';
import { page } from '@vitest/browser/context';
import { buildArchitectureSection } from '../lib/prd/sections/architecture';
import { en } from '../i18n/en';
import { Breadcrumbs } from './Breadcrumbs';
import { StackReferences } from './StackReferences';
import { mount, type Mounted, type ThemeName } from '../testing/render';
import { expectToMatchBaseline } from '../testing/vrt';

const VIEWPORTS = [375, 1280] as const;
const THEMES: readonly ThemeName[] = ['light', 'dark'];
const FRAME_HEIGHT = 900;
/** Matches the page gutter so edges are captured the way the page shows them. */
const GUTTER_PX = 16;

const PRD_MARKDOWN = buildArchitectureSection({
  hasAuth: true,
  dataStorage: 'relational',
  hasRealtime: false,
  integrations: ''
});

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe.each(VIEWPORTS)('saved PRD detail components at %ipx', (width) => {
  it.each(THEMES)('stack references and breadcrumb trail match the %s baseline', async (theme) => {
    await page.viewport(width, FRAME_HEIGHT);
    mounted = mount(
      <div data-testid="vrt-frame" style={{ padding: GUTTER_PX }}>
        <Breadcrumbs current={en.pages.savedPrd.title} />
        <StackReferences markdown={PRD_MARKDOWN} />
      </div>,
      { theme }
    );
    const frame = mounted.container.querySelector('[data-testid="vrt-frame"]');
    if (frame === null) throw new Error('VRT frame did not render');
    await expectToMatchBaseline(frame, `saved-prd-detail-${width}-${theme}`);
  });
});
