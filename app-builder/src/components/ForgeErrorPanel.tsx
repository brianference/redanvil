import type { CSSProperties } from 'react';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { ErrorBanner } from './Banner';
import { buttonStyle } from './ui';

export interface ForgeErrorPanelProps {
  /** Why no PRD could be generated. */
  message: string;
  /** Return to the wizard with the answers kept, to fix what failed. */
  onBack: () => void;
  /** Discard the answers and start a new app. */
  onStartNew: () => void;
}

/**
 * The result screen when PRD generation failed: the reason, and the two ways
 * out. Never an empty result screen.
 *
 * @param props - Message and the two recovery actions.
 * @returns The error section.
 */
export function ForgeErrorPanel({
  message,
  onBack,
  onStartNew
}: ForgeErrorPanelProps): JSX.Element {
  const copy = en.pages.home;
  return (
    <section style={rootStyle} aria-label={copy.forgeErrorLabel}>
      <ErrorBanner message={message} />
      <div style={actionsStyle}>
        <button type="button" style={buttonStyle(true)} onClick={onBack}>
          {copy.forgeErrorBack}
        </button>
        <button type="button" style={buttonStyle(false)} onClick={onStartNew}>
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
