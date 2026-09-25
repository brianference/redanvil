/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the mobile drawer's focus contract, in a real Chromium.
 *
 * useDrawerA11y.test.ts proves the key-to-action mapping with stand-in
 * elements. It cannot prove that focus actually lands, that the trap holds
 * against the browser's own Tab order, or that focus returns to the menu
 * button. Those only exist in a real browser, which is what this lane is for.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { Page } from '../Page';
import { en } from '../../i18n/en';
import { mount, type Mounted } from '../../testing/render';

/** Mobile width, where the header collapses its nav behind the menu button. */
const MOBILE_WIDTH = 375;
const FRAME_HEIGHT = 900;

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/**
 * Mount a real inner page and open its drawer from the menu button.
 *
 * @returns The menu button and the drawer's close button.
 */
async function openDrawer(): Promise<{ menuButton: HTMLElement; closeButton: HTMLElement }> {
  await page.viewport(MOBILE_WIDTH, FRAME_HEIGHT);
  mounted = mount(
    <Page title={en.pages.savedPrd.title} breadcrumb={en.pages.savedPrd.title}>
      <p>{en.pages.savedPrd.loading}</p>
    </Page>,
    { route: '/prd/x' }
  );
  // Resolve the element before clicking: once open, the same button is
  // relabelled "Close menu", so the "Open menu" locator no longer matches it.
  const menuLocator = page.getByRole('button', { name: en.app.menuOpen });
  const menuButton = menuLocator.element() as HTMLElement;
  await userEvent.click(menuLocator);
  // Scoped to the drawer: the header button now carries the same name.
  const closeLocator = page
    .getByRole('complementary', { name: en.app.primaryNav })
    .getByRole('button', { name: en.app.menuClose });
  await expect.element(closeLocator).toHaveFocus();
  return { menuButton, closeButton: closeLocator.element() as HTMLElement };
}

describe('mobile drawer focus (real browser)', () => {
  it('moves focus into the drawer when it opens', async () => {
    const { closeButton } = await openDrawer();
    expect(document.activeElement === closeButton).toBe(true);
  });

  it('keeps Tab inside the drawer: it wraps at both ends instead of escaping to the page', async () => {
    const { closeButton } = await openDrawer();
    const drawer = closeButton.closest<HTMLElement>('#ra-side-drawer');
    expect(drawer).not.toBeNull();
    const controls = [...(drawer?.querySelectorAll<HTMLElement>('a[href], button') ?? [])];
    const first = controls[0];
    const last = controls[controls.length - 1];
    expect(controls.length).toBeGreaterThan(2);

    first?.focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement === last).toBe(true);

    await userEvent.keyboard('{Tab}');
    expect(document.activeElement === first).toBe(true);
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    const { menuButton } = await openDrawer();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('button', { name: en.app.menuOpen })).toHaveFocus();
    expect(document.activeElement === menuButton).toBe(true);
  });
});
