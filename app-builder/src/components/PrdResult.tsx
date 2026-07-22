import { useState, type CSSProperties } from 'react';
import type { Prd } from '../lib/prd';
import { savePrd, SavePrdError } from '../lib/savePrd';
import { en } from '../i18n/en';
import { theme } from '../theme';
import {
  buttonStyle,
  cardStyle,
  contentColumnStyle,
  errorBannerStyle,
  statusBannerStyle
} from './ui';

export interface PrdResultProps {
  /** The generated PRD to display and offer for download. */
  prd: Prd;
  /** Called when the user wants to start a new PRD. */
  onReset: () => void;
}

type SaveState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; url: string }
  | { status: 'error'; message: string };

/**
 * Shows the generated PRD with hero-style ready state, download, copy, and
 * save-to-site actions (Grok v4 premium result language).
 */
export function PrdResult({ prd, onReset }: PrdResultProps): JSX.Element {
  const copy = en.prdResult;
  const [copied, setCopied] = useState(false);
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

  /** Copy the PRD markdown to the clipboard. */
  async function copyMarkdown(): Promise<void> {
    try {
      await navigator.clipboard.writeText(prd.markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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
      setSaveState({ status: 'success', url: result.url });
    } catch (error: unknown) {
      const message =
        error instanceof SavePrdError
          ? error.message
          : copy.errors.generic;
      setSaveState({ status: 'error', message });
    }
  }

  const saving = saveState.status === 'loading';

  return (
    <section style={contentColumnStyle} aria-label={copy.sectionLabel}>
      <div style={heroStyle}>
        <p style={readyBadgeStyle}>
          <span aria-hidden="true">✓ </span>
          {copy.ready}
        </p>
        <h2 style={titleStyle}>{prd.title}</h2>
        <p style={ledeStyle}>{copy.lede}</p>
        <p style={{ ...ledeStyle, marginTop: theme.space.xs }}>{copy.hint}</p>
      </div>

      <div style={actionsStyle}>
        <button type="button" style={buttonStyle(true)} onClick={download}>
          {copy.download}
        </button>
        <button type="button" style={buttonStyle(false)} onClick={() => void copyMarkdown()}>
          {copied ? (
            <>
              <span aria-hidden="true">✓ </span>
              {copy.copied}
            </>
          ) : (
            copy.copy
          )}
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

      {saveState.status === 'loading' && (
        <div role="status" aria-live="polite" aria-busy="true" style={statusBannerStyle()}>
          <span aria-hidden="true">…</span>
          <span>{copy.saving}</span>
        </div>
      )}
      {saveState.status === 'success' && (
        <div role="status" style={statusBannerStyle()}>
          <span aria-hidden="true">✓</span>
          <a href={saveState.url} style={{ color: theme.color.accent, fontWeight: 600 }}>
            {copy.savedViewAt(saveState.url)}
          </a>
        </div>
      )}
      {saveState.status === 'error' && (
        <div role="alert" style={errorBannerStyle()}>
          <span aria-hidden="true">!</span>
          <span>{saveState.message}</span>
        </div>
      )}

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

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[4],
  fontWeight: 750,
  letterSpacing: '-0.03em',
  lineHeight: 1.2,
  color: theme.color.text,
  wordBreak: 'break-word'
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
