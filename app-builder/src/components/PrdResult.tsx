import { useState, type CSSProperties } from 'react';
import { safeHref } from '../../../design-system/safeHttpUrl';
import type { Prd } from '../lib/prd';
import { savePrd, SavePrdError } from '../lib/savePrd';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { LoadingBanner, ErrorBanner } from './Banner';
import { FidelityWarning } from './FidelityWarning';
import { buttonStyle, cardStyle, statusBannerStyle } from './ui';

export interface PrdResultProps {
  /** The generated PRD to display and offer for download. */
  prd: Prd;
  /** Called when the user wants to start a new PRD. */
  onReset: () => void;
}

type SaveState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; href: string }
  | { status: 'error'; message: string };

/** Result of the last copy-to-clipboard attempt, shown on the copy button. */
type CopyState = 'idle' | 'copied' | 'failed';

/** How long the copy button shows its result before resetting. */
const COPY_FEEDBACK_MS = 2000;

/**
 * Shows the generated PRD with hero-style ready state, download, copy, and
 * save-to-site actions (Grok v4 premium result language).
 */
export function PrdResult({ prd, onReset }: PrdResultProps): JSX.Element {
  const copy = en.prdResult;
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });

  /** Download the PRD as a .md file the user can load into Claude. */
  function download(): void {
    const blob = new Blob([prd.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prd.slug}.prd.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Copy the PRD markdown and say on the button whether it worked, so a refused
   * clipboard does not look like a copy that happened.
   */
  async function copyMarkdown(): Promise<void> {
    try {
      await navigator.clipboard.writeText(prd.markdown);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
  }

  /**
   * Persist the PRD to the site via POST /api/prds.
   * Loading → success link or inline error (fail closed).
   */
  async function handleSave(): Promise<void> {
    if (saveState.status === 'loading') return;
    setSaveState({ status: 'loading' });
    try {
      const result = await savePrd(prd);
      // The API returns a same-origin path (`/prd/:id`); safeHref rejects
      // javascript:, data: and protocol-relative values. A rejected link is
      // reported, never dropped: the save happened and the user must hear so.
      const href = safeHref(result.url);
      setSaveState(
        href === null
          ? { status: 'error', message: copy.errors.unsafeLink }
          : { status: 'success', href }
      );
    } catch (error: unknown) {
      const message = error instanceof SavePrdError ? error.message : copy.errors.generic;
      setSaveState({ status: 'error', message });
    }
  }

  const saving = saveState.status === 'loading';
  const copyLabels: Record<CopyState, string> = {
    idle: copy.copy,
    copied: copy.copied,
    failed: copy.copyFailed
  };

  return (
    <section
      className="ra-content-col"
      aria-label={copy.sectionLabel}
      data-testid="prd-result"
    >
      <div style={heroStyle}>
        <p style={readyBadgeStyle}>
          <span aria-hidden="true">✓ </span>
          {copy.ready}
        </p>
        {/* Title is the single page H1 from Page — do not repeat it here. */}
        <p style={ledeStyle}>{copy.lede}</p>
        <p style={{ ...ledeStyle, marginTop: theme.space.xs }}>{copy.hint}</p>
      </div>

      <div style={actionsStyle}>
        <button type="button" style={buttonStyle(true)} onClick={download}>
          {copy.download}
        </button>
        <button type="button" style={buttonStyle(false)} onClick={() => void copyMarkdown()}>
          {copyState === 'copied' && <span aria-hidden="true">✓ </span>}
          {copyLabels[copyState]}
        </button>
        <button
          type="button"
          style={buttonStyle(false, saving)}
          onClick={() => void handleSave()}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? copy.saving : copy.saveToSite}
        </button>
        <button type="button" style={buttonStyle(false)} onClick={onReset}>
          {copy.newPrd}
        </button>
      </div>

      {saveState.status === 'loading' && <LoadingBanner message={copy.saving} />}
      {saveState.status === 'success' && (
        <div role="status" style={statusBannerStyle()}>
          <span aria-hidden="true">✓</span>
          <a href={saveState.href} style={{ color: theme.color.accent, fontWeight: 600 }}>
            {copy.savedViewAt(saveState.href)}
          </a>
        </div>
      )}
      {saveState.status === 'error' && <ErrorBanner message={saveState.message} />}

      <FidelityWarning markdown={prd.markdown} />

      <div style={cardStyle(theme.space.md)}>
        <pre style={preStyle}>{prd.markdown}</pre>
      </div>
    </section>
  );
}

const heroStyle: CSSProperties = {
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs
};

const readyBadgeStyle: CSSProperties = {
  margin: 0,
  color: theme.color.accent,
  fontSize: theme.type.scale[0],
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs
};

const ledeStyle: CSSProperties = {
  margin: 0,
  color: theme.color.muted,
  fontSize: theme.type.scale[2],
  lineHeight: 1.45,
  maxWidth: '40rem'
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm
};

const preStyle: CSSProperties = {
  margin: 0,
  maxHeight: '28rem',
  overflow: 'auto',
  background: theme.color.bg,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.md,
  fontSize: theme.type.scale[1],
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: theme.color.text
};
