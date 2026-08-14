import type { CSSProperties } from 'react';
import { SafeExternalLink } from '../../../../design-system/SafeExternalLink';
import { en } from '../../i18n/en';
import { theme } from '../../theme';
import type { Example } from '../../lib/examples';

export interface ExampleCardProps {
  /** Shipped example to render as a magazine card. */
  example: Example;
}

/**
 * Card-catalog unit: stacked device frames, title, stat chips, actions, then
 * a full "What it does" breakdown under the card face.
 */
export function ExampleCard({ example }: ExampleCardProps): JSX.Element {
  const copy = en.pages.examples;
  const front = example.screens[0];
  const back = example.screens[1] ?? example.screens[0];
  const stats = example.stats ?? [];

  return (
    <article className="ex-card" aria-labelledby={`ex-${example.slug}`} data-slug={example.slug}>
      <div className="ex-card__face">
        <div className="ex-card__stack" aria-hidden={false}>
          {front ? (
            <img
              className="ex-card__device ex-card__device--front"
              src={front.src}
              alt={front.alt}
              width={front.width}
              height={front.height}
              loading="lazy"
            />
          ) : null}
          {back && back.src !== front?.src ? (
            <img
              className="ex-card__device ex-card__device--back"
              src={back.src}
              alt={back.alt}
              width={back.width}
              height={back.height}
              loading="lazy"
            />
          ) : null}
        </div>

        <div className="ex-card__meta">
          {example.kicker ? (
            <p className="ex-card__kicker" style={kickerStyle}>
              {example.kicker}
            </p>
          ) : null}
          <h2 id={`ex-${example.slug}`} style={nameStyle}>
            {example.name}
          </h2>
          <p style={taglineStyle}>{example.tagline}</p>

          {stats.length > 0 ? (
            <ul className="ex-card__stats" aria-label={copy.statsLabel(example.name)}>
              {stats.map((stat) => (
                <li key={stat} className="ex-card__stat" style={statStyle}>
                  {stat}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="ex-card__actions">
            <SafeExternalLink
              href={example.liveUrl}
              className="ex-card__action ex-card__action--primary"
              style={primaryActionStyle}
            >
              {copy.viewLive}
            </SafeExternalLink>
            <SafeExternalLink
              href={example.repoUrl}
              className="ex-card__action ex-card__action--ghost"
              style={ghostActionStyle}
            >
              {copy.viewSource}
            </SafeExternalLink>
          </div>
        </div>
      </div>

      <section className="ex-card__does" aria-labelledby={`feat-${example.slug}`}>
        <h3 id={`feat-${example.slug}`} style={sectionHeadingStyle}>
          {copy.featuresHeading}
        </h3>
        <div className="ex-features">
          {example.features.map((group) => (
            <div key={group.area} className="ex-feature-group">
              <h4 style={groupHeadingStyle}>{group.area}</h4>
              <ul style={listStyle}>
                {group.items.map((item) => (
                  <li key={item} style={listItemStyle}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="ex-card__shipped" aria-labelledby={`app-${example.slug}`}>
        <h3 id={`app-${example.slug}`} style={sectionHeadingStyle}>
          {copy.stepApp}
        </h3>
        <p style={gateStyle}>{example.gate}</p>
      </section>

      <section className="ex-card__built" aria-labelledby={`built-${example.slug}`}>
        <h3 id={`built-${example.slug}`} style={builtHeadingStyle}>
          {copy.builtHeading}
        </h3>
        <div className="ex-card__built-grid">
          <div className="ex-card__panel" style={panelStyle}>
            <h4 style={panelTitleStyle}>{copy.stepPrompt}</h4>
            <blockquote style={quoteStyle}>{example.prompt}</blockquote>
            <dl style={answersStyle}>
              {example.answers.map((a) => (
                <div key={a.label} style={answerRowStyle}>
                  <dt style={dtStyle}>{a.label}</dt>
                  <dd style={ddStyle}>{a.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="ex-card__panel" style={panelStyle}>
            <h4 style={panelTitleStyle}>{copy.stepBrand}</h4>
            <p style={noteStyle}>{copy.brandNote}</p>
            <img
              src={example.logo}
              alt={copy.brandAlt(example.name)}
              width={180}
              height={180}
              loading="lazy"
              className="ex-logo"
            />
          </div>
          {example.reviewShot !== undefined ? (
            <div className="ex-card__panel" style={panelStyle}>
              <h4 style={panelTitleStyle}>{copy.stepPrd}</h4>
              <p style={noteStyle}>{copy.prdNote}</p>
              <img
                src={example.reviewShot}
                alt={copy.prdAlt(example.name)}
                loading="lazy"
                className="ex-shot"
              />
            </div>
          ) : null}
        </div>
      </section>
    </article>
  );
}

const kickerStyle: CSSProperties = {
  margin: 0,
  // 16px, not 14px. fe-type-floor measured this eyebrow at 14px on /examples;
  // uppercase with wide tracking reads smaller still, so it was the worst
  // offender on the page rather than a borderline one.
  fontSize: theme.type.scale[2],
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  // accentFg, not accent. The fill accent used as TEXT measured 3.86:1 on the
  // dark card surface (#d33b40 on #15151d) and failed AA. accentFg exists for
  // exactly this: the token's own comment says it is the text-on-surface accent
  // and may differ from the fill accent in dark mode.
  color: theme.color.accentFg,
  fontWeight: 700
};

const nameStyle: CSSProperties = {
  margin: `${theme.space.xs}px 0 0`,
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

const statStyle: CSSProperties = {
  // 16px, not 14px -- these stat pills carry real numbers ("4,162 airports")
  // and were under the body floor.
  fontSize: theme.type.scale[2],
  fontWeight: 600,
  padding: `${theme.space.xs}px ${theme.space.sm}px`,
  borderRadius: theme.radius.sm,
  background: theme.color.bg,
  border: `1px solid ${theme.color.border}`,
  color: theme.color.text,
  listStyle: 'none'
};

const primaryActionStyle: CSSProperties = {
  minHeight: theme.touch,
  display: 'inline-flex',
  alignItems: 'center',
  padding: `0 ${theme.space.md}px`,
  borderRadius: theme.radius.md,
  background: theme.color.accent,
  color: theme.color.textOnAccent,
  fontWeight: 650,
  fontSize: theme.type.scale[2],
  textDecoration: 'none'
};

const ghostActionStyle: CSSProperties = {
  minHeight: theme.touch,
  display: 'inline-flex',
  alignItems: 'center',
  padding: `0 ${theme.space.md}px`,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  color: theme.color.text,
  fontWeight: 650,
  fontSize: theme.type.scale[2],
  textDecoration: 'none'
};

const sectionHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[3],
  fontWeight: 650,
  color: theme.color.text
};

const groupHeadingStyle: CSSProperties = {
  margin: `0 0 ${theme.space.xs}px`,
  fontSize: theme.type.scale[2],
  fontWeight: 700,
  color: theme.color.text
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: theme.space.lg,
  color: theme.color.text,
  fontSize: theme.type.scale[2],
  lineHeight: 1.55
};

const listItemStyle: CSSProperties = {
  marginBottom: theme.space.xs
};

const gateStyle: CSSProperties = {
  margin: `${theme.space.sm}px 0 0`,
  fontSize: theme.type.scale[2],
  color: theme.color.muted,
  lineHeight: 1.55
};

const builtHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[2],
  fontWeight: 650,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: theme.color.muted
};

const panelStyle: CSSProperties = {
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  background: theme.color.surface,
  padding: theme.space.lg,
  minWidth: 0
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[3],
  fontWeight: 650,
  color: theme.color.text
};

// A prompt is arbitrary user text and one of these contains a bare 71-character
// URL (an almanac planting-calendar link). Normal wrapping finds no break
// opportunity inside it, so its min-content width was 348px in a 252px panel and
// the overflow propagated all the way up to <main> and the body.
const quoteStyle: CSSProperties = {
  margin: `${theme.space.md}px 0 0`,
  padding: theme.space.md,
  borderLeft: `3px solid ${theme.color.accent}`,
  background: theme.color.surfaceElevated,
  borderRadius: `0 ${theme.radius.sm}px ${theme.radius.sm}px 0`,
  fontSize: theme.type.scale[2],
  lineHeight: 1.6,
  color: theme.color.text,
  overflowWrap: 'anywhere',
  minWidth: 0
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
  paddingTop: theme.space.xs,
  minWidth: 0
};

// The answer values are transcribed from each app and carry URLs and slugs, so
// they wrap mid-token for the same reason the quote does.
const dtStyle: CSSProperties = { color: theme.color.muted, minWidth: 100, flexShrink: 0 };
const ddStyle: CSSProperties = {
  margin: 0,
  color: theme.color.text,
  fontWeight: 600,
  minWidth: 0,
  overflowWrap: 'anywhere'
};

const noteStyle: CSSProperties = {
  margin: `${theme.space.sm}px 0 ${theme.space.md}px`,
  fontSize: theme.type.scale[2],
  color: theme.color.muted,
  lineHeight: 1.55
};
