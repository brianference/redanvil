import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { askAssistant } from '../lib/api';
import { en } from '../i18n/en';

/**
 * Shell-reachable AI assistant grounded in app sitters data.
 *
 * Always POSTs the question to /api/assistant. Loading and error are real UI
 * states; an empty or missing answer is treated as failure, never success.
 */
export function AssistantPanel(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<{ id: string; name: string }>>([]);
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
    if (text.length === 0) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setLinks([]);
    try {
      const result = await askAssistant(text);
      const grounded = typeof result.answer === 'string' ? result.answer.trim() : '';
      if (grounded.length === 0) {
        setError(en.assistant.error);
        return;
      }
      setAnswer(grounded);
      setLinks(
        Array.isArray(result.sitters)
          ? result.sitters.map((s) => ({ id: s.id, name: s.name }))
          : []
      );
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : en.assistant.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="assistant" data-testid="assistant-panel">
      <button
        type="button"
        className="assistant__toggle"
        aria-expanded={open}
        aria-controls="assistant-panel-body"
        aria-label={en.assistant.openLabel}
        data-testid="assistant-open"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? en.assistant.close : en.assistant.open}
      </button>
      {open ? (
        <div
          id="assistant-panel-body"
          className="assistant__panel"
          role="region"
          aria-label={en.assistant.region}
          data-testid="assistant-surface"
        >
          <p className="assistant__hint">{en.assistant.hint}</p>
          <form
            className="assistant__form"
            onSubmit={(e) => {
              void onSubmit(e);
            }}
            data-testid="assistant-form"
          >
            <label className="assistant__label" htmlFor="assistant-input">
              {en.assistant.inputLabel}
            </label>
            <textarea
              id="assistant-input"
              className="assistant__input"
              name="assistant-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              required
              disabled={loading}
              data-testid="assistant-input"
            />
            <button
              type="submit"
              className="assistant__submit"
              disabled={loading || message.trim().length === 0}
              data-testid="assistant-submit"
            >
              {loading ? en.assistant.loading : en.assistant.submit}
            </button>
          </form>
          {loading ? (
            <p className="assistant__status" role="status" data-testid="assistant-loading">
              {en.assistant.loading}
            </p>
          ) : null}
          {error ? (
            <p className="assistant__error" role="alert" data-testid="assistant-error">
              {error}
            </p>
          ) : null}
          {answer && !loading ? (
            <div className="assistant__answer" data-testid="assistant-answer">
              <p style={{ whiteSpace: 'pre-wrap' }}>{answer}</p>
              {links.length > 0 ? (
                <ul>
                  {links.map((l) => (
                    <li key={l.id}>
                      <Link to={`/sitters/${l.id}`}>{l.name}</Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
