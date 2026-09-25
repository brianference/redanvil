import { useState, type FormEvent } from 'react';
import {
  countEntities,
  estimateForAnswers,
  isPromptReady,
  isAppTypeReady,
  isFeatureSelectionReady,
  canForgePrd,
  parseBuildJob,
  submitRequestBody,
  type BuildJob,
  type WizardAnswers
} from '../lib/job';
import { failureMessage, fetchJson, type FailureMessages } from '../lib/fetchJson';
import { parseSubmittedJobId } from '../lib/jobStatus';
import { defaultSelectedFeatureIds } from '../lib/prd/sections/features';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { buttonStyle, cardStyle, stickyBarStyle } from './ui';
import { ComingUp } from './wizard/ComingUp';
import { Stepper } from './wizard/Stepper';
import { PromptStep } from './wizard/steps/PromptStep';
import { ScopeStep } from './wizard/steps/ScopeStep';
import {
  FeaturesStep,
  featureEntityNames,
  resolveFeatureSelection
} from './wizard/steps/FeaturesStep';
import { ReviewStep, type SubmitUiState } from './wizard/steps/ReviewStep';
import { entitySpecBlockMessage } from './wizard/entitySpecMessage';
import { formStyle, kickerStyle } from './wizard/styles';
import type { WizardStepIndex } from './wizard/types';

export interface WizardProps {
  /** Controlled wizard answers. */
  value: WizardAnswers;
  /** Called when any answer field changes. */
  onChange: (next: WizardAnswers) => void;
  /** Called with the server job and its id only after a successful submit. */
  onSubmit: (job: BuildJob, jobId: string) => void;
  /** Optional: start on a specific step (e.g. 2 when prompt already set). */
  initialStep?: WizardStepIndex;
}

/**
 * The job and its id from a successful submit, or null when either is missing.
 *
 * @param payload - JSON from POST /api/submit.
 * @returns Job and id, or null.
 */
function parseSubmitted(payload: unknown): { job: BuildJob; jobId: string } | null {
  const job = parseBuildJob(payload);
  const jobId = parseSubmittedJobId(payload);
  return job === null || jobId === null ? null : { job, jobId };
}

/** How the review step words each way a submit can fail. */
const SUBMIT_FAILURE_MESSAGES: FailureMessages = {
  invalidJson: en.wizard.errors.invalidResponse,
  invalidPayload: en.wizard.errors.invalidJobPayload,
  timeout: en.wizard.errors.timeout,
  network: en.wizard.errors.network,
  http: en.wizard.errors.submitFailed
};

/**
 * Whether `next` differs from the stored feature selection, so the wizard only
 * writes a selection that actually changed.
 *
 * @param stored - Current selection, or null before one is materialised.
 * @param next - Selection about to be stored.
 * @returns True when an onChange is needed.
 */
function selectionChanged(stored: readonly string[] | null, next: readonly string[]): boolean {
  return stored === null || next.join(',') !== stored.join(',');
}

/**
 * Four-step clarifying wizard: free-text intent, structured scope, feature
 * selection from the real PRD derivation, then review with estimate and submit.
 */
export function Wizard({ value, onChange, onSubmit, initialStep = 1 }: WizardProps): JSX.Element {
  const [step, setStep] = useState<WizardStepIndex>(initialStep);
  const [submitState, setSubmitState] = useState<SubmitUiState>({ status: 'idle' });

  const cost = estimateForAnswers(value);

  // Readiness predicates live in lib/job (tested there) and mirror exactly what
  // the submit endpoint requires, so the wizard never sends a body the server
  // will 400 on.
  const promptReady = isPromptReady(value);
  const appTypeReady = isAppTypeReady(value);
  const featuresReady = isFeatureSelectionReady(value);
  const entityBlock = entitySpecBlockMessage(value.entities);
  const entitiesReady = entityBlock === null;
  const isLoading = submitState.status === 'loading';
  const canSubmit = canForgePrd(value) && !isLoading;
  const copy = en.wizard;

  /**
   * Patch answer fields into the controlled value.
   * Changing entities or auth invalidates feature ids (F5+ renumber), so clear selection.
   */
  function patch(partial: Partial<WizardAnswers>): void {
    const entitiesChanged = partial.entities !== undefined && partial.entities !== value.entities;
    const authChanged = partial.hasAuth !== undefined && partial.hasAuth !== value.hasAuth;
    const clearFeatures = entitiesChanged || authChanged;
    onChange({
      ...value,
      ...partial,
      ...(clearFeatures ? { selectedFeatureIds: null } : {})
    });
  }

  /**
   * Advance to the next step when the current step is valid.
   * Leaving Scope materializes MVP feature defaults so Review / generatePrd
   * receive an explicit selection matching what the Features step shows.
   */
  function goNext(): void {
    if (step === 1 && !promptReady) return;
    // Step 2 (Scope) collects the app type. Do not let the user advance without it.
    if (step === 2 && (!appTypeReady || !entitiesReady)) return;
    if (step === 2) {
      const entityNames = featureEntityNames(value.entities);
      const nextSelection =
        value.selectedFeatureIds === null
          ? defaultSelectedFeatureIds(entityNames, value.hasAuth, value.prompt)
          : resolveFeatureSelection(value);
      if (selectionChanged(value.selectedFeatureIds, nextSelection)) {
        onChange({ ...value, selectedFeatureIds: nextSelection });
      }
    }
    // Step 3 (Features) requires at least one selected feature.
    if (step === 3) {
      // Persist the resolved selection (MVP defaults) even if the user never toggled.
      const resolved = resolveFeatureSelection(value);
      if (resolved.length === 0) return;
      if (selectionChanged(value.selectedFeatureIds, resolved)) {
        onChange({ ...value, selectedFeatureIds: resolved });
      }
    }
    if (step < 4) goToStep((step + 1) as WizardStepIndex);
  }

  /**
   * Move to a step and put the user at the top of it, so a long step (Features,
   * Review) opens on its heading rather than halfway down its own content.
   */
  function goToStep(next: WizardStepIndex): void {
    setStep(next);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  /**
   * Return to the previous step.
   */
  function goBack(): void {
    if (step > 1) goToStep((step - 1) as WizardStepIndex);
  }

  /**
   * Whether the Next control for the current step is enabled.
   */
  function nextDisabled(): boolean {
    if (step === 1) return !promptReady;
    if (step === 2) return !appTypeReady || !entitiesReady;
    if (step === 3) return !featuresReady;
    return true;
  }

  /**
   * POST answers to /api/submit; show loading, error, or returned job.
   * Fail closed: errors never render as success; onSubmit only on a 200 job.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitState({ status: 'loading' });
    const result = await fetchJson('/api/submit', parseSubmitted, {
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submitRequestBody(value, countEntities(value.entities)))
      }
    });
    if (!result.ok) {
      setSubmitState({ status: 'error', message: failureMessage(result, SUBMIT_FAILURE_MESSAGES) });
      return;
    }
    setSubmitState({ status: 'success', job: result.data.job });
    onSubmit(result.data.job, result.data.jobId);
  }

  const disableNext = nextDisabled();

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      aria-label={copy.formLabel}
      className="ra-form-col"
      style={formStyle}
    >
      <Stepper step={step} />

      <section
        style={{ ...cardStyle(theme.space.lg), borderRadius: 16, padding: '20px 18px' }}
        aria-labelledby={`wizard-q-${step}`}
      >
        <p style={kickerStyle}>{copy.questionKicker(step)}</p>

        {step === 1 && <PromptStep value={value} patch={patch} />}
        {step === 2 && <ScopeStep value={value} patch={patch} appTypeReady={appTypeReady} />}
        {step === 3 && <FeaturesStep value={value} patch={patch} featuresReady={featuresReady} />}
        {step === 4 && (
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
        {step < 4 && (
          <button
            type="button"
            onClick={goNext}
            disabled={disableNext}
            style={buttonStyle(true, disableNext)}
          >
            {copy.next}
          </button>
        )}
        {step === 4 && (
          <button type="submit" disabled={!canSubmit} style={buttonStyle(true, !canSubmit)}>
            {isLoading ? copy.submitting : copy.submit}
          </button>
        )}
      </div>
    </form>
  );
}
