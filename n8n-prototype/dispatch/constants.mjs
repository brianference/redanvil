/**
 * Shared ids and limits for the build workflow and the owner dispatch registry.
 * The generator and the CLI both import these so a fixed id cannot drift.
 */

/** Workflow id baked into workflows/redanvil-full-build.json. */
export const BUILD_WORKFLOW_ID = 'redanvilFull001';

/**
 * Workflow id baked into workflows/redanvil-errors.json.
 * The build workflow's settings.errorWorkflow points at this.
 */
export const ERROR_WORKFLOW_ID = 'redanvilErrors001';

/** How long a gate stays open before n8n's Wait limit fires. Two hours. */
export const GATE_TTL_MS = 2 * 60 * 60 * 1000;

/** Gallery HTML larger than this is refused rather than written. */
export const GALLERY_MAX_BYTES = 15 * 1024 * 1024;

/**
 * A running or new execution older than this, with no owner waiting on it,
 * is an orphan. Waiting executions are orphans when no pending record matches,
 * regardless of age.
 */
export const STALE_EXECUTION_MS = 24 * 60 * 60 * 1000;

/**
 * Redo loops for a gate that does not set maxCycles.
 * Same fallback as run-build.mjs (`step.maxCycles ?? 3`).
 */
export const DEFAULT_MAX_CYCLES = 3;

/** Filename-safe registry id. Also the contract's id pattern. */
export const ID_PATTERN = /^[a-z0-9-]+$/;

/** Job statuses that are finished. Anything else in jobs/ is in flight. */
export const TERMINAL_JOB_STATUSES = new Set(['done', 'failed', 'rejected']);

/** Decisions a gate form can carry. reject is not one of them. */
export const GATE_DECISIONS = new Set(['approve', 'redo']);

/** Decisions resolve accepts for a job-approval record. */
// No `redo` for a job: the poller cannot act on it, and resolving would remove
// the pending record and strand the job at awaiting_owner.
export const JOB_DECISIONS = new Set(['approve', 'reject']);
