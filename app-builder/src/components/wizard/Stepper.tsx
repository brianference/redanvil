import { en } from '../../i18n/en';
import { theme } from '../../theme';
import {
  progressTrackStyle,
  stepLabelStyle,
  stepperMetaStyle,
  stepperStyle,
  stepTitleStyle
} from './styles';

/**
 * Segmented step indicator with label + progress track (not color alone).
 *
 * @param props.step - Current wizard step (1–3).
 */
export function Stepper({ step }: { step: 1 | 2 | 3 }): JSX.Element {
  const copy = en.wizard;
  return (
    <div style={stepperStyle} aria-label={copy.stepOf(step)}>
      <div style={stepperMetaStyle}>
        <span style={stepLabelStyle}>{copy.stepOf(step)}</span>
        <span style={stepTitleStyle}>{copy.stepTitles[step - 1]}</span>
      </div>
      <div
        style={progressTrackStyle}
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={3}
      >
        {([1, 2, 3] as const).map((seg) => (
          <div
            key={seg}
            style={{
              flex: 1,
              height: 6,
              borderRadius: theme.radius.pill,
              background: seg <= step ? theme.color.progressFill : theme.color.progressTrack,
              opacity: seg < step ? 0.55 : 1
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
