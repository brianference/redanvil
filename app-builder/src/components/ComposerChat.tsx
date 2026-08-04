import { useState, type ChangeEvent, type FormEvent, type CSSProperties } from 'react';
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
 * (Grok v1 base + Claude variation 2 chat feel).
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
    <div className="ra-chat" style={rootStyle}>
      <div
        className="ra-chat-thread"
        style={threadStyle}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {/* Instructions, presented as instructions.
            These were two speech bubbles labelled "RedAnvil", which read as a
            conversation the user had already had — reported as "it is unclear
            that the left are instructions, they look like chat bubbles". A
            numbered list says what to do; a bubble implies someone said it.
            data-measure=hero marks this primary onboarding band for qa-visual
            (same role as dashboard's KPI strip) — no visible style change. */}
        <section aria-labelledby="how-heading" style={howPanelStyle} data-measure="hero">
          <h2 id="how-heading" style={howHeadingStyle}>
            {copy.howHeading}
          </h2>
          <p style={howLeadStyle}>{copy.greetingBody}</p>
          <ol style={stepListStyle}>
            {copy.steps.map((step, index) => (
              <li key={step.title} style={stepItemStyle}>
                <span aria-hidden="true" style={stepNumberStyle}>
                  {index + 1}
                </span>
                <span style={stepTextStyle}>
                  <strong style={stepTitleStyle}>{step.title}</strong>
                  <span style={stepBodyStyle}>{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <p style={howMetaStyle}>{copy.greetingMeta}</p>
        </section>

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

        <h2 style={startersHeadingStyle}>{copy.startersHeading}</h2>

        <div style={chipsWrapStyle} role="list" aria-label={copy.examplesLabel}>
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
          <p style={{ ...hintStyle() }} role="status">
            {copy.emptyHint}
          </p>
        )}
      </div>

      <div className="ra-chat-composer" data-testid="wizard-composer">
        {/* Above the composer, not below it. A template is an alternative to
            typing a description, so it has to be visible BEFORE the user starts
            typing one — under the panel it only ever got read after the work it
            was meant to save had already been done. */}
        <button
          type="button"
          onClick={onBrowseTemplates}
          style={{ ...buttonStyle(false), width: '100%', marginBottom: theme.space.md }}
        >
          {copy.browseTemplates}
        </button>

        <div style={composerShellStyle}>
          {/* A titled panel, not a bare textarea. The right side is where the
            user acts, so it should look like the place to act — reported as
            "make it look more like an interactive chat window and taller". */}
          <div style={chatHeaderStyle}>
            <h2 style={chatTitleStyle}>{copy.chatTitle}</h2>
            <p style={chatSubtitleStyle}>{copy.chatSubtitle}</p>
          </div>
          <form onSubmit={handleSubmit} aria-label={copy.composerLabel} style={composerFormStyle}>
            <label htmlFor="composer-prompt" style={visuallyHiddenStyle}>
              {copy.composerLabel}
            </label>
            <textarea
              id="composer-prompt"
              name="prompt"
              rows={8}
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
        </div>
      </div>
    </div>
  );
}

// AgentRow and its bubble/sender styles are gone. They rendered the left column
// as a conversation the user had supposedly already had, which is exactly the
// confusion reported: instructions that look like chat. The instructions are a
// numbered list now, and the only chat-shaped thing on the page is the panel
// you actually type into.

// Layout for `.ra-chat` lives ENTIRELY in CSS (see shell/styles.ts). Not one
// property of it belongs here: an inline `display` or `maxWidth` beats a media
// query outright, so the desktop two-column rule would be dead on arrival. That
// is exactly what happened on the first attempt — the grid was declared and the
// inline `display: flex` kept the composer stacked under the thread.
const rootStyle: CSSProperties = {
  width: '100%'
};

const threadStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14
};

const trustRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm
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
// The chat panel: one bordered surface containing its header and its form, so
// it reads as a window you type into rather than a stray field floating beside
// the instructions. Height comes from the textarea and from `.ra-chat-composer`
// in CSS, never from an inline cap.
const composerShellStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  overflow: 'hidden',
  background: theme.color.surface,
  boxShadow: theme.shadow.card
};

const composerFormStyle: CSSProperties = {
  background: theme.color.surface,
  border: 'none',
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

// --- Instructions panel (left) ------------------------------------------------
// Deliberately NOT bubble-shaped. A bubble says "someone said this to you"; a
// numbered list says "do these things".
const howPanelStyle: CSSProperties = {
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  background: theme.color.surface,
  padding: theme.space.lg
};

const howHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[3],
  fontWeight: 650,
  color: theme.color.text
};

const howLeadStyle: CSSProperties = {
  margin: `${theme.space.sm}px 0 0`,
  fontSize: theme.type.scale[2],
  lineHeight: 1.55,
  color: theme.color.muted
};

const stepListStyle: CSSProperties = {
  listStyle: 'none',
  margin: `${theme.space.lg}px 0 0`,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md
};

const stepItemStyle: CSSProperties = {
  display: 'flex',
  gap: theme.space.md,
  alignItems: 'flex-start'
};

const stepNumberStyle: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: theme.type.scale[1],
  fontWeight: 700,
  color: theme.color.textOnAccent,
  background: theme.color.accent
};

const stepTextStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0
};

const stepTitleStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  fontWeight: 650,
  color: theme.color.text
};

const stepBodyStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  lineHeight: 1.5,
  color: theme.color.muted
};

const howMetaStyle: CSSProperties = {
  margin: `${theme.space.lg}px 0 0`,
  paddingTop: theme.space.md,
  borderTop: `1px solid ${theme.color.border}`,
  fontSize: theme.type.scale[2],
  color: theme.color.muted
};

const startersHeadingStyle: CSSProperties = {
  margin: `${theme.space.sm}px 0 0`,
  fontSize: theme.type.scale[2],
  fontWeight: 650,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: theme.color.muted
};

// --- Chat window (right) -------------------------------------------------------
const chatHeaderStyle: CSSProperties = {
  padding: `${theme.space.md}px ${theme.space.lg}px`,
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.color.surfaceElevated
};

const chatTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[2],
  fontWeight: 650,
  color: theme.color.text
};

const chatSubtitleStyle: CSSProperties = {
  margin: '2px 0 0',
  fontSize: theme.type.scale[2],
  color: theme.color.muted
};
