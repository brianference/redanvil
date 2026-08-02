import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { en } from '../i18n/en';
import { askAssistant } from '../lib/api';
import type { AssistantResponse } from '../lib/schemas';
import { useZone } from '../hooks/useZone';
import './AssistantPanel.css';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  crops?: AssistantResponse['crops'];
}

const SESSION_CLOSED_KEY = 'az-assistant-closed';

interface AssistantPanelProps {
  /** Open on mount when true (home only), unless the visitor closed it this session. */
  defaultOpen?: boolean;
  /** inline = document flow (mobile-safe); floating = fixed dock. */
  placement?: 'inline' | 'floating';
}

/**
 * Shell chat affordance: panel that POSTs to /api/assistant.
 * Fail-closed: model or network errors show a visible error state, never empty success.
 * Does not auto-send on load.
 */
export function AssistantPanel({
  defaultOpen = false,
  placement = 'floating'
}: AssistantPanelProps) {
  const titleId = useId();
  const inputId = useId();
  const location = useLocation();
  const { zone } = useZone();
  const [open, setOpen] = useState(() => {
    if (!defaultOpen) return false;
    try {
      return sessionStorage.getItem(SESSION_CLOSED_KEY) !== '1';
    } catch {
      return defaultOpen;
    }
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  // On home, open by default once per session unless the visitor closed it.
  useEffect(() => {
    if (!defaultOpen) return;
    try {
      if (sessionStorage.getItem(SESSION_CLOSED_KEY) === '1') {
        setOpen(false);
      } else {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [defaultOpen, location.pathname]);

  /**
   * Close and remember for this browser session.
   */
  function handleClose(): void {
    setOpen(false);
    try {
      sessionStorage.setItem(SESSION_CLOSED_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  /**
   * Open (does not clear the session closed flag until explicit open).
   */
  function handleOpen(): void {
    setOpen(true);
    try {
      sessionStorage.removeItem(SESSION_CLOSED_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * Submit the current message to the grounded assistant endpoint.
   *
   * @param event - Form submit event.
   */
  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const message = text.trim();
    if (!message || busy) return;

    setBusy(true);
    setError(null);
    setTurns((prev) => [...prev, { role: 'user', text: message }]);
    setText('');

    try {
      const result = await askAssistant(message, zone?.id);
      if (!result.answer.trim()) {
        setError(en.assistant.error);
        return;
      }
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.answer.trim(),
          crops: result.crops
        }
      ]);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : en.assistant.error;
      setError(msg || en.assistant.error);
    } finally {
      setBusy(false);
    }
  }

  const rootClass =
    placement === 'inline'
      ? 'assistant assistant--inline'
      : 'assistant assistant--floating';

  return (
    <div className={rootClass} data-testid="assistant-root" data-placement={placement}>
      {open ? (
        <div
          className="assistant__panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          data-testid="assistant-panel"
        >
          <div className="assistant__header">
            <div>
              <h2 id={titleId} className="assistant__title">
                {en.assistant.title}
              </h2>
              <p className="assistant__subtitle">{en.assistant.subtitle}</p>
            </div>
            <button
              type="button"
              className="assistant__close"
              onClick={handleClose}
              aria-label={en.assistant.close}
              data-testid="assistant-close"
            >
              ×
            </button>
          </div>

          <div className="assistant__log" data-testid="assistant-log" aria-live="polite">
            {turns.length === 0 && !error && !busy ? (
              <p className="assistant__hint">{en.assistant.empty}</p>
            ) : null}
            {turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                className={
                  turn.role === 'user'
                    ? 'assistant__turn assistant__turn--user'
                    : 'assistant__turn assistant__turn--assistant'
                }
              >
                <span className="assistant__role">
                  {turn.role === 'user' ? en.assistant.you : en.assistant.reply}
                </span>
                <p className="assistant__text">{turn.text}</p>
                {turn.crops && turn.crops.length > 0 ? (
                  <div className="assistant__crops" data-testid="assistant-crops">
                    <p className="assistant__crops-heading">{en.assistant.cropsHeading}</p>
                    <ul className="assistant__crop-list">
                      {turn.crops.slice(0, 12).map((crop) => (
                        <li key={crop.id}>
                          <Link to={`/crop/${crop.id}`}>{crop.name}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {turn.role === 'assistant' && turn.crops && turn.crops.length === 0 ? (
                  <p className="assistant__hint" data-testid="assistant-no-crops">
                    {en.assistant.noCrops}
                  </p>
                ) : null}
              </div>
            ))}
            {busy ? (
              <p className="assistant__status" data-testid="assistant-busy">
                {en.assistant.thinking}
              </p>
            ) : null}
            {error ? (
              <p className="assistant__error" role="alert" data-testid="assistant-error">
                {error}
              </p>
            ) : null}
          </div>

          <form className="assistant__form" onSubmit={(e) => void handleSubmit(e)}>
            <label className="assistant__label" htmlFor={inputId}>
              {en.assistant.placeholder}
            </label>
            <div className="assistant__row">
              <input
                id={inputId}
                className="assistant__input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={en.assistant.placeholder}
                disabled={busy}
                maxLength={500}
                autoComplete="off"
                data-testid="assistant-input"
              />
              <button
                type="submit"
                className="assistant__send"
                disabled={busy || text.trim().length === 0}
                data-testid="assistant-send"
              >
                {en.assistant.submit}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        className="assistant__fab"
        onClick={() => (open ? handleClose() : handleOpen())}
        aria-expanded={open}
        aria-label={open ? en.assistant.close : en.assistant.openAria}
        data-testid="assistant-open"
      >
        {open ? en.assistant.close : en.assistant.open}
      </button>
    </div>
  );
}
