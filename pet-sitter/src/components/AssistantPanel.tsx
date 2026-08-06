import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { askAssistant } from '../lib/api';
import { en } from '../i18n/en';

/**
 * Shell-reachable AI assistant grounded in app sitters data.
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
      setAnswer(result.answer);
      setLinks(result.sitters.map((s) => ({ id: s.id, name: s.name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : en.assistant.error);
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
        aria-controls="assistant-panel"
        aria-label={en.assistant.openLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? en.assistant.close : en.assistant.open}
      </button>
      {open ? (
        <div id="assistant-panel" className="assistant__panel" role="region" aria-label={en.assistant.region}>
          <p className="assistant__hint">{en.assistant.hint}</p>
          <form className="assistant__form" onSubmit={(e) => void onSubmit(e)}>
            <label className="assistant__label" htmlFor="assistant-input">
              {en.assistant.inputLabel}
            </label>
            <textarea
              id="assistant-input"
              className="assistant__input"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              required
            />
            <button type="submit" className="assistant__submit" disabled={loading}>
              {loading ? en.assistant.loading : en.assistant.submit}
            </button>
          </form>
          {error ? (
            <p className="assistant__error" role="alert">
              {error}
            </p>
          ) : null}
          {answer ? (
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
