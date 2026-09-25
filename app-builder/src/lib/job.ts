import { z } from 'zod';
import { estimate, type EstimateResult } from './estimate';
import { entitySpecReady, parseEntitySpec } from './prd/entitySpec';
import { isTitleFragment, titleFromPrompt } from './prd/naming';

/** How the app should persist domain data (wizard scope). */
export type DataStorage = 'none' | 'simple' | 'relational';

/** Wizard answers collected before a build job is committed. */
export interface WizardAnswers {
  /** Free-text description of the app to build. */
  prompt: string;
  /** High-level app type (e.g. marketplace, dashboard). */
  appType: string;
  /** Whether the app needs authentication. */
  hasAuth: boolean;
  /**
   * Main entities in the entity-spec syntax (`Name: field, field:type, field->Other`).
   * Legacy comma lists parse, but they have no fields and cannot be forged.
   */
  entities: string;
  /**
   * Data storage approach. Optional for callers that only set core fields
   * (e.g. POST /api/submit); defaults to simple D1 tables.
   */
  dataStorage: DataStorage;
  /** Whether the app needs realtime updates (WebSocket / live refresh). */
  hasRealtime: boolean;
  /** Optional integrations (free text or comma-separated chips). */
  integrations: string;
  /**
   * Feature ids (F1, F2, …) the user chose on the Features step.
   * `null` means no selection yet — generatePrd keeps legacy behaviour (all
   * derived features). A non-null array is an explicit pick (may be empty).
   */
  selectedFeatureIds: string[] | null;
}

/** Default data storage when the user does not change the scope control. */
export const DEFAULT_DATA_STORAGE: DataStorage = 'simple';

/**
 * App type pre-selected on first paint.
 *
 * Every app RedAnvil generates is a mobile-first responsive web UI, so an unset
 * app type made the most common answer the one the user had to supply by hand —
 * and left Scope gated on a field whose value was already known. It must stay a
 * member of `en.wizard.appTypeChips` or the chip row shows nothing selected;
 * `job.test.ts` asserts that.
 */
export const DEFAULT_APP_TYPE = 'Mobile app';

/** Minimum prompt length the submit endpoint enforces (z.string().trim().min(8)). */
export const MIN_PROMPT_LENGTH = 8;

/**
 * Empty / first-paint wizard answers (controlled form defaults).
 */
export const EMPTY_WIZARD_ANSWERS: WizardAnswers = {
  prompt: '',
  appType: DEFAULT_APP_TYPE,
  hasAuth: false,
  entities: '',
  dataStorage: DEFAULT_DATA_STORAGE,
  hasRealtime: false,
  integrations: '',
  selectedFeatureIds: null
};

/**
 * Whether the wizard answers satisfy what the submit endpoint requires, so the
 * client never sends a body the server will 400 on.
 *
 * The submit schema is `prompt: min(8)` and `appType: min(1)`. The wizard used
 * to gate only on the prompt, so a user could reach Review with app type unset,
 * click Forge PRD, and get back a raw "String must contain at least 1
 * character(s)". These predicates are the single source of truth the wizard's
 * Next/Forge gating uses.
 */
export function isPromptReady(answers: WizardAnswers): boolean {
  return answers.prompt.trim().length >= MIN_PROMPT_LENGTH;
}

export function isAppTypeReady(answers: WizardAnswers): boolean {
  return answers.appType.trim().length > 0;
}

/**
 * Whether the Features step allows Continue: at least one feature id is selected.
 * `null` (not yet materialized) is ready — the step / goNext seed MVP defaults,
 * which are always non-empty. An explicit empty array fails closed.
 *
 * @param answers - Wizard form values.
 * @returns True when Continue may advance past the Features step.
 */
export function isFeatureSelectionReady(answers: WizardAnswers): boolean {
  if (answers.selectedFeatureIds === null) {
    return true;
  }
  return answers.selectedFeatureIds.length > 0;
}

/**
 * Whether Forge PRD may run: prompt, app type, a non-empty feature pick when
 * the user has already made an explicit selection, a non-fragment derived
 * product title (A6), and an entity spec with at least one field on every
 * entity and zero parse errors (same fail-closed rule as generatePrd).
 *
 * @param answers - Wizard form values.
 * @returns True when the submit action may fire.
 */
export function canForgePrd(answers: WizardAnswers): boolean {
  if (!isPromptReady(answers) || !isAppTypeReady(answers)) {
    return false;
  }
  if (!isFeatureSelectionReady(answers)) {
    return false;
  }
  // Gate when the derived title is still a sentence fragment (A6).
  if (isTitleFragment(titleFromPrompt(answers.prompt))) {
    return false;
  }
  // The wizard guarantees a parsed spec. Deriving nouns from the prompt is
  // not a substitute: a field-less legacy list must not forge.
  if (!entitySpecReady(answers.entities)) {
    return false;
  }
  return true;
}

/**
 * Count how many optional scope dimensions the user actually specified.
 * Used so estimate confidence rises when the wizard is more complete.
 *
 * @param answers - Wizard form values.
 * @returns Non-negative count of filled optional scope signals.
 */
export function countScopeSignals(answers: WizardAnswers): number {
  let signals = 0;
  if (isAppTypeReady(answers)) signals += 1;
  if (answers.entities.trim().length > 0) signals += 1;
  // Explicit non-default storage is a stronger signal than the default "simple".
  if (answers.dataStorage !== DEFAULT_DATA_STORAGE) signals += 1;
  if (answers.hasRealtime) signals += 1;
  if (answers.integrations.trim().length > 0) signals += 1;
  if (answers.hasAuth) signals += 1;
  return signals;
}

/**
 * Build job payload consumed by the orchestrator (kind = job).
 * Shape must stay a valid subset of orchestrator `JobSchema` so a client-built
 * job.json can feed scaffold/validate without a silent hand-edit layer.
 */
export interface BuildJob {
  kind: 'job';
  /** Kebab-case slug derived from the prompt. */
  slug: string;
  /** Original user prompt. */
  prompt: string;
  /** Always fullstack-web for this wizard (orchestrator also allows other targets). */
  targetType: 'fullstack-web';
  /** Gate pass threshold (default 90). */
  threshold: 90;
  /** Wizard scope fields as string map (orchestrator Job.answers). */
  answers: Record<string, string>;
  /** ISO-8601 creation time (orchestrator Job.createdAt). */
  createdAt: string;
}

/** The job POST /api/submit returns, checked field by field against BuildJob. */
const buildJobSchema = z.object({
  kind: z.literal('job'),
  slug: z.string(),
  prompt: z.string(),
  targetType: z.literal('fullstack-web'),
  threshold: z.literal(90),
  answers: z.record(z.string()),
  createdAt: z.string()
});

/**
 * Narrow the submit response to a BuildJob, failing closed on any mismatch so
 * the client shape cannot silently drift from the orchestrator's JobSchema.
 *
 * @param payload - JSON from POST /api/submit.
 * @returns The job, or null.
 */
export function parseBuildJob(payload: unknown): BuildJob | null {
  const parsed = buildJobSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Cost estimate for the current answers: one base feature for the app shell
 * when an app type is set, plus one per named entity. The wizard's review step
 * and the PRD generated after submit both use this, so they cannot disagree.
 *
 * @param answers - Wizard form values.
 * @returns Token and cost estimate.
 */
export function estimateForAnswers(answers: WizardAnswers): EstimateResult {
  const entityCount = countEntities(answers.entities);
  return estimate({
    features: Math.max(1, entityCount + (isAppTypeReady(answers) ? 1 : 0)),
    hasAuth: answers.hasAuth,
    entities: entityCount,
    scopeSignals: countScopeSignals(answers)
  });
}

const SLUG_MAX = 49;
const SLUG_FALLBACK = 'app';

/**
 * Derive a kebab-case slug from free text.
 * Shape: starts with [a-z0-9], then [a-z0-9-], length 2–49.
 *
 * @param prompt - Free-text app description.
 * @returns Kebab-case slug safe for JobSchema.
 */
export function slugFromPrompt(prompt: string): string {
  const raw = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  const truncated = raw.slice(0, SLUG_MAX).replace(/-+$/g, '');
  if (truncated.length >= 2 && /^[a-z0-9]/.test(truncated)) {
    return truncated;
  }
  return SLUG_FALLBACK;
}

/**
 * Count entities in a Main entities spec.
 *
 * Uses the parser, so `Dog: name, breed; CareTask: title` is two entities,
 * not four comma-separated chunks.
 *
 * @param entities - Entity spec text.
 * @returns How many entities parsed, including legacy names that have no fields.
 */
export function countEntities(entities: string): number {
  return parseEntitySpec(entities).entities.length;
}

/** JSON body POST /api/submit accepts from the wizard. */
export interface SubmitRequestBody {
  /** Trimmed prompt. */
  prompt: string;
  /** App type chip or free text. */
  appType: string;
  /** Whether the described app needs sign-in. */
  hasAuth: boolean;
  /** Integer count. The names themselves go in entityNames. */
  entities: number;
  /** Trimmed entity names from the wizard field. May be empty. */
  entityNames: string;
}

/**
 * Build the POST /api/submit body.
 *
 * The integer `entities` count stays what the server already validated.
 * `entityNames` is the wizard's free-text list, sent separately so the
 * queue can store the names.
 *
 * @param answers - Current wizard answers.
 * @param entityCount - {@link countEntities} of `answers.entities`.
 * @returns Body for `JSON.stringify`.
 */
export function submitRequestBody(answers: WizardAnswers, entityCount: number): SubmitRequestBody {
  return {
    prompt: answers.prompt.trim(),
    appType: answers.appType,
    hasAuth: answers.hasAuth,
    entities: entityCount,
    entityNames: answers.entities.trim()
  };
}

/**
 * Normalize optional wizard fields so callers that only set core fields
 * (submit API) still produce a complete WizardAnswers object.
 *
 * @param partial - Core or full wizard answers.
 * @returns Full WizardAnswers with defaults applied.
 */
export function withWizardDefaults(
  partial: Pick<WizardAnswers, 'prompt' | 'appType' | 'hasAuth' | 'entities'> &
    Partial<
      Pick<WizardAnswers, 'dataStorage' | 'hasRealtime' | 'integrations' | 'selectedFeatureIds'>
    >
): WizardAnswers {
  return {
    prompt: partial.prompt,
    appType: partial.appType,
    hasAuth: partial.hasAuth,
    entities: partial.entities,
    dataStorage: partial.dataStorage ?? DEFAULT_DATA_STORAGE,
    hasRealtime: partial.hasRealtime ?? false,
    integrations: partial.integrations ?? '',
    selectedFeatureIds: partial.selectedFeatureIds ?? null
  };
}

/**
 * Build a job object from wizard answers (pure).
 * Emits a full orchestrator-valid job: answers map + createdAt, plus fixed
 * targetType and threshold. Used by the client and by POST /api/submit.
 *
 * Extra scope fields are included in the answers map for local PRD use; the
 * submit Zod schema stays on the original four fields so no migration is needed.
 *
 * @param answers - Wizard form values (or core subset; defaults fill the rest).
 * @param now - Clock for createdAt (injectable for tests).
 * @returns BuildJob that must pass orchestrator JobSchema.
 */
export function buildJob(
  answers: Pick<WizardAnswers, 'prompt' | 'appType' | 'hasAuth' | 'entities'> &
    Partial<
      Pick<WizardAnswers, 'dataStorage' | 'hasRealtime' | 'integrations' | 'selectedFeatureIds'>
    >,
  now: Date = new Date()
): BuildJob {
  const full = withWizardDefaults(answers);
  const prompt = full.prompt.trim();
  return {
    kind: 'job',
    slug: slugFromPrompt(prompt),
    prompt,
    targetType: 'fullstack-web',
    threshold: 90,
    answers: {
      appType: full.appType,
      hasAuth: full.hasAuth ? 'true' : 'false',
      entities: full.entities,
      dataStorage: full.dataStorage,
      hasRealtime: full.hasRealtime ? 'true' : 'false',
      integrations: full.integrations.trim(),
      ...(full.selectedFeatureIds !== null
        ? { selectedFeatureIds: full.selectedFeatureIds.join(',') }
        : {})
    },
    createdAt: now.toISOString()
  };
}
