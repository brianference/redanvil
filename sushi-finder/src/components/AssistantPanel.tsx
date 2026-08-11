import { ErrorState, LoadingState } from './states';
import { en } from '../i18n/en';
import { askAssistant } from '../lib/api';
import { useAssistantPanel } from '../../../design-system/hooks/useAssistantPanel';

/**
 * Shell-reachable AI assistant grounded in D1 sushi data.
 * Failed model calls surface as errors — never empty success.
 *
 * State lives in the shared `useAssistantPanel` hook; only this app's markup is
 * here. `onEmptySubmit: 'send'` is deliberate — the acceptance suite asserts the
 * boundary answers 400 for an empty body, so the request has to actually go.
 */
export function AssistantPanel(): JSX.Element {
  const panel = useAssistantPanel({
    ask: (message) => askAssistant(message),
    selectItems: (result) =>
      Array.isArray(result.items)
        ? result.items.map((item) => ({ id: item.id, title: item.title }))
        : [],
    errorMessage: en.assistant.error,
    onEmptySubmit: 'send',
    emptyMessage: en.assistant.emptyMessage
  });

  return (
    <div className="assistant">
      <button
        type="button"
        className="btn btn--primary"
        aria-expanded={panel.open}
        aria-controls="assistant-panel-body"
        aria-label={panel.open ? en.assistant.closeLabel : en.assistant.openLabel}
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
        >
          <p className="assistant__hint">{en.assistant.hint}</p>
          <p className="assistant__hint">{en.assistant.coverageHint}</p>
          <form
            onSubmit={(event) => {
              void panel.submit(event);
            }}
          >
            <div className="field">
              <label htmlFor="assistant-input">{en.assistant.inputLabel}</label>
              <textarea
                id="assistant-input"
                name="assistant-message"
                rows={3}
                value={panel.message}
                onChange={(event) => panel.setMessage(event.target.value)}
                maxLength={500}
                disabled={panel.loading}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={panel.loading}>
              {panel.loading ? en.assistant.loading : en.assistant.submit}
            </button>
          </form>
          {panel.loading ? <LoadingState message={en.assistant.loading} /> : null}
          {panel.error ? <ErrorState message={panel.error} /> : null}
          {panel.answer && !panel.loading ? (
            <div className="assistant__log" role="log" aria-live="polite">
              {/* Single text node with the grounded answer (no extra title links —
                  those would duplicate the title and fail strict accessible queries). */}
              <p>{panel.answer}</p>
              {panel.links.length > 0 ? (
                <p className="assistant__hint">
                  {panel.links.length} catalog match{panel.links.length === 1 ? '' : 'es'} used for
                  grounding.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
