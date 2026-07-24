import { useState, type ChangeEvent, type FormEvent, type CSSProperties } from 'react';
import { estimate } from '../lib/estimate';
import {
  countEntities,
  isPromptReady,
  isAppTypeReady,
  canForgePrd,
  MIN_PROMPT_LENGTH,
  type BuildJob,
  type WizardAnswers
} from '../lib/job';
import { en } from '../i18n/en';
import { theme } from '../theme';
import {
  buttonStyle,
  cardStyle,
  chipStyle,
  errorBannerStyle,
  fieldStyle,
  hintStyle,
  labelStyle,
  statusBannerStyle,
  stickyBarStyle
} from './ui';

/** Client fetch timeout for POST /api/submit (fail closed). */
const SUBMIT_TIMEOUT_MS = 10_000;

/** Client-side state for the review-step submit request. */
type SubmitUiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; job: BuildJob };

export interface WizardProps {
  /** Controlled wizard answers. */
  value: WizardAnswers;
  /** Called when any answer field changes. */
  onChange: (next: WizardAnswers) => void;
  /** Called with the server job only after a successful submit. */
  onSubmit: (job: BuildJob) => void;
  /** Optional: start on a specific step (e.g. 2 when prompt already set). */
  initialStep?: 1 | 2 | 3;
}

/**
 * Narrow unknown JSON to a BuildJob (fail closed on any mismatch).
 * Requires orchestrator Job fields (answers + createdAt) so the client shape
 * cannot silently drift from JobSchema.
 *
 * @param payload - Unknown JSON from POST /api/submit.
 * @returns Typed BuildJob or null.
 */
function parseBuildJob(payload: unknown): BuildJob | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (record['kind'] !== 'job') return null;
  if (typeof record['slug'] !== 'string') return null;
  if (typeof record['prompt'] !== 'string') return null;
  if (record['targetType'] !== 'fullstack-web') return null;
  if (record['threshold'] !== 90) return null;
  if (typeof record['createdAt'] !== 'string') return null;
  if (typeof record['answers'] !== 'object' || record['answers'] === null) return null;
  const answersRaw = record['answers'] as Record<string, unknown>;
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(answersRaw)) {
    if (typeof value !== 'string') return null;
    answers[key] = value;
  }
  return {
    kind: 'job',
    slug: record['slug'],
    prompt: record['prompt'],
    targetType: 'fullstack-web',
    threshold: 90,
    answers,
    createdAt: record['createdAt']
  };
}

/**
 * Three-step clarifying-questions wizard: free-text intent, structured
 * scope (type / auth / entities), then review with a token estimate and submit.
 * Grok v2 base + Claude variation 3 pill chips and clear step indicators.
 */
export function Wizard({ value, onChange, onSubmit, initialStep = 1 }: WizardProps): JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [submitState, setSubmitState] = useState<SubmitUiState>({ status: 'idle' });

  const entityCount = countEntities(value.entities);
  /** One base feature for the app shell, plus one per named entity. */
  const features = Math.max(1, entityCount + (value.appType.trim() ? 1 : 0));
  const cost = estimate({
    features,
    hasAuth: value.hasAuth,
    entities: entityCount
  });

  // Readiness predicates live in lib/job (tested there) and mirror exactly what
  // the submit endpoint requires, so the wizard never sends a body the server
  // will 400 on. App type used to be ungated, so an empty one reached the server
  // and returned a raw "String must contain at least 1 character(s)".
  const promptReady = isPromptReady(value);
  const appTypeReady = isAppTypeReady(value);
  const isLoading = submitState.status === 'loading';
  const canSubmit = canForgePrd(value) && !isLoading;
  const copy = en.wizard;

  /**
   * Patch a single answer field into the controlled value.
   */
  function patch(partial: Partial<WizardAnswers>): void {
    onChange({ ...value, ...partial });
  }

  /**
   * Advance to the next step when the current step is valid.
   */
  function goNext(): void {
    if (step === 1 && !promptReady) return;
    // Step 2 (Scope) collects the app type. Do not let the user advance to Review
    // without it — that is how an empty app type reached the server.
    if (step === 2 && !appTypeReady) return;
    if (step < 3) setStep((step + 1) as 1 | 2 | 3);
  }

  /**
   * Return to the previous step.
   */
  function goBack(): void {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  }

  /**
   * POST answers to /api/submit; show loading, error, or returned job.
   * Fail closed: errors never render as success; onSubmit only on 200 job.
   * Explicit AbortController timeout (~10s).
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitState({ status: 'loading' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, SUBMIT_TIMEOUT_MS);

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: value.prompt.trim(),
          appType: value.appType,
          hasAuth: value.hasAuth,
          entities: entityCount
        }),
        signal: controller.signal
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setSubmitState({ status: 'error', message: copy.errors.invalidResponse });
        return;
      }

      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof (payload as { error: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : copy.errors.submitFailed(response.status);
        setSubmitState({ status: 'error', message });
        return;
      }

      const job = parseBuildJob(payload);
      if (job === null) {
        setSubmitState({ status: 'error', message: copy.errors.invalidJobPayload });
        return;
      }

      setSubmitState({ status: 'success', job });
      onSubmit(job);
    } catch (error: unknown) {
      const timedOut =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError');
      setSubmitState({
        status: 'error',
        message: timedOut ? copy.errors.timeout : copy.errors.network
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      aria-label={copy.formLabel}
      style={formStyle}
    >
      <Stepper step={step} />

      <section
        style={{ ...cardStyle(theme.space.lg), borderRadius: 16, padding: '20px 18px' }}
        aria-labelledby={`wizard-q-${step}`}
      >
        <p style={kickerStyle}>{copy.questionKicker(step)}</p>

        {step === 1 && (
          <div>
            <label htmlFor="wizard-prompt" id="wizard-q-1" style={fieldLabelStyle}>
              {copy.promptLabel}
            </label>
            <p style={hintStyle()}>{copy.promptHint(MIN_PROMPT_LENGTH)}</p>
            <textarea
              id="wizard-prompt"
              name="prompt"
              required
              minLength={MIN_PROMPT_LENGTH}
              rows={5}
              value={value.prompt}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                patch({ prompt: event.target.value })
              }
              placeholder={copy.promptPlaceholder}
              style={{ ...fieldStyle(), minHeight: 120, marginTop: theme.space.sm }}
              aria-describedby="wizard-prompt-hint"
            />
            <p id="wizard-prompt-hint" style={hintStyle()}>
              {value.prompt.trim().length}/{MIN_PROMPT_LENGTH}+
            </p>
            <div style={chipsRowStyle} role="group" aria-label={copy.exampleIdeasLabel}>
              {copy.exampleIdeas.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  style={chipStyle(value.prompt.includes(idea))}
                  onClick={() => {
                    patch({ prompt: `A ${idea.toLowerCase()} app` });
                  }}
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p id="wizard-q-2" style={fieldLabelStyle}>
              {copy.appTypeLabel}
            </p>
            <div style={chipsRowStyle} role="group" aria-label={copy.appTypeChipsLabel}>
              {copy.appTypeChips.map((chip) => {
                const selected = value.appType === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    style={chipStyle(selected)}
                    aria-pressed={selected}
                    onClick={() => {
                      patch({ appType: chip });
                    }}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            <label htmlFor="wizard-app-type" style={{ ...labelStyle(), marginTop: theme.space.md }}>
              {copy.appTypeLabel}
            </label>
            <input
              id="wizard-app-type"
              name="appType"
              type="text"
              value={value.appType}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                patch({ appType: event.target.value })
              }
              placeholder={copy.appTypePlaceholder}
              style={fieldStyle()}
            />

            <p style={{ ...fieldLabelStyle, marginTop: theme.space.lg }} id="wizard-auth-label">
              {copy.authGroupLabel}
            </p>
            <div style={chipsRowStyle} role="group" aria-labelledby="wizard-auth-label">
              <button
                type="button"
                style={chipStyle(value.hasAuth)}
                aria-pressed={value.hasAuth}
                onClick={() => {
                  patch({ hasAuth: true });
                }}
              >
                {copy.authYes}
              </button>
              <button
                type="button"
                style={chipStyle(!value.hasAuth)}
                aria-pressed={!value.hasAuth}
                onClick={() => {
                  patch({ hasAuth: false });
                }}
              >
                {copy.authNo}
              </button>
            </div>

            <label htmlFor="wizard-entities" style={{ ...labelStyle(), marginTop: theme.space.lg }}>
              {copy.entitiesLabel}
            </label>
            <input
              id="wizard-entities"
              name="entities"
              type="text"
              value={value.entities}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                patch({ entities: event.target.value })
              }
              placeholder={copy.entitiesPlaceholder}
              style={fieldStyle()}
              aria-describedby="wizard-entities-hint"
            />
            <p id="wizard-entities-hint" style={hintStyle()}>
              {copy.entitiesHint}
            </p>
            {!appTypeReady && (
              <div role="alert" style={{ ...errorBannerStyle(), marginTop: theme.space.md }}>
                <span aria-hidden="true">!</span>
                <span>{copy.appTypeRequired}</span>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <p id="wizard-q-3" style={fieldLabelStyle}>
              {copy.reviewHeading}
            </p>
            <dl style={reviewListStyle}>
              <ReviewRow
                term={copy.reviewPrompt}
                detail={value.prompt.trim() || copy.reviewEmpty}
              />
              <ReviewRow
                term={copy.reviewAppType}
                detail={value.appType.trim() || copy.reviewNotSet}
              />
              <ReviewRow
                term={copy.reviewAuth}
                detail={value.hasAuth ? copy.reviewYes : copy.reviewNo}
              />
              <ReviewRow
                term={copy.reviewEntities}
                detail={value.entities.trim() || copy.reviewNone}
              />
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
        )}
      </section>

      <ComingUp step={step} />

      <div style={stickyBarStyle()}>
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            style={buttonStyle(false, isLoading)}
            disabled={isLoading}
          >
            {copy.back}
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            onClick={goNext}
            disabled={(step === 1 && !promptReady) || (step === 2 && !appTypeReady)}
            style={buttonStyle(true, (step === 1 && !promptReady) || (step === 2 && !appTypeReady))}
          >
            {copy.next}
          </button>
        )}
        {step === 3 && (
          <button type="submit" disabled={!canSubmit} style={buttonStyle(true, !canSubmit)}>
            {isLoading ? copy.submitting : copy.submit}
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Segmented step indicator with label + progress track (not color alone).
 */
function Stepper({ step }: { step: 1 | 2 | 3 }): JSX.Element {
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

/**
 * Grok v2 pillbox step list — numbered tiles for each wizard step.
 * Current step uses accent border + filled number (not color alone).
 */
function ComingUp({ step }: { step: 1 | 2 | 3 }): JSX.Element {
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

/**
 * One review definition row.
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

/** Empty controlled answers for first paint. */
export const EMPTY_WIZARD_ANSWERS: WizardAnswers = {
  prompt: '',
  appType: '',
  hasAuth: false,
  entities: ''
};

const formStyle: CSSProperties = {
  fontFamily: theme.type.family,
  color: theme.color.text,
  maxWidth: '40rem',
  width: '100%'
};

const stepperStyle: CSSProperties = {
  marginBottom: theme.space.md
};

const stepperMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 10,
  flexWrap: 'wrap'
};

const stepLabelStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 650,
  letterSpacing: '0.02em',
  color: theme.color.muted,
  textTransform: 'uppercase'
};

const stepTitleStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 600,
  color: theme.color.accentFg
};

const progressTrackStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  height: 6
};

const kickerStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 650,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.color.accentFg,
  margin: `0 0 ${theme.space.sm}px`
};

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: theme.type.scale[2],
  fontWeight: 650,
  color: theme.color.text,
  lineHeight: 1.35,
  margin: `0 0 10px`
};

const chipsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginTop: 14
};

const reviewListStyle: CSSProperties = {
  margin: `${theme.space.md}px 0 0`,
  padding: 0
};

const estimateBoxStyle: CSSProperties = {
  marginTop: theme.space.md,
  padding: theme.space.md,
  background: theme.color.bg,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.color.border}`
};

const upcomingStyle: CSSProperties = {
  marginTop: theme.space.md,
  marginBottom: theme.space.sm
};

const upcomingHeadingStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 650,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: theme.color.muted,
  margin: `0 0 10px`
};

const upcomingListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm
};

const upcomingItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minHeight: theme.touch,
  padding: '10px 12px',
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surface,
  fontSize: theme.type.scale[2],
  lineHeight: 1.35,
  boxSizing: 'border-box'
};

const upcomingNumStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: theme.type.scale[1],
  fontWeight: 700,
  flexShrink: 0
};
