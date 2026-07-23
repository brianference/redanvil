import { useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
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
 * Simple line-icon glyph for a template archetype (inline SVG, theme via currentColor).
 */
function TemplateIcon({ id }: { id: string }): JSX.Element {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    'aria-hidden': true as const
  };
  let path: ReactNode;
  switch (id) {
    case 'saas':
      path = (
        <>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M8 20h8M12 18v2" />
        </>
      );
      break;
    case 'marketplace':
      path = (
        <>
          <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case 'internal':
      path = (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      );
      break;
    case 'mobile':
      path = (
        <>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </>
      );
      break;
    case 'api':
      path = (
        <>
          <path d="M4 8h6v8H4zM14 4h6v16h-6z" />
          <path d="M10 12h4" />
        </>
      );
      break;
    default:
      path = <circle cx="12" cy="12" r="8" />;
  }
  return <svg {...common}>{path}</svg>;
}

/**
 * Template gallery: card grid of app archetypes plus an “or describe your own”
 * path (Grok v3). Icons, 2-col cards, selection check, divider, composer CTAs.
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

      <div style={sectionLabelStyle}>
        <h2 style={sectionTitleStyle}>{copy.sectionLabel}</h2>
        <span style={sectionMetaStyle}>{copy.sectionCount(copy.items.length)}</span>
      </div>

      <div style={gridStyle} role="listbox" aria-label={copy.gridLabel}>
        {copy.items.map((item, index) => {
          const isSelected = selectedId === item.id;
          const isWide = index === copy.items.length - 1 && copy.items.length % 2 === 1;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                selectTemplate(item.id);
              }}
              style={templateCardStyle(isSelected, isWide)}
            >
              <span style={iconWellStyle(isSelected)} aria-hidden="true">
                <TemplateIcon id={item.id} />
              </span>
              <span style={templateBodyStyle}>
                <span style={templateTitleStyle}>{item.title}</span>
                <span style={templateDescStyle}>{item.description}</span>
              </span>
              {isSelected ? (
                <span style={checkBadgeStyle} aria-label={copy.selected}>
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={orDividerStyle} role="separator">
        <span style={orDividerLineStyle} aria-hidden="true" />
        <span>{copy.orDescribe}</span>
        <span style={orDividerLineStyle} aria-hidden="true" />
      </div>

      <div style={composerBlockStyle}>
        <label htmlFor="template-custom-prompt" style={labelStyle()}>
          {copy.composerLabel}
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
        <p
          role="alert"
          style={{ color: theme.color.accent, fontSize: theme.type.scale[2], margin: 0 }}
        >
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}

      {!canContinue && error === null && (
        <div role="status" style={emptyStateStyle}>
          <p style={{ margin: 0, fontWeight: 650, fontSize: theme.type.scale[2] }}>
            {copy.emptyTitle}
          </p>
          <p id="template-empty-hint" style={{ ...hintStyle(), margin: `${theme.space.xs}px 0 0` }}>
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

const sectionLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  marginBottom: 2
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[1],
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.color.muted
};

const sectionMetaStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  color: theme.color.muted
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  width: '100%'
};

/**
 * Template card — selected state uses border + soft fill + check, not color alone.
 */
function templateCardStyle(selected: boolean, wide: boolean): CSSProperties {
  return {
    fontFamily: theme.type.family,
    position: 'relative',
    textAlign: 'left',
    display: 'flex',
    flexDirection: wide ? 'row' : 'column',
    alignItems: wide ? 'center' : 'flex-start',
    gap: wide ? 12 : 8,
    minHeight: wide ? 72 : 108,
    padding: wide ? '12px 14px' : '14px 12px 12px',
    borderRadius: 14,
    border: selected ? `1.5px solid ${theme.color.accent}` : `1.5px solid ${theme.color.border}`,
    background: selected ? theme.color.accentSoft : theme.color.surface,
    color: theme.color.text,
    cursor: 'pointer',
    boxShadow: selected
      ? `0 0 0 3px color-mix(in srgb, ${theme.color.accent} 22%, transparent)`
      : theme.shadow.card,
    boxSizing: 'border-box',
    gridColumn: wide ? '1 / -1' : undefined
  };
}

/**
 * Icon well beside or above the template title.
 */
function iconWellStyle(selected: boolean): CSSProperties {
  return {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: selected ? theme.color.surface : theme.color.surfaceElevated,
    color: theme.color.accent,
    border: selected ? '1px solid transparent' : `1px solid ${theme.color.border}`
  };
}

const templateBodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  paddingRight: 20
};

const templateTitleStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  fontWeight: 700,
  lineHeight: 1.25,
  color: theme.color.text
};

const templateDescStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  color: theme.color.muted,
  lineHeight: 1.35
};

const checkBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: theme.color.accent,
  color: theme.color.textOnAccent,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: theme.type.scale[1],
  fontWeight: 700
};

const orDividerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  color: theme.color.muted,
  fontSize: theme.type.scale[1],
  fontWeight: 600
};

const orDividerLineStyle: CSSProperties = {
  flex: 1,
  height: 1,
  background: theme.color.border
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

const emptyStateStyle: CSSProperties = {
  padding: theme.space.md,
  borderRadius: theme.radius.md,
  border: `1px dashed ${theme.color.borderStrong}`,
  background: theme.color.bg
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  alignItems: 'center',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)'
};
