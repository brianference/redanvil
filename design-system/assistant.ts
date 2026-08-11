/**
 * Shared submit path for the grounded AI assistant every RedAnvil app ships.
 *
 * The rule pack requires an assistant in every app, so every app wrote the same
 * 24 lines: set the pending state, await the ask, treat a blank answer as a
 * failure rather than an empty success, map the grounding rows, and turn a
 * thrown error into a message. The cross-app pass measured that block verbatim
 * between pet-sitter and sushi-finder.
 *
 * **React-free on purpose.** sushi-finder and pet-sitter install their own
 * dependencies rather than sharing the workspace root, so anything here that
 * imported React would put a second copy of it in their bundles — the exact
 * failure recorded in `hooks/useDrawerA11y.ts`, where every hook threw
 * "Cannot read properties of null" and resolve.dedupe did not fix it. Each app
 * keeps its own `useState` calls and its own markup; only the async work is
 * shared, which is the part that was actually identical.
 */

/** Outcome of one assistant question. There is no third, silent state. */
export type AssistantOutcome<TItem> =
  | { status: 'answer'; answer: string; items: TItem[] }
  | { status: 'error'; message: string };

/**
 * Ask the assistant and classify the reply, never returning an empty success.
 *
 * A model call that resolves with a blank answer is a failure the user must
 * see: rendering it as a successful empty response is the "silent success"
 * the rule pack forbids, and it is why the blank check lives here rather than
 * in each caller where it can be forgotten.
 *
 * @param options - Ask function, row selector, and the fallback message.
 * @param options.ask - Performs the request; may reject.
 * @param options.selectItems - Pulls grounding rows out of the reply.
 * @param options.errorMessage - Shown when the call fails or answers blank.
 * @returns A discriminated outcome; this function does not throw.
 */
export async function askAssistantForOutcome<TResult, TItem>(options: {
  ask: () => Promise<TResult>;
  selectItems: (result: TResult) => TItem[];
  errorMessage: string;
}): Promise<AssistantOutcome<TItem>> {
  const { ask, selectItems, errorMessage } = options;
  try {
    const result = await ask();
    const answer = typeof result === 'object' && result !== null ? readAnswer(result) : '';
    if (answer.length === 0) return { status: 'error', message: errorMessage };
    return { status: 'answer', answer, items: selectItems(result) };
  } catch (cause) {
    const message = cause instanceof Error && cause.message ? cause.message : errorMessage;
    return { status: 'error', message };
  }
}

/**
 * Read and trim the `answer` field, tolerating a reply that omits it.
 *
 * @param result - Parsed assistant reply.
 * @returns The trimmed answer, or an empty string when absent or not a string.
 */
function readAnswer(result: object): string {
  const value = (result as { answer?: unknown }).answer;
  return typeof value === 'string' ? value.trim() : '';
}
