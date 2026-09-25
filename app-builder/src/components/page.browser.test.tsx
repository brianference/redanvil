/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the page shell's header navigation and breadcrumbs, queried by
 * role and accessible name in a real DOM.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { page } from '@vitest/browser/context';
import { Page } from './Page';
import { en } from '../i18n/en';
import { mount, type Mounted } from '../testing/render';

/** Desktop width, where the header shows its primary links inline. */
const DESKTOP_WIDTH = 1280;
const FRAME_HEIGHT = 900;

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/**
 * Mount a page at `route` on a desktop viewport.
 *
 * @param route - Router location.
 * @param breadcrumb - Breadcrumb label, when the page has one.
 */
async function openPage(route: string, breadcrumb?: string): Promise<void> {
  await page.viewport(DESKTOP_WIDTH, FRAME_HEIGHT);
  mounted = mount(
    <Page title="Test page" breadcrumb={breadcrumb}>
      <span>body</span>
    </Page>,
    { route }
  );
}

describe('page shell (real browser)', () => {
  it('puts every primary link in the header navigation landmark', async () => {
    await openPage('/');
    const nav = page.getByRole('banner').getByRole('navigation', { name: en.app.primaryNav });
    for (const label of [en.app.navBuilder, en.app.navDashboard, en.app.navSaved, en.app.navAbout, en.app.navContact]) {
      await expect.element(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });

  it('marks only the current route as the current page', async () => {
    await openPage('/about');
    const nav = page.getByRole('banner').getByRole('navigation', { name: en.app.primaryNav });
    await expect.element(nav.getByRole('link', { name: en.app.navAbout, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect.element(nav.getByRole('link', { name: en.app.navBuilder, exact: true })).not.toHaveAttribute('aria-current');
  });

  it('links an inner page back home through its breadcrumb trail', async () => {
    await openPage('/saved', en.pages.saved.title);
    const trail = page.getByRole('navigation', { name: en.app.breadcrumbNav });
    await expect.element(trail.getByRole('link', { name: en.app.breadcrumbHome })).toHaveAttribute('href', '/');
    await expect.element(trail.getByText(en.pages.saved.title)).toBeVisible();
  });
});
