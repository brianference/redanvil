import type { CSSProperties } from 'react';
import { en } from '../../i18n/en';
import type { RunIteration } from '../../lib/summary';
import { theme } from '../../theme';
import { mutedTextStyle, StatusNote } from '../FeedStatus';
import { cardStyle, plainListStyle, sectionTitleStyle, smallMutedStyle } from './styles';

const iterationItemStyle: CSSProperties = {
  borderBottom: `1px solid ${theme.color.border}`,
  padding: `${theme.space.sm}px 0`,
  listStyle: 'none'
};

const iterationLineStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: theme.space.sm
};

const iterationIndexStyle: CSSProperties = { fontWeight: 600 };

const blockerListStyle: CSSProperties = {
  margin: `${theme.space.xs}px 0 0`,
  paddingLeft: theme.space.lg,
  color: theme.color.text,
  fontSize: theme.type.scale[1]
};

const summaryLineStyle: CSSProperties = {
  ...smallMutedStyle,
  marginBottom: theme.space.sm
};

/**
 * One iteration row: index, score, and blockers that failed that pass.
 *
 * @returns The iteration list item.
 */
function IterationItem({ iteration }: { iteration: RunIteration }): JSX.Element {
  return (
    <li style={iterationItemStyle}>
      <div style={iterationLineStyle}>
        <span style={iterationIndexStyle}>{en.runDetail.iterationIndex(iteration.index)}</span>
        <span style={mutedTextStyle}>{en.runDetail.iterationScore(iteration.score)}</span>
      </div>
      {iteration.blockers.length > 0 ? (
        <ul style={blockerListStyle}>
          {iteration.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : (
        <p style={smallMutedStyle}>{en.runDetail.noBlockers}</p>
      )}
    </li>
  );
}

/**
 * Iteration history: proof the score was earned over N passes with blockers.
 *
 * @returns The iterations section, or its explicit empty note.
 */
export function IterationHistory({
  iterations
}: {
  iterations: readonly RunIteration[];
}): JSX.Element {
  return (
    <section style={cardStyle} aria-labelledby="run-iterations-heading">
      <h2 id="run-iterations-heading" style={sectionTitleStyle}>
        {en.runDetail.iterationsHeading}
      </h2>
      {iterations.length === 0 ? (
        <StatusNote>{en.runDetail.iterationsEmpty}</StatusNote>
      ) : (
        <>
          <p style={summaryLineStyle}>{en.runDetail.iterationsSummary(iterations.length)}</p>
          <ol style={plainListStyle}>
            {iterations.map((iteration) => (
              <IterationItem key={iteration.index} iteration={iteration} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
