/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the result screen Home shows when no PRD could be generated.
 *
 * Home renders this for a generator error (an UnresolvedPrdError message) and
 * for the result view with no PRD at all. Both paths pass a message and the
 * same two recovery actions, which is what this drives.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { ForgeErrorPanel } from './ForgeErrorPanel';
import { en } from '../i18n/en';
import { mount, type Mounted } from '../testing/render';

const copy = en.pages.home;
/** The message generatePrd throws when the wizard's entities do not resolve. */
const UNRESOLVED = 'Unresolved entities: Flight has no fields';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('forge error panel (real browser)', () => {
  it('announces why the PRD failed and returns to the wizard with the answers kept', async () => {
    const onBack = vi.fn();
    const onStartNew = vi.fn();
    mounted = mount(
      <ForgeErrorPanel message={UNRESOLVED} onBack={onBack} onStartNew={onStartNew} />
    );

    const region = page.getByRole('region', { name: copy.forgeErrorLabel });
    await expect.element(region.getByRole('alert')).toHaveTextContent(UNRESOLVED);

    await userEvent.click(region.getByRole('button', { name: copy.forgeErrorBack }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onStartNew).not.toHaveBeenCalled();
  });

  it('starts a new app from the error instead of leaving the visitor stuck', async () => {
    const onBack = vi.fn();
    const onStartNew = vi.fn();
    mounted = mount(
      <ForgeErrorPanel message={copy.forgeError} onBack={onBack} onStartNew={onStartNew} />
    );

    await expect.element(page.getByRole('alert')).toHaveTextContent(copy.forgeError);
    await userEvent.click(page.getByRole('button', { name: copy.forgeErrorNew }));
    expect(onStartNew).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });
});
