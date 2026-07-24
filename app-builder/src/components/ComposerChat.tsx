import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type CSSProperties,
  type ReactNode
} from 'react';
import { en } from '../i18n/en';
import { MIN_PROMPT_LENGTH } from '../lib/job';
import { theme } from '../theme';
import { buttonStyle, chipStyle, fieldStyle, hintStyle } from './ui';

export interface ComposerChatProps {
  /** Current draft prompt (controlled). */
  prompt: string;
  /** Update the draft prompt. */
  onPromptChange: (prompt: string) => void;
  /** Called when the user sends a valid description. */
  onSend: (prompt: string) => void;
  /** Navigate to the template gallery. */
  onBrowseTemplates: () => void;
}

/**
 * Conversational home: agent greeting, example chips, and a warm composer
 * (Grok v1 base + Claude variation 2 chat feel). Uses the approved logo mark
 * for the agent avatar — no new brand art.
 */
export function ComposerChat({
  prompt,
  onPromptChange,
  onSend,
  onBrowseTemplates
}: ComposerChatProps): JSX.Element {
  const copy = en.chat;
  const [showTooShort, setShowTooShort] = useState(false);
  const ready = prompt.trim().length >= MIN_PROMPT_LENGTH;

  /**
   * Submit the composer when the prompt meets the minimum length.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!ready) {
      setShowTooShort(true);
      return;
    }
    setShowTooShort(false);
    onSend(prompt.trim());
  }

  /**
   * Fill the composer from an example chip and clear validation.
   */
  function applyExample(examplePrompt: string): void {
    onPromptChange(examplePrompt);
    setShowTooShort(false);
  }

  return (
    <div style={rootStyle}>
      <div style={threadStyle} role="log" aria-live="polite" aria-relevant="additions">
        <AgentRow>
          <div style={bubbleStyle}>
            <p style={{ margin: 0, fontSize: theme.type.scale[2], lineHeight: 1.45 }}>
              {copy.greetingBody}
            </p>
            <p style={{ ...metaStyle, marginTop: theme.space.sm }}>{copy.greetingMeta}</p>
          </div>
        </AgentRow>

        <AgentRow>
          <div style={bubbleStyle}>
            <p style={{ margin: 0, fontSize: theme.type.scale[2], lineHeight: 1.45 }}>
              {copy.starterLine}
            </p>
          </div>
        </AgentRow>

        <div style={trustRowStyle} aria-label={copy.trustStatusLabel}>
          <span style={trustPillStyle(true)}>
            <span aria-hidden="true">✓</span>
            {copy.trustOnline}
          </span>
          <span style={trustPillStyle(false)}>
            <span aria-hidden="true">◉</span>
            {copy.trustPrivate}
          </span>
        </div>

        <div
          style={{ ...chipsWrapStyle, paddingLeft: 42 }}
          role="list"
          aria-label={copy.examplesLabel}
        >
          {copy.examples.map((example) => (
            <button
              key={example.title}
              type="button"
              role="listitem"
              style={exampleChipStyle}
              onClick={() => {
                applyExample(example.prompt);
              }}
            >
              <strong style={exampleTitleStyle}>{example.title}</strong>
              <span style={exampleDescStyle}>{example.prompt}</span>
            </button>
          ))}
        </div>

        {prompt.trim().length === 0 && (
          <p style={{ ...hintStyle(), paddingLeft: 42 }} role="status">
            {copy.emptyHint}
          </p>
        )}
      </div>

      <div style={composerShellStyle}>
        <form onSubmit={handleSubmit} aria-label={copy.composerLabel} style={composerFormStyle}>
          <label htmlFor="composer-prompt" style={visuallyHiddenStyle}>
            {copy.composerLabel}
          </label>
          <textarea
            id="composer-prompt"
            name="prompt"
            rows={3}
            value={prompt}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              onPromptChange(event.target.value);
              if (showTooShort && event.target.value.trim().length >= MIN_PROMPT_LENGTH) {
                setShowTooShort(false);
              }
            }}
            placeholder={copy.composerPlaceholder}
            style={{ ...fieldStyle(), minHeight: 88, resize: 'none' }}
            aria-describedby="composer-hint"
            aria-invalid={showTooShort}
          />
          <div style={composerFooterStyle}>
            <p id="composer-hint" style={{ ...hintStyle(), margin: 0, flex: 1 }}>
              {showTooShort ? copy.tooShort(MIN_PROMPT_LENGTH) : copy.composerHint}
            </p>
            <button
              type="submit"
              style={buttonStyle(true, !ready)}
              disabled={!ready}
              aria-label={copy.sendAria}
            >
              {copy.sendAria}
            </button>
          </div>
        </form>
        <button
          type="button"
          onClick={onBrowseTemplates}
          style={{
            ...buttonStyle(false),
            width: '100%',
            marginTop: theme.space.sm
          }}
        >
          {copy.browseTemplates}
        </button>
      </div>
    </div>
  );
}

/**
 * Agent message row with the square anvil mark as avatar (legible in both themes).
 */
function AgentRow({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div style={rowStyle}>
      <div style={avatarStyle} aria-hidden="true">
        <img
          src="/logo-mark.png"
          alt=""
          width={28}
          height={28}
          style={{
            width: 28,
            height: 28,
            borderRadius: theme.radius.sm,
            objectFit: 'contain'
          }}
        />
      </div>
      <div style={bubbleStackStyle}>
        <span style={senderStyle}>{en.chat.agentName}</span>
        {children}
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
  width: '100%',
  maxWidth: '40rem'
};

const threadStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14
};

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-end',
  maxWidth: '100%'
};

const avatarStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.color.accentSoft,
  border: `1px solid ${theme.color.border}`,
  overflow: 'hidden'
};

const bubbleStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
  maxWidth: 'calc(100% - 42px)'
};

const senderStyle: CSSProperties = {
  fontSize: theme.type.scale[0],
  fontWeight: 600,
  color: theme.color.muted,
  paddingLeft: 4
};

const bubbleStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 18,
  borderBottomLeftRadius: 6,
  fontSize: theme.type.scale[2],
  lineHeight: 1.45,
  color: theme.color.text,
  background: theme.color.surfaceElevated,
  border: `1px solid ${theme.color.border}`,
  boxShadow: theme.shadow.card,
  wordBreak: 'break-word',
  overflowWrap: 'anywhere' as const
};

const metaStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  color: theme.color.muted,
  lineHeight: 1.35,
  margin: 0
};

const trustRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  paddingLeft: 42
};

/**
 * Trust / status pill — icon glyph + text so state is not color-only.
 */
function trustPillStyle(online: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    padding: '4px 12px',
    borderRadius: theme.radius.pill,
    border: `1px solid ${online ? theme.color.success : theme.color.border}`,
    background: online
      ? `color-mix(in srgb, ${theme.color.successSoft} 70%, ${theme.color.surface})`
      : theme.color.surface,
    fontSize: theme.type.scale[0],
    fontWeight: 600,
    color: online ? theme.color.text : theme.color.muted
  };
}

const chipsWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flexWrap: 'nowrap',
  gap: 10,
  width: '100%',
  maxWidth: '100%'
};

/**
 * Example row: bold label on its own line, description below — never inline-crowded.
 */
const exampleChipStyle: CSSProperties = {
  ...chipStyle(false),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  gap: 4,
  width: '100%',
  maxWidth: '100%',
  borderRadius: 14,
  padding: '12px 14px',
  minHeight: theme.touch,
  whiteSpace: 'normal' as const,
  boxShadow: theme.shadow.card
};

const exampleTitleStyle: CSSProperties = {
  display: 'block',
  fontWeight: 650,
  color: theme.color.text,
  lineHeight: 1.3,
  fontSize: theme.type.scale[2]
};

const exampleDescStyle: CSSProperties = {
  display: 'block',
  fontWeight: 400,
  color: theme.color.muted,
  lineHeight: 1.4,
  fontSize: theme.type.scale[2],
  wordBreak: 'break-word',
  overflowWrap: 'anywhere' as const
};

/**
 * Composer + template CTA in normal document flow (not sticky) so it never
 * paints over the agent thread at narrow widths (fe-responsive-375).
 */
const composerShellStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  marginTop: theme.space.md,
  paddingTop: theme.space.md,
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  borderTop: `1px solid ${theme.color.border}`,
  background: `color-mix(in srgb, ${theme.color.bg} 92%, transparent)`
};

const composerFormStyle: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 16,
  padding: 14,
  boxShadow: theme.shadow.composer,
  display: 'flex',
  flexDirection: 'column',
  gap: 10
};

const composerFooterStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.sm
};

const visuallyHiddenStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0
};
