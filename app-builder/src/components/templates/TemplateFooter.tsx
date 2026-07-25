import { en } from '../../i18n/en';
import { theme } from '../../theme';
import { buttonStyle, hintStyle } from '../ui';
import {
  actionsStyle,
  emptyStateStyle,
  emptyTitleLineStyle,
  errorAlertStyle
} from './styles';

export interface TemplateFooterProps {
  /** Whether Continue is enabled. */
  canContinue: boolean;
  /** Validation error message, or null. */
  error: string | null;
  /** Return to chat home. */
  onBack: () => void;
  /** Continue into the wizard when valid. */
  onContinue: () => void;
}

/**
 * Validation empty-state / error plus back and continue actions.
 *
 * @param props - Continue readiness, error, and action handlers.
 */
export function TemplateFooter({
  canContinue,
  error,
  onBack,
  onContinue
}: TemplateFooterProps): JSX.Element {
  const copy = en.templates;
  return (
    <>
      {error !== null && (
        <p role="alert" style={errorAlertStyle}>
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}

      {!canContinue && error === null && (
        <div role="status" style={emptyStateStyle}>
          <p style={emptyTitleLineStyle}>{copy.emptyTitle}</p>
          <p
            id="template-empty-hint"
            style={{ ...hintStyle(), margin: `${theme.space.xs}px 0 0` }}
          >
            {copy.emptyHint}
          </p>
        </div>
      )}

      <div style={actionsStyle}>
        <button type="button" style={buttonStyle(false)} onClick={onBack}>
          {copy.backToChat}
        </button>
        <button
          type="button"
          style={buttonStyle(true, !canContinue)}
          disabled={!canContinue}
          onClick={onContinue}
        >
          {copy.continue}
        </button>
      </div>
    </>
  );
}
