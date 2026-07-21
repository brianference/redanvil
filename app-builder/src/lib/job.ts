/** Wizard answers collected before a build job is committed. */
export interface WizardAnswers {
  /** Free-text description of the app to build. */
  prompt: string;
  /** High-level app type (e.g. marketplace, dashboard). */
  appType: string;
  /** Whether the app needs authentication. */
  hasAuth: boolean;
  /** Comma-separated main domain entity names. */
  entities: string;
}

/** Build job payload consumed by the orchestrator (kind = job). */
export interface BuildJob {
  kind: 'job';
  /** Kebab-case slug derived from the prompt. */
  slug: string;
  /** Original user prompt. */
  prompt: string;
  /** Always fullstack-web for this wizard. */
  targetType: 'fullstack-web';
  /** Gate pass threshold (default 90). */
  threshold: 90;
}

const SLUG_MAX = 49;
const SLUG_FALLBACK = 'app';

/**
 * Derive a kebab-case slug from free text.
 * Shape: starts with [a-z0-9], then [a-z0-9-], length 2–49.
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
 * Count main entities from a comma / semicolon / newline separated list.
 */
export function countEntities(entities: string): number {
  return entities
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

/**
 * Build a job object from wizard answers.
 * Slug is kebab-case derived from the prompt; targetType and threshold are fixed.
 */
export function buildJob(answers: WizardAnswers): BuildJob {
  const prompt = answers.prompt.trim();
  return {
    kind: 'job',
    slug: slugFromPrompt(prompt),
    prompt,
    targetType: 'fullstack-web',
    threshold: 90
  };
}
