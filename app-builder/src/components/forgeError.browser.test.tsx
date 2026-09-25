/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the screen shown when a submitted job produced no PRD.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { ForgeError } from './ForgeError';
import { en } from '../i18n/en';
import { mount, type Mounted } from '../testing/render';

const copy = en.pages.home;

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('ForgeError (real browser)', () => {
  it('names the failure and routes each action to its own handler', async () => {
    const onBack = vi.fn();
    const onReset = vi.fn();
    mounted = mount(
      <ForgeError message="Name at least one entity before building." onBack={onBack} onReset={onReset} />
    );

    const region = page.getByRole('region', { name: copy.forgeErrorLabel });
    await expect.element(region.getByRole('alert')).toHaveTextContent(
      'Name at least one entity before building.'
    );

    await userEvent.click(page.getByRole('button', { name: copy.forgeErrorBack }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();

    await userEvent.click(page.getByRole('button', { name: copy.forgeErrorNew }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
