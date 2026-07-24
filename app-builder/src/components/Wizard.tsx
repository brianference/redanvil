import { useState, type FormEvent } from 'react';
import { estimate } from '../lib/estimate';
import {
  countEntities,
  countScopeSignals,
  isPromptReady,
  isAppTypeReady,
  canForgePrd,
  EMPTY_WIZARD_ANSWERS,
  type BuildJob,
  type WizardAnswers
} from '../lib/job';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { buttonStyle, cardStyle, stickyBarStyle } from './ui';
import { ComingUp } from './wizard/ComingUp';
import { integrationChipSelected, toggleIntegrationChip } from './wizard/integrationChips';
import { reviewAnswerRows } from './wizard/reviewRows';
import { Stepper } from './wizard/Stepper';
import { PromptStep } from './wizard/steps/PromptStep';
import { ScopeStep } from './wizard/steps/ScopeStep';
import { ReviewStep, type SubmitUiState } from './wizard/steps/ReviewStep';
import { formStyle, kickerStyle } from './wizard/styles';

/** Client fetch timeout for POST /api/submit (fail closed). */
const SUBMIT_TIMEOUT_MS = 10_000;

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
  const scopeSignals = countScopeSignals(value);
  const cost = estimate({
    features,
    hasAuth: value.hasAuth,
    entities: entityCount,
    scopeSignals
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

        {step === 1 && <PromptStep value={value} patch={patch} />}
        {step === 2 && (
          <ScopeStep value={value} patch={patch} appTypeReady={appTypeReady} />
        )}
        {step === 3 && (
          <ReviewStep
            value={value}
            cost={cost}
            promptReady={promptReady}
            appTypeReady={appTypeReady}
            submitState={submitState}
          />
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

/** Re-export empty answers so Home and tests import from the Wizard surface. */
export { EMPTY_WIZARD_ANSWERS };

/** Re-export integration chip helpers (public API for tests). */
export { integrationChipSelected, toggleIntegrationChip };

/** Re-export review row derivation (public API; Review step UI path). */
export { reviewAnswerRows };
