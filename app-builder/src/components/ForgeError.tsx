import type { CSSProperties } from 'react';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { ErrorBanner } from './Banner';
import { buttonStyle } from './ui';

export interface ForgeErrorProps {
  /** Why the PRD could not be produced. */
  message: string;
  /** Return to the wizard with the answers kept. */
  onBack: () => void;
  /** Discard the answers and start a new app. */
  onReset: () => void;
}

/**
 * The result screen when no PRD came out of a submitted job: the reason, and
 * the two ways forward.
 *
 * @param props - Message and recovery handlers.
 */
export function ForgeError({ message, onBack, onReset }: ForgeErrorProps): JSX.Element {
  const copy = en.pages.home;
  return (
    <section style={rootStyle} aria-label={copy.forgeErrorLabel}>
      <ErrorBanner message={message} />
      <div style={actionsStyle}>
        <button type="button" style={buttonStyle(true)} onClick={onBack}>
          {copy.forgeErrorBack}
        </button>
        <button type="button" style={buttonStyle(false)} onClick={onReset}>
          {copy.forgeErrorNew}
        </button>
      </div>
    </section>
  );
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm
};
