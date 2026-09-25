import { userEvent } from '@vitest/browser/context';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { mount, type Mounted } from '../test-support/mount';
import { ThemeToggle } from './ThemeToggle';

let mounted: Mounted | null = null;

beforeEach(() => {
  localStorage.removeItem('theme');
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  localStorage.removeItem('theme');
  delete document.documentElement.dataset.theme;
});

/**
 * The toggle button, found by the action it currently offers.
 *
 * @param label - Accessible name to look for.
 * @returns The button, or null when no button has that name.
 */
function toggleNamed(label: string): HTMLButtonElement | null {
  return mounted?.container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) ?? null;
}

describe('ThemeToggle in a real browser', () => {
  it('starts light, switches the document to dark and back, and remembers the choice', async () => {
    mounted = mount(createElement(ThemeToggle));
    await expect.poll(() => document.documentElement.dataset.theme).toBe('light');
    await expect.poll(() => toggleNamed(en.app.themeToDark)).not.toBeNull();
    const toDark = toggleNamed(en.app.themeToDark);
    if (toDark === null) throw new Error('toggle does not offer dark on a light first paint');

    await userEvent.click(toDark);
    await expect.poll(() => document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    await expect.poll(() => toggleNamed(en.app.themeToLight)).not.toBeNull();
    const toLight = toggleNamed(en.app.themeToLight);
    if (toLight === null) throw new Error('toggle does not offer light once dark');

    await userEvent.click(toLight);
    await expect.poll(() => document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('restores a stored dark choice on the next mount', async () => {
    localStorage.setItem('theme', 'dark');
    mounted = mount(createElement(ThemeToggle));
    await expect.poll(() => document.documentElement.dataset.theme).toBe('dark');
    // The first render is light until the stored choice is read, so wait for
    // the button to repaint in dark mode (its sun icon) before reading its
    // name; the light first render would otherwise answer for it.
    const button = mounted.container.querySelector('button');
    await expect.poll(() => button?.textContent).toBe('☀');
    expect(button?.getAttribute('aria-label')).toBe(en.app.themeToLight);
  });
});
