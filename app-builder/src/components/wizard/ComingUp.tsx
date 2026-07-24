import { en } from '../../i18n/en';
import { theme } from '../../theme';
import {
  upcomingHeadingStyle,
  upcomingItemStyle,
  upcomingListStyle,
  upcomingNumStyle,
  upcomingStyle
} from './styles';

/**
 * Pillbox step list — numbered tiles for each wizard step.
 * Current step uses accent border + filled number (not color alone).
 *
 * @param props.step - Current wizard step (1–3).
 */
export function ComingUp({ step }: { step: 1 | 2 | 3 }): JSX.Element {
  const copy = en.wizard;
  return (
    <div style={upcomingStyle} aria-label={copy.comingUp}>
      <h2 style={upcomingHeadingStyle}>{copy.comingUp}</h2>
      <ol style={upcomingListStyle}>
        {copy.stepTitles.map((title, index) => {
          const n = (index + 1) as 1 | 2 | 3;
          const isCurrent = n === step;
          const isDone = n < step;
          return (
            <li
              key={title}
              style={{
                ...upcomingItemStyle,
                borderColor: isCurrent ? theme.color.accent : theme.color.border,
                color: isCurrent || isDone ? theme.color.text : theme.color.muted
              }}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                style={{
                  ...upcomingNumStyle,
                  background: isCurrent
                    ? theme.color.accent
                    : isDone
                      ? theme.color.successSoft
                      : theme.color.chipBg,
                  color: isCurrent
                    ? theme.color.textOnAccent
                    : isDone
                      ? theme.color.success
                      : theme.color.muted
                }}
                aria-hidden="true"
              >
                {isDone ? '✓' : n}
              </span>
              <span style={{ fontWeight: isCurrent ? 650 : 500 }}>
                {title}
                {isDone ? (
                  <span style={{ color: theme.color.muted, fontWeight: 500 }}>
                    {' '}
                    · {copy.stepDone}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
