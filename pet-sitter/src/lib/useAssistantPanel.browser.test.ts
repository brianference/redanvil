/**
 * Browser lane: the shared assistant hook, driven with a real DOM.
 *
 * An independent review failed the previous commit for claiming, in a comment,
 * that `forceError` was "covered by sushi-finder's acceptance suite in a real
 * browser". A comment is not evidence, and the reviewer could not see that suite
 * from the diff it was given. This is that claim turned into a test.
 *
 * It lives in pet-sitter because pet-sitter owns the only browser lane in the
 * repo (`@vitest/browser` + chromium); the hook itself is shared by every app,
 * and both empty-submit policies are exercised here regardless of which app
 * uses which.
 */
import { describe, expect, it } from 'vitest';
import { createElement, type FormEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  useAssistantPanel,
  type AssistantPanelState
} from '../../../design-system/hooks/useAssistantPanel';

type Item = { id: string; name: string };

/** Options accepted by the hook under test. */
interface ProbeOptions {
  ask: (message: string) => Promise<{ answer?: unknown; sitters?: Item[] }>;
  onEmptySubmit?: 'ignore' | 'send';
  emptyMessage?: string;
}

/** Handle onto a mounted probe. */
interface Probe {
  panel: () => AssistantPanelState<Item>;
  submit: () => Promise<void>;
  unmount: () => void;
}

/** Let React flush its queued work and any resolved promises. */
async function tick(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Mount the hook inside a throwaway component and expose its state.
 *
 * @param options - Hook wiring for this case.
 * @returns Handle for driving and reading the hook.
 */
function mountProbe(options: ProbeOptions): Probe {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let latest: AssistantPanelState<Item> | null = null;

  function ProbeComponent(): null {
    latest = useAssistantPanel<{ answer?: unknown; sitters?: Item[] }, Item>({
      ask: options.ask,
      selectItems: (result) => (Array.isArray(result.sitters) ? result.sitters : []),
      errorMessage: 'GENERIC',
      onEmptySubmit: options.onEmptySubmit,
      emptyMessage: options.emptyMessage
    });
    return null;
  }

  const root: Root = createRoot(container);
  root.render(createElement(ProbeComponent));

  return {
    panel: () => {
      if (latest === null) throw new Error('probe never rendered');
      return latest;
    },
    submit: async () => {
      // NOT `latest?.submit(...)`. Optional chaining made this a silent no-op
      // when the probe had not mounted, and the 'ignore' case below asserts
      // that nothing happened — so a failed mount produced exactly the same
      // observations as a working ignore policy and the test could not fail.
      if (latest === null) throw new Error('probe never rendered; submit not called');
      const event = { preventDefault: () => undefined } as unknown as FormEvent;
      await latest.submit(event);
      await tick();
    },
    unmount: () => {
      root.unmount();
      container.remove();
    }
  };
}

// `onEmptySubmit: 'send'` is the only way to reach the hook's internal
// `forceError` argument: submit() calls run('', emptyMessage, emptyMessage),
// and that third argument is forceError. Naming it here because a reviewer
// reading this file could not otherwise see which flag these cases pin.
describe('useAssistantPanel — empty submit and the forceError path', () => {
  it('forceError: under "send", a 200 with prose still shows the empty message, not an answer', async () => {
    let asked = 0;
    const probe = mountProbe({
      ask: async (message) => {
        asked += 1;
        expect(message).toBe('');
        // A loose endpoint that answers an empty question with real prose.
        return { answer: 'here is an answer nobody asked for', sitters: [] };
      },
      onEmptySubmit: 'send',
      emptyMessage: 'EMPTY'
    });
    await tick();

    await probe.submit();

    // The request must still go, so the boundary can answer 400 in production.
    expect(asked, 'empty submit must still POST').toBe(1);
    // ...but a blank question must never render an answer.
    expect(probe.panel().answer).toBeNull();
    expect(probe.panel().error).toBe('EMPTY');
    probe.unmount();
  });

  it('forceError: a rejected request surfaces the API message, not the forced empty message', async () => {
    const probe = mountProbe({
      ask: async () => {
        throw new Error('message is required');
      },
      onEmptySubmit: 'send',
      emptyMessage: 'EMPTY'
    });
    await tick();

    await probe.submit();

    // This is what the pre-refactor component did, and it is the more useful
    // error: the server said exactly what was wrong.
    expect(probe.panel().error).toBe('message is required');
    probe.unmount();
  });

  it('under "ignore", an empty submit sends nothing — with a positive control', async () => {
    let asked = 0;
    const probe = mountProbe({
      ask: async () => {
        asked += 1;
        return { answer: 'a real answer' };
      },
      onEmptySubmit: 'ignore'
    });
    await tick();

    // POSITIVE CONTROL FIRST. Asserting only "asked === 0" after an empty submit
    // is satisfied just as well by a probe that never mounted or a submit that
    // never ran. Proving the same probe DOES post a real question first is what
    // makes the zero below mean "the ignore branch ran".
    probe.panel().setMessage('who walks dogs');
    await tick();
    await probe.submit();
    expect(asked, 'control: a real question must POST').toBe(1);

    probe.panel().setMessage('   ');
    await tick();
    await probe.submit();
    expect(asked, 'ignore policy must not POST a blank question').toBe(1);
    probe.unmount();
  });

  it('a real question renders the answer and its grounding rows', async () => {
    const sitters: Item[] = [{ id: 's1', name: 'Ada' }];
    const probe = mountProbe({
      ask: async (message) => {
        expect(message).toBe('who walks dogs');
        return { answer: '  Ada does.  ', sitters };
      }
    });
    await tick();

    probe.panel().setMessage('who walks dogs');
    await tick();
    await probe.submit();

    expect(probe.panel().answer).toBe('Ada does.');
    expect(probe.panel().links).toEqual(sitters);
    expect(probe.panel().error).toBeNull();
    probe.unmount();
  });
});
