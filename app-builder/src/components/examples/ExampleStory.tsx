import type { CSSProperties } from 'react';
import { en } from '../../i18n/en';
import { theme } from '../../theme';
import type { Example } from '../../lib/examples';

export interface ExampleStoryProps {
  /** The example to render. */
  example: Example;
}

/**
 * One example told in order: the prompt that was typed, the PRD the builder
 * produced from it, and the app that shipped.
 *
 * The phone strip deliberately borrows the App Store's screenshot-gallery
 * shape — a caption above each device, scrolled horizontally — because that is
 * the format people already read when judging whether an app is any good.
 *
 * Layout lives in `examples.css` so media queries can lift it; only per-token
 * colour and spacing are set here (R14 forbids an inline width cap).
 */
export function ExampleStory({ example }: ExampleStoryProps): JSX.Element {
  const copy = en.pages.examples;

  return (
    <article className="ex-story" aria-labelledby={`ex-${example.slug}`}>
      <header className="ex-head">
        <h2 id={`ex-${example.slug}`} style={nameStyle}>
          {example.name}
        </h2>
        <p style={taglineStyle}>{example.tagline}</p>
        <a href={example.liveUrl} rel="noopener noreferrer" style={liveStyle}>
          {copy.viewLive}
        </a>
      </header>

      <div className="ex-grid">
        <section aria-labelledby={`prompt-${example.slug}`} style={panelStyle}>
          <h3 id={`prompt-${example.slug}`} style={stepStyle}>
            <span style={numStyle}>1</span>
            {copy.stepPrompt}
          </h3>
          <blockquote style={quoteStyle}>{example.prompt}</blockquote>
          <dl style={answersStyle}>
            {example.answers.map((a) => (
              <div key={a.label} style={answerRowStyle}>
                <dt style={dtStyle}>{a.label}</dt>
                <dd style={ddStyle}>{a.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby={`prd-${example.slug}`} style={panelStyle}>
          <h3 id={`prd-${example.slug}`} style={stepStyle}>
            <span style={numStyle}>2</span>
            {copy.stepPrd}
          </h3>
          <p style={noteStyle}>{copy.prdNote}</p>
          <img
            src={example.reviewShot}
            alt={copy.prdAlt(example.name)}
            loading="lazy"
            className="ex-shot"
          />
        </section>
      </div>

      <section aria-labelledby={`app-${example.slug}`}>
        <h3 id={`app-${example.slug}`} style={stepStyle}>
          <span style={numStyle}>3</span>
          {copy.stepApp}
        </h3>
        <p style={noteStyle}>{example.gate}</p>
        <ul className="ex-screens" aria-label={copy.screensLabel(example.name)}>
          {example.screens.map((s) => (
            <li key={s.src} className="ex-screen">
              <p style={captionStyle}>{s.caption}</p>
              <img src={s.src} alt={s.alt} loading="lazy" className="ex-phone" />
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

const nameStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[4],
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: theme.color.text
};

const taglineStyle: CSSProperties = {
  margin: `${theme.space.xs}px 0 0`,
  fontSize: theme.type.scale[2],
  color: theme.color.muted,
  lineHeight: 1.5
};

const liveStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: theme.touch,
  marginTop: theme.space.sm,
  color: theme.color.accent,
  fontWeight: 600,
  fontSize: theme.type.scale[2]
};

const panelStyle: CSSProperties = {
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  background: theme.color.surface,
  padding: theme.space.lg,
  minWidth: 0
};

const stepStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  margin: 0,
  fontSize: theme.type.scale[3],
  fontWeight: 650,
  color: theme.color.text
};

const numStyle: CSSProperties = {
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

const quoteStyle: CSSProperties = {
  margin: `${theme.space.md}px 0 0`,
  padding: `${theme.space.md}px ${theme.space.md}px`,
  borderLeft: `3px solid ${theme.color.accent}`,
  background: theme.color.surfaceElevated,
  borderRadius: `0 ${theme.radius.sm}px ${theme.radius.sm}px 0`,
  fontSize: theme.type.scale[2],
  lineHeight: 1.6,
  color: theme.color.text
};

const answersStyle: CSSProperties = {
  margin: `${theme.space.md}px 0 0`,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs
};

const answerRowStyle: CSSProperties = {
  display: 'flex',
  gap: theme.space.sm,
  fontSize: theme.type.scale[2],
  borderTop: `1px solid ${theme.color.border}`,
  paddingTop: theme.space.xs
};

const dtStyle: CSSProperties = { color: theme.color.muted, minWidth: 120 };
const ddStyle: CSSProperties = { margin: 0, color: theme.color.text, fontWeight: 600 };

const noteStyle: CSSProperties = {
  margin: `${theme.space.sm}px 0 ${theme.space.md}px`,
  fontSize: theme.type.scale[2],
  color: theme.color.muted,
  lineHeight: 1.55
};

const captionStyle: CSSProperties = {
  margin: `0 0 ${theme.space.sm}px`,
  fontSize: theme.type.scale[3],
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: theme.color.text,
  lineHeight: 1.25
};
