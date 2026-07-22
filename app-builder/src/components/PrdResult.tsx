import { useState, type CSSProperties } from 'react';
import type { Prd } from '../lib/prd';
import { savePrd, SavePrdError } from '../lib/savePrd';
import { en } from '../i18n/en';
import { theme } from '../theme';

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

const card: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  padding: theme.space.lg
};

const button = (primary = false): CSSProperties => ({
  fontFamily: theme.type.family,
  fontSize: theme.type.scale[1],
  fontWeight: 600,
  color: theme.color.text,
  background: primary ? theme.color.accent : 'transparent',
  border: primary ? 'none' : `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.sm,
  padding: `${theme.space.sm}px ${theme.space.md}px`,
  cursor: 'pointer'
});

/** Shows the generated PRD with download, copy, and save-to-site actions. */
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

  return (
    <section style={card} aria-label={copy.sectionLabel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.space.sm }}>
        <div>
          <p style={{ margin: 0, color: theme.color.accent, fontSize: theme.type.scale[0], fontWeight: 600, letterSpacing: '0.08em' }}>
            {copy.ready}
          </p>
          <h2 style={{ margin: `${theme.space.xs}px 0 0`, fontSize: theme.type.scale[4] }}>{prd.title}</h2>
        </div>
        <div style={{ display: 'flex', gap: theme.space.sm, flexWrap: 'wrap' }}>
          <button type="button" style={button(true)} onClick={download}>
            {copy.download}
          </button>
          <button type="button" style={button()} onClick={() => void copyMarkdown()}>
            {copied ? copy.copied : copy.copy}
          </button>
          <button
            type="button"
            style={button()}
            onClick={() => void handleSave()}
            disabled={saveState.status === 'loading'}
            aria-busy={saveState.status === 'loading'}
          >
            {saveState.status === 'loading' ? copy.saving : copy.saveToSite}
          </button>
          <button type="button" style={button()} onClick={onReset}>
            {copy.newPrd}
          </button>
        </div>
      </div>
      <p style={{ color: theme.color.muted, fontSize: theme.type.scale[1], marginTop: theme.space.sm }}>
        {copy.hint}
      </p>
      {saveState.status === 'success' && (
        <p
          role="status"
          style={{ color: theme.color.accent, fontSize: theme.type.scale[1], marginTop: theme.space.sm }}
        >
          <a href={saveState.url} style={{ color: theme.color.accent, fontWeight: 600 }}>
            {copy.savedViewAt(saveState.url)}
          </a>
        </p>
      )}
      {saveState.status === 'error' && (
        <p
          role="alert"
          style={{ color: theme.color.accent, fontSize: theme.type.scale[1], marginTop: theme.space.sm }}
        >
          {saveState.message}
        </p>
      )}
      <pre
        style={{
          marginTop: theme.space.md,
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
        }}
      >
        {prd.markdown}
      </pre>
    </section>
  );
}
