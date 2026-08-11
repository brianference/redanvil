import { Link } from 'react-router-dom';
import { en } from '../i18n/en';
import { askAssistant } from '../lib/api';
import { useAssistantPanel } from '../../../design-system/hooks/useAssistantPanel';

/**
 * Shell-reachable AI assistant grounded in app sitters data.
 *
 * Always POSTs the question to /api/assistant. Loading and error are real UI
 * states; an empty or missing answer is treated as failure, never success.
 * State lives in the shared `useAssistantPanel` hook; only this app's markup —
 * which renders grounding rows as links to each sitter — is here.
 */
export function AssistantPanel(): JSX.Element {
  const panel = useAssistantPanel({
    ask: (message) => askAssistant(message),
    selectItems: (result) =>
      Array.isArray(result.sitters) ? result.sitters.map((s) => ({ id: s.id, name: s.name })) : [],
    errorMessage: en.assistant.error
  });

  return (
    <div className="assistant" data-testid="assistant-panel">
      <button
        type="button"
        className="assistant__toggle"
        aria-expanded={panel.open}
        aria-controls="assistant-panel-body"
        aria-label={en.assistant.openLabel}
        data-testid="assistant-open"
        onClick={panel.toggle}
      >
        {panel.open ? en.assistant.close : en.assistant.open}
      </button>
      {panel.open ? (
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
              void panel.submit(e);
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
              value={panel.message}
              onChange={(e) => panel.setMessage(e.target.value)}
              maxLength={500}
              required
              disabled={panel.loading}
              data-testid="assistant-input"
            />
            <button
              type="submit"
              className="assistant__submit"
              disabled={panel.loading || panel.message.trim().length === 0}
              data-testid="assistant-submit"
            >
              {panel.loading ? en.assistant.loading : en.assistant.submit}
            </button>
          </form>
          {panel.loading ? (
            <p className="assistant__status" role="status" data-testid="assistant-loading">
              {en.assistant.loading}
            </p>
          ) : null}
          {panel.error ? (
            <p className="assistant__error" role="alert" data-testid="assistant-error">
              {panel.error}
            </p>
          ) : null}
          {panel.answer && !panel.loading ? (
            <div className="assistant__answer" data-testid="assistant-answer">
              <p style={{ whiteSpace: 'pre-wrap' }}>{panel.answer}</p>
              {panel.links.length > 0 ? (
                <ul>
                  {panel.links.map((l) => (
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
