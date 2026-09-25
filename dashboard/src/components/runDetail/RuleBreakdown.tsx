import type { CSSProperties } from 'react';
import { en } from '../../i18n/en';
import { groupRulesByLane, type RunRule } from '../../lib/summary';
import { theme } from '../../theme';
import { StatusBadge } from '../StatusBadge';
import { cardStyle, emptyNoteStyle, plainListStyle, sectionTitleStyle } from './styles';

const ruleRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  padding: `${theme.space.xs}px 0`,
  borderBottom: `1px solid ${theme.color.border}`,
  listStyle: 'none',
  fontSize: theme.type.scale[2]
};

// No font stack here: <code> is monospace by default, and the theme defines no
// monospace family to restate.
const ruleIdStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  wordBreak: 'break-word'
};

const laneGridStyle: CSSProperties = {
  display: 'grid',
  gap: theme.space.lg
};

const laneHeadingStyle: CSSProperties = {
  margin: `0 0 ${theme.space.sm}px`,
  fontSize: theme.type.scale[2],
  fontWeight: 600,
  color: theme.color.muted
};

/**
 * Single rule row with non-color PASS/FAIL marker.
 *
 * @returns The rule list item.
 */
function RuleRow({ rule }: { rule: RunRule }): JSX.Element {
  return (
    <li style={ruleRowStyle}>
      <code style={ruleIdStyle}>{rule.ruleId}</code>
      <StatusBadge passed={rule.passed} />
    </li>
  );
}

/**
 * Per-rule breakdown grouped by lane prefix — the gate evidence.
 *
 * @returns The rules section, or its explicit empty note.
 */
export function RuleBreakdown({ rules }: { rules: readonly RunRule[] }): JSX.Element {
  return (
    <section style={cardStyle} aria-labelledby="run-rules-heading">
      <h2 id="run-rules-heading" style={sectionTitleStyle}>
        {en.runDetail.rulesHeading}
      </h2>
      {rules.length === 0 ? (
        <p role="status" style={emptyNoteStyle}>
          {en.runDetail.rulesEmpty}
        </p>
      ) : (
        <div style={laneGridStyle}>
          {groupRulesByLane(rules).map((group) => (
            <div key={group.lane}>
              <h3 style={laneHeadingStyle}>{en.runDetail.laneHeading(group.lane)}</h3>
              <ul style={plainListStyle}>
                {group.rules.map((rule) => (
                  <RuleRow key={rule.ruleId} rule={rule} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
