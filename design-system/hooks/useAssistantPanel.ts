/**
 * Shared state for the grounded AI assistant every RedAnvil app ships.
 *
 * The rule pack requires an assistant in every app, so every app declared the
 * same six pieces of state and wrote the same submit handler around them. The
 * cross-app pass measured that as two blocks — the `useState` run and the submit
 * body — between pet-sitter and sushi-finder. Extracting only the async part
 * into `../assistant.ts` did not help much, because what was left was two
 * identical CALL sites; the state has to move with it.
 *
 * This hook imports React, which is safe here only because every app in this
 * repo is an npm workspace and react is hoisted to one copy at the root.
 * sushi-finder and pet-sitter carried their own copies until 2026-08-10; while
 * they did, a shared hook put a second React in their bundles and every hook
 * threw "Cannot read properties of null (reading 'useRef')" — the failure
 * recorded in `useDrawerA11y.ts`, which `resolve.dedupe` did not fix. If an app
 * ever leaves the workspace, this import is the first thing that breaks.
 *
 * Markup stays in each app. The two panels genuinely differ — different class
 * names, test ids, and whether grounding rows render as links — and flattening
 * them into one over-parameterised component would trade real duplication for a
 * speculative abstraction, which the base rules rule out.
 */
import { useState, type FormEvent } from 'react';
import { askAssistantForOutcome } from '../assistant';

/** What to do when the user submits an empty question. */
export type EmptySubmitPolicy = 'ignore' | 'send';

/** Everything a panel needs to render itself. */
export interface AssistantPanelState<TItem> {
  /** Whether the panel is expanded. */
  open: boolean;
  /** Flip the panel open or closed. */
  toggle: () => void;
  /** Current textarea value. */
  message: string;
  /** Replace the textarea value. */
  setMessage: (value: string) => void;
  /** The grounded answer, or null when there is none to show. */
  answer: string | null;
  /** Rows the answer was grounded in. */
  links: TItem[];
  /** The error to surface, or null. */
  error: string | null;
  /** Whether a request is in flight. */
  loading: boolean;
  /** Submit handler for the form. */
  submit: (event: FormEvent) => Promise<void>;
}

/**
 * Own the assistant panel's state and submit path.
 *
 * @param options - Wiring for this app's assistant endpoint.
 * @param options.ask - Sends the question; may reject.
 * @param options.selectItems - Pulls grounding rows out of the reply.
 * @param options.errorMessage - Shown when the call fails or answers blank.
 * @param options.onEmptySubmit - `ignore` drops an empty submit; `send` posts it
 *   anyway so the endpoint can answer 400, which one app's acceptance suite
 *   asserts. Defaults to `ignore`.
 * @param options.emptyMessage - Error shown for an empty submit under `send`.
 * @returns State and handlers for the panel markup.
 */
export function useAssistantPanel<TResult, TItem>(options: {
  ask: (message: string) => Promise<TResult>;
  selectItems: (result: TResult) => TItem[];
  errorMessage: string;
  onEmptySubmit?: EmptySubmitPolicy;
  emptyMessage?: string;
}): AssistantPanelState<TItem> {
  const {
    ask,
    selectItems,
    errorMessage,
    onEmptySubmit = 'ignore',
    emptyMessage = errorMessage
  } = options;

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [links, setLinks] = useState<TItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Run one question through the endpoint and fold the outcome into state.
   *
   * @param text - The question to send.
   * @param blankFallback - Error to use when the reply is unusable.
   */
  async function run(text: string, blankFallback: string): Promise<void> {
    setLoading(true);
    setError(null);
    setAnswer(null);
    setLinks([]);
    const outcome = await askAssistantForOutcome({
      ask: () => ask(text),
      selectItems,
      errorMessage: blankFallback
    });
    if (outcome.status === 'error') {
      setError(outcome.message);
    } else {
      setAnswer(outcome.answer);
      setLinks(outcome.items);
    }
    setLoading(false);
  }

  return {
    open,
    toggle: () => setOpen((value) => !value),
    message,
    setMessage,
    answer,
    links,
    error,
    loading,
    submit: async (event: FormEvent): Promise<void> => {
      event.preventDefault();
      const text = message.trim();
      if (text.length === 0) {
        if (onEmptySubmit === 'ignore') return;
        await run('', emptyMessage);
        return;
      }
      await run(text, errorMessage);
    }
  };
}
