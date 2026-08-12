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
      const event = { preventDefault: () => undefined } as unknown as FormEvent;
      await latest?.submit(event);
      await tick();
    },
    unmount: () => {
      root.unmount();
      container.remove();
    }
  };
}

describe('useAssistantPanel — empty submit', () => {
  it('under "send", shows the empty message even when the endpoint answers 200 with prose', async () => {
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

  it('under "send", a rejected request surfaces the API message, not the empty message', async () => {
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

  it('under "ignore", an empty submit sends nothing and changes nothing', async () => {
    let asked = 0;
    const probe = mountProbe({
      ask: async () => {
        asked += 1;
        return { answer: 'should never run' };
      },
      onEmptySubmit: 'ignore'
    });
    await tick();

    await probe.submit();

    expect(asked, 'ignore policy must not POST').toBe(0);
    expect(probe.panel().error).toBeNull();
    expect(probe.panel().answer).toBeNull();
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
