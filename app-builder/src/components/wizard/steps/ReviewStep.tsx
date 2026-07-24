import type { EstimateResult } from '../../../lib/estimate';
import {
  MIN_PROMPT_LENGTH,
  type BuildJob,
  type WizardAnswers
} from '../../../lib/job';
import { en } from '../../../i18n/en';
import { theme } from '../../../theme';
import { errorBannerStyle, statusBannerStyle } from '../../ui';
import { reviewAnswerRows } from '../reviewRows';
import { estimateBoxStyle, fieldLabelStyle, reviewListStyle } from '../styles';

/** Client-side state for the review-step submit request. */
export type SubmitUiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; job: BuildJob };

export interface ReviewStepProps {
  /** Controlled wizard answers. */
  value: WizardAnswers;
  /** Token / iteration estimate for the current answers. */
  cost: EstimateResult;
  /** Whether the prompt meets the minimum length. */
  promptReady: boolean;
  /** Whether app type is non-empty. */
  appTypeReady: boolean;
  /** Submit request UI state. */
  submitState: SubmitUiState;
}

/**
 * One review definition row (term + detail).
 *
 * @param props.term - Localized field label.
 * @param props.detail - Human-readable answer value.
 */
function ReviewRow({ term, detail }: { term: string; detail: string }): JSX.Element {
  return (
    <div style={{ marginBottom: theme.space.sm }}>
      <dt
        style={{
          fontSize: theme.type.scale[0],
          fontWeight: 600,
          color: theme.color.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          margin: 0
        }}
      >
        {term}
      </dt>
      <dd
        style={{
          margin: `${theme.space.xs}px 0 0`,
          fontSize: theme.type.scale[2],
          color: theme.color.text,
          wordBreak: 'break-word'
        }}
      >
        {detail}
      </dd>
    </div>
  );
}

/**
 * Step 3 — review derived rows, estimate, and submit status banners.
 * Rows come from {@link reviewAnswerRows} so the unit test guards the real UI path.
 *
 * @param props - Answers, estimate, readiness flags, and submit state.
 */
export function ReviewStep({
  value,
  cost,
  promptReady,
  appTypeReady,
  submitState
}: ReviewStepProps): JSX.Element {
  const copy = en.wizard;
  const rows = reviewAnswerRows(value);

  return (
    <div>
      <p id="wizard-q-3" style={fieldLabelStyle}>
        {copy.reviewHeading}
      </p>
      <dl style={reviewListStyle}>
        {rows.map((row) => (
          <ReviewRow key={row.term} term={row.term} detail={row.detail} />
        ))}
      </dl>
      <div role="status" aria-live="polite" style={estimateBoxStyle}>
        <p style={{ margin: 0, fontSize: theme.type.scale[2] }}>
          {copy.estimatedIterations(cost.iterations)}
        </p>
        <p style={{ margin: `${theme.space.xs}px 0 0`, fontSize: theme.type.scale[2] }}>
          {copy.estimatedTokens(cost.tokens.toLocaleString())}
        </p>
        <p
          style={{
            margin: `${theme.space.xs}px 0 0`,
            fontSize: theme.type.scale[1],
            color: theme.color.muted
          }}
        >
          {copy.confidence(cost.confidence)}
        </p>
      </div>
      {!promptReady && (
        <div role="alert" style={{ ...errorBannerStyle(), marginTop: theme.space.md }}>
          <span aria-hidden="true">!</span>
          <span>{copy.promptTooShort(MIN_PROMPT_LENGTH)}</span>
        </div>
      )}
      {promptReady && !appTypeReady && (
        <div role="alert" style={{ ...errorBannerStyle(), marginTop: theme.space.md }}>
          <span aria-hidden="true">!</span>
          <span>{copy.appTypeRequired}</span>
        </div>
      )}
      {submitState.status === 'loading' && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          style={{ ...statusBannerStyle(), marginTop: theme.space.md }}
        >
          <span aria-hidden="true">…</span>
          <span>{copy.submittingStatus}</span>
        </div>
      )}
      {submitState.status === 'error' && (
        <div role="alert" style={{ ...errorBannerStyle(), marginTop: theme.space.md }}>
          <span aria-hidden="true">!</span>
          <span>{submitState.message}</span>
        </div>
      )}
      {submitState.status === 'success' && (
        <div
          role="status"
          aria-live="polite"
          style={{ ...statusBannerStyle(), marginTop: theme.space.md }}
        >
          <span aria-hidden="true">✓</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {copy.jobReadyHeading(submitState.job.slug)}
            </p>
            <p
              style={{
                margin: `${theme.space.xs}px 0 0`,
                color: theme.color.muted,
                fontSize: theme.type.scale[1]
              }}
            >
              {copy.jobMeta(submitState.job.targetType, submitState.job.threshold)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
