import { useState, type ChangeEvent, type FormEvent, type CSSProperties } from 'react';
import { estimate } from '../lib/estimate';
import {
  countEntities,
  type BuildJob,
  type WizardAnswers
} from '../lib/job';
import { theme } from '../theme';

/** Minimum prompt length before submit is allowed (matches job schema). */
const MIN_PROMPT_LENGTH = 8;

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
}

/**
 * Narrow unknown JSON to a BuildJob (fail closed on any mismatch).
 */
function parseBuildJob(payload: unknown): BuildJob | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (record['kind'] !== 'job') return null;
  if (typeof record['slug'] !== 'string') return null;
  if (typeof record['prompt'] !== 'string') return null;
  if (record['targetType'] !== 'fullstack-web') return null;
  if (record['threshold'] !== 90) return null;
  return {
    kind: 'job',
    slug: record['slug'],
    prompt: record['prompt'],
    targetType: 'fullstack-web',
    threshold: 90
  };
}

/**
 * Three-step clarifying-questions wizard: free-text intent, structured
 * scope (type / auth / entities), then review with a token estimate and submit.
 * Controlled via value/onChange; step index is internal.
 */
export function Wizard({ value, onChange, onSubmit }: WizardProps): JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitState, setSubmitState] = useState<SubmitUiState>({ status: 'idle' });

  const entityCount = countEntities(value.entities);
  /** One base feature for the app shell, plus one per named entity. */
  const features = Math.max(1, entityCount + (value.appType.trim() ? 1 : 0));
  const cost = estimate({
    features,
    hasAuth: value.hasAuth,
    entities: entityCount
  });

  const promptReady = value.prompt.trim().length >= MIN_PROMPT_LENGTH;
  const isLoading = submitState.status === 'loading';
  const canSubmit = promptReady && !isLoading;

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
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitState({ status: 'loading' });

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: value.prompt.trim(),
          appType: value.appType,
          hasAuth: value.hasAuth,
          entities: entityCount
        })
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setSubmitState({ status: 'error', message: 'Invalid response from server' });
        return;
      }

      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof (payload as { error: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : `Submit failed (${response.status})`;
        setSubmitState({ status: 'error', message });
        return;
      }

      const job = parseBuildJob(payload);
      if (job === null) {
        setSubmitState({ status: 'error', message: 'Invalid job payload from server' });
        return;
      }

      setSubmitState({ status: 'success', job });
      onSubmit(job);
    } catch {
      setSubmitState({ status: 'error', message: 'Network error submitting job' });
    }
  }

  const fieldStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    maxWidth: '32rem',
    fontFamily: theme.type.family,
    fontSize: theme.type.scale[2],
    color: theme.color.text,
    background: theme.color.bg,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.sm,
    padding: theme.space.sm,
    marginTop: theme.space.xs,
    boxSizing: 'border-box'
  };

  const labelStyle: CSSProperties = {
    display: 'block',
    marginTop: theme.space.md,
    fontSize: theme.type.scale[1],
    color: theme.color.muted
  };

  const buttonStyle: CSSProperties = {
    fontFamily: theme.type.family,
    fontSize: theme.type.scale[2],
    color: theme.color.text,
    background: theme.color.accent,
    border: 'none',
    borderRadius: theme.radius.sm,
    padding: `${theme.space.sm}px ${theme.space.md}px`,
    cursor: 'pointer',
    marginRight: theme.space.sm,
    marginTop: theme.space.md
  };

  const secondaryButtonStyle: CSSProperties = {
    ...buttonStyle,
    background: theme.color.surface,
    border: `1px solid ${theme.color.border}`
  };

  const disabledButtonStyle: CSSProperties = {
    ...buttonStyle,
    opacity: 0.5,
    cursor: 'not-allowed'
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="App build wizard"
      style={{
        fontFamily: theme.type.family,
        color: theme.color.text,
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        padding: theme.space.lg,
        maxWidth: '40rem'
      }}
    >
      <p style={{ color: theme.color.muted, fontSize: theme.type.scale[1], margin: 0 }}>
        Step {step} of 3
      </p>

      {step === 1 && (
        <div>
          <label htmlFor="wizard-prompt" style={labelStyle}>
            What app do you want?
          </label>
          <textarea
            id="wizard-prompt"
            name="prompt"
            required
            minLength={MIN_PROMPT_LENGTH}
            rows={4}
            value={value.prompt}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              patch({ prompt: event.target.value })
            }
            style={fieldStyle}
            aria-describedby="wizard-prompt-hint"
          />
          <p id="wizard-prompt-hint" style={{ ...labelStyle, marginTop: theme.space.xs }}>
            Describe the product in a short sentence (at least {MIN_PROMPT_LENGTH} characters).
          </p>
        </div>
      )}

      {step === 2 && (
        <div>
          <label htmlFor="wizard-app-type" style={labelStyle}>
            App type
          </label>
          <input
            id="wizard-app-type"
            name="appType"
            type="text"
            value={value.appType}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              patch({ appType: event.target.value })
            }
            placeholder="e.g. marketplace, dashboard, content site"
            style={fieldStyle}
          />

          <label
            htmlFor="wizard-auth"
            style={{
              ...labelStyle,
              display: 'flex',
              alignItems: 'center',
              gap: theme.space.sm,
              color: theme.color.text
            }}
          >
            <input
              id="wizard-auth"
              name="hasAuth"
              type="checkbox"
              checked={value.hasAuth}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                patch({ hasAuth: event.target.checked })
              }
            />
            Authentication needed
          </label>

          <label htmlFor="wizard-entities" style={labelStyle}>
            Main entities
          </label>
          <input
            id="wizard-entities"
            name="entities"
            type="text"
            value={value.entities}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              patch({ entities: event.target.value })
            }
            placeholder="e.g. User, Recipe, Favorite"
            style={fieldStyle}
            aria-describedby="wizard-entities-hint"
          />
          <p id="wizard-entities-hint" style={{ ...labelStyle, marginTop: theme.space.xs }}>
            Comma-separated domain nouns the app will store or manage.
          </p>
        </div>
      )}

      {step === 3 && (
        <div>
          <p style={{ marginTop: theme.space.md, fontSize: theme.type.scale[2] }}>
            <strong>Prompt:</strong> {value.prompt.trim() || '(empty)'}
          </p>
          <p style={{ fontSize: theme.type.scale[2] }}>
            <strong>App type:</strong> {value.appType.trim() || '(not set)'}
          </p>
          <p style={{ fontSize: theme.type.scale[2] }}>
            <strong>Auth:</strong> {value.hasAuth ? 'Yes' : 'No'}
          </p>
          <p style={{ fontSize: theme.type.scale[2] }}>
            <strong>Entities:</strong> {value.entities.trim() || '(none)'}
          </p>
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: theme.space.md,
              padding: theme.space.md,
              background: theme.color.bg,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.color.border}`
            }}
          >
            <p style={{ margin: 0, fontSize: theme.type.scale[2] }}>
              Estimated iterations: {cost.iterations}
            </p>
            <p style={{ margin: `${theme.space.xs}px 0 0`, fontSize: theme.type.scale[2] }}>
              Estimated tokens: {cost.tokens.toLocaleString()}
            </p>
            <p
              style={{
                margin: `${theme.space.xs}px 0 0`,
                fontSize: theme.type.scale[1],
                color: theme.color.muted
              }}
            >
              Confidence: {cost.confidence}
            </p>
          </div>
          {!promptReady && (
            <p role="alert" style={{ color: theme.color.accent, fontSize: theme.type.scale[1] }}>
              Enter a prompt of at least {MIN_PROMPT_LENGTH} characters before submitting.
            </p>
          )}
          {submitState.status === 'loading' && (
            <p role="status" aria-live="polite" style={{ marginTop: theme.space.md, fontSize: theme.type.scale[2] }}>
              Submitting build job…
            </p>
          )}
          {submitState.status === 'error' && (
            <p role="alert" style={{ marginTop: theme.space.md, color: theme.color.accent, fontSize: theme.type.scale[2] }}>
              {submitState.message}
            </p>
          )}
          {submitState.status === 'success' && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginTop: theme.space.md,
                padding: theme.space.md,
                background: theme.color.bg,
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.color.border}`
              }}
            >
              <p style={{ margin: 0, fontSize: theme.type.scale[2] }}>
                Job ready: <strong>{submitState.job.slug}</strong>
              </p>
              <p style={{ margin: `${theme.space.xs}px 0 0`, fontSize: theme.type.scale[1], color: theme.color.muted }}>
                {submitState.job.targetType} · threshold {submitState.job.threshold}
              </p>
              <p style={{ margin: `${theme.space.xs}px 0 0`, fontSize: theme.type.scale[1], color: theme.color.muted }}>
                {submitState.job.prompt}
              </p>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        {step > 1 && (
          <button type="button" onClick={goBack} style={secondaryButtonStyle} disabled={isLoading}>
            Back
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            onClick={goNext}
            disabled={step === 1 && !promptReady}
            style={step === 1 && !promptReady ? disabledButtonStyle : buttonStyle}
          >
            Next
          </button>
        )}
        {step === 3 && (
          <button type="submit" disabled={!canSubmit} style={canSubmit ? buttonStyle : disabledButtonStyle}>
            {isLoading ? 'Submitting…' : 'Submit'}
          </button>
        )}
      </div>
    </form>
  );
}

/** Empty controlled answers for first paint. */
export const EMPTY_WIZARD_ANSWERS: WizardAnswers = {
  prompt: '',
  appType: '',
  hasAuth: false,
  entities: ''
};
