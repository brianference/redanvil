/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the page shell's header navigation and breadcrumbs, queried by
 * role and accessible name in a real browser rather than by parsing markup.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { page } from '@vitest/browser/context';
import { Page } from './Page';
import { en } from '../i18n/en';
import { mount, type Mounted } from '../testing/render';

/** Desktop width, where the header shows its nav instead of the menu button. */
const DESKTOP_WIDTH = 1280;
const FRAME_HEIGHT = 900;

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/**
 * Mount a page at a route on a desktop viewport.
 *
 * @param route - Initial location.
 * @param breadcrumb - Breadcrumb label, for inner pages.
 */
async function renderAt(route: string, breadcrumb?: string): Promise<void> {
  await page.viewport(DESKTOP_WIDTH, FRAME_HEIGHT);
  mounted = mount(
    <Page title="Test page" breadcrumb={breadcrumb}>
      <span>body</span>
    </Page>,
    { route }
  );
}

describe('Page shell (real browser)', () => {
  it('puts every primary link inside the header navigation landmark', async () => {
    await renderAt('/');
    const nav = page.getByRole('banner').getByRole('navigation', { name: en.app.primaryNav });
    for (const label of [
      en.app.navBuilder,
      en.app.navDashboard,
      en.app.navSaved,
      en.app.navAbout,
      en.app.navContact
    ]) {
      await expect.element(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });

  it('marks only the current route with aria-current="page"', async () => {
    await renderAt('/about');
    const nav = page.getByRole('banner').getByRole('navigation', { name: en.app.primaryNav });
    await expect
      .element(nav.getByRole('link', { name: en.app.navAbout, exact: true }))
      .toHaveAttribute('aria-current', 'page');
    await expect
      .element(nav.getByRole('link', { name: en.app.navBuilder, exact: true }))
      .not.toHaveAttribute('aria-current');
  });

  it('shows a breadcrumb trail back to home on inner pages', async () => {
    await renderAt('/saved', en.pages.saved.title);
    const trail = page.getByRole('navigation', { name: en.app.breadcrumbNav });
    await expect
      .element(trail.getByRole('link', { name: en.app.breadcrumbHome }))
      .toHaveAttribute('href', '/');
    await expect.element(trail.getByText(en.pages.saved.title)).toBeVisible();
  });
});
