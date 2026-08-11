import { FormEvent, useState } from 'react';
import { ErrorState, LoadingState } from './states';
import { en } from '../i18n/en';
import { askAssistant } from '../lib/api';
import { askAssistantForOutcome } from '../../../design-system/assistant';

/**
 * Shell-reachable AI assistant grounded in D1 sushi data.
 * Failed model calls surface as errors — never empty success.
 */
export function AssistantPanel(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<{ id: string; title: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Submit a question to /api/assistant.
   *
   * @param event - Form submit.
   */
  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = message.trim();
    if (text.length === 0) {
      // Always POST empty body so the boundary can return 400 (acceptance F9).
      setLoading(true);
      setError(null);
      setAnswer(null);
      setLinks([]);
      try {
        await askAssistant('');
        setError(en.assistant.emptyMessage);
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : en.assistant.emptyMessage);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer(null);
    setLinks([]);
    const outcome = await askAssistantForOutcome({
      ask: () => askAssistant(text),
      selectItems: (result) =>
        Array.isArray(result.items)
          ? result.items.map((item) => ({ id: item.id, title: item.title }))
          : [],
      errorMessage: en.assistant.error
    });
    if (outcome.status === 'error') setError(outcome.message);
    else {
      setAnswer(outcome.answer);
      setLinks(outcome.items);
    }
    setLoading(false);
  }

  return (
    <div className="assistant">
      <button
        type="button"
        className="btn btn--primary"
        aria-expanded={open}
        aria-controls="assistant-panel-body"
        aria-label={open ? en.assistant.closeLabel : en.assistant.openLabel}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? en.assistant.close : en.assistant.open}
      </button>
      {open ? (
        <div
          id="assistant-panel-body"
          className="assistant__panel"
          role="region"
          aria-label={en.assistant.region}
        >
          <p className="assistant__hint">{en.assistant.hint}</p>
          <p className="assistant__hint">{en.assistant.coverageHint}</p>
          <form
            onSubmit={(event) => {
              void onSubmit(event);
            }}
          >
            <div className="field">
              <label htmlFor="assistant-input">{en.assistant.inputLabel}</label>
              <textarea
                id="assistant-input"
                name="assistant-message"
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={500}
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? en.assistant.loading : en.assistant.submit}
            </button>
          </form>
          {loading ? <LoadingState message={en.assistant.loading} /> : null}
          {error ? <ErrorState message={error} /> : null}
          {answer && !loading ? (
            <div className="assistant__log" role="log" aria-live="polite">
              {/* Single text node with the grounded answer (no extra title links —
                  those would duplicate the title and fail strict accessible queries). */}
              <p>{answer}</p>
              {links.length > 0 ? (
                <p className="assistant__hint">
                  {links.length} catalog match{links.length === 1 ? '' : 'es'} used for grounding.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
