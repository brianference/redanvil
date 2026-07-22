import { useState, type ChangeEvent, type CSSProperties } from 'react';
import { en } from '../i18n/en';
import { theme } from '../theme';
import {
  buttonStyle,
  chipStyle,
  contentColumnStyle,
  fieldStyle,
  hintStyle,
  labelStyle
} from './ui';

/** Minimum free-text length when not using a template prompt. */
const MIN_PROMPT_LENGTH = 8;

export interface TemplateSelection {
  /** Template id, or "custom" when free-form. */
  id: string;
  /** Suggested app type for the wizard. */
  appType: string;
  /** Prompt text to seed the wizard. */
  prompt: string;
}

export interface TemplateGalleryProps {
  /** Seed prompt shown in the custom composer. */
  initialPrompt?: string;
  /** Called when the user continues with a selection. */
  onContinue: (selection: TemplateSelection) => void;
  /** Return to the chat home. */
  onBack: () => void;
}

/**
 * Template gallery: card grid of app archetypes plus an “or describe your own”
 * path (Grok v3 + Claude variation 4).
 */
export function TemplateGallery({
  initialPrompt = '',
  onContinue,
  onBack
}: TemplateGalleryProps): JSX.Element {
  const copy = en.templates;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState(initialPrompt);
  const [error, setError] = useState<string | null>(null);

  const selected = copy.items.find((item) => item.id === selectedId) ?? null;
  const effectivePrompt = (selected?.prompt ?? customPrompt).trim();
  const canContinue = effectivePrompt.length >= MIN_PROMPT_LENGTH;

  /**
   * Select a template card and seed the custom composer with its prompt.
   */
  function selectTemplate(id: string): void {
    const item = copy.items.find((t) => t.id === id);
    if (item === undefined) return;
    setSelectedId(id);
    setCustomPrompt(item.prompt);
    setError(null);
  }

  /**
   * Continue into the wizard when a valid prompt is present.
   */
  function handleContinue(): void {
    if (!canContinue) {
      setError(copy.emptyHint);
      return;
    }
    if (selected !== null) {
      onContinue({
        id: selected.id,
        appType: selected.appType,
        prompt: selected.prompt
      });
      return;
    }
    onContinue({
      id: 'custom',
      appType: '',
      prompt: customPrompt.trim()
    });
  }

  return (
    <div style={contentColumnStyle}>
      <p style={subStyle}>{copy.subtitle}</p>

      <div style={gridStyle} role="listbox" aria-label={copy.gridLabel}>
        {copy.items.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                selectTemplate(item.id);
              }}
              style={templateCardStyle(isSelected)}
            >
              <span style={templateTitleStyle}>
                {item.title}
                {isSelected ? (
                  <span style={selectedBadgeStyle} aria-label={copy.selected}>
                    ✓
                  </span>
                ) : null}
              </span>
              <span style={templateDescStyle}>{item.description}</span>
            </button>
          );
        })}
      </div>

      <div style={composerBlockStyle}>
        <label htmlFor="template-custom-prompt" style={labelStyle()}>
          {copy.orDescribe}
        </label>
        <textarea
          id="template-custom-prompt"
          name="customPrompt"
          rows={3}
          value={customPrompt}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setCustomPrompt(event.target.value);
            setSelectedId(null);
            setError(null);
          }}
          placeholder={copy.composerPlaceholder}
          style={fieldStyle()}
          aria-describedby="template-empty-hint"
        />
        <p id="template-empty-hint" style={hintStyle()}>
          {copy.composerLabel}
        </p>
      </div>

      <div style={chipsStyle} role="group" aria-label={copy.examplesLabel}>
        {en.chat.examples.map((example) => (
          <button
            key={example.title}
            type="button"
            style={chipStyle(false)}
            onClick={() => {
              setCustomPrompt(example.prompt);
              setSelectedId(null);
              setError(null);
            }}
          >
            {example.title}
          </button>
        ))}
      </div>

      {error !== null && (
        <p role="alert" style={{ color: theme.color.accent, fontSize: theme.type.scale[2], margin: 0 }}>
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}

      {!canContinue && error === null && (
        <p role="status" style={hintStyle()}>
          {copy.emptyHint}
        </p>
      )}

      <div style={actionsStyle}>
        <button type="button" style={buttonStyle(false)} onClick={onBack}>
          {copy.backToChat}
        </button>
        <button
          type="button"
          style={buttonStyle(true, !canContinue)}
          disabled={!canContinue}
          onClick={handleContinue}
        >
          {copy.continue}
        </button>
      </div>
    </div>
  );
}

const subStyle: CSSProperties = {
  margin: 0,
  color: theme.color.muted,
  fontSize: theme.type.scale[2],
  lineHeight: 1.45,
  maxWidth: '40rem'
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))',
  gap: theme.space.sm,
  width: '100%'
};

/**
 * Template card — selected state uses border weight + check, not color alone.
 */
function templateCardStyle(selected: boolean): CSSProperties {
  return {
    fontFamily: theme.type.family,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.xs,
    minHeight: theme.touch * 2,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    border: selected
      ? `2px solid ${theme.color.accent}`
      : `1px solid ${theme.color.border}`,
    background: selected ? theme.color.accentSoft : theme.color.surface,
    color: theme.color.text,
    cursor: 'pointer',
    boxShadow: theme.shadow.card,
    boxSizing: 'border-box'
  };
}

const templateTitleStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  fontWeight: 700,
  letterSpacing: '-0.01em',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.xs
};

const templateDescStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  color: theme.color.muted,
  lineHeight: 1.35
};

const selectedBadgeStyle: CSSProperties = {
  color: theme.color.accent,
  fontWeight: 700,
  fontSize: theme.type.scale[2]
};

const composerBlockStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs
};

const chipsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  alignItems: 'center',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)'
};
