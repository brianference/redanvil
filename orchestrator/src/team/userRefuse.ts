/**
 * user-refuse -- play a hard-to-please stranger after everything else is green.
 *
 * Receives only what a stranger gets: purpose text and observed page facts.
 * Default answer is no. A refusal blocks isDone at any score
 * (docs/SPEC-agent-team.md §3b).
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Accept or refuse -- refuse blocks the finish line. */
export type RefusalVerdict = 'accept' | 'refuse';

/**
 * Observations available to a stranger (no PRD, no checklist, no diff).
 */
export interface StrangerView {
  /** App's own description of itself (e.g. from the homepage). */
  appDescription: string;
  /** Deployed URL the stranger was given. */
  url: string;
  /**
   * Whether the stranger could accomplish the stated purpose end to end.
   * False or unknown fails closed to a complaint.
   */
  purposeAccomplished: boolean;
  /** Document y of the primary control's result, when measured. */
  primaryResultY: number | null;
  /** Viewport height used for the observation. */
  viewportHeight: number;
  /** True when something advertised clearly does not work. */
  advertisedBroken: boolean;
  /** True when any visible state looks like a bug. */
  looksBuggy: boolean;
  /** Rendered brand-mark height in px, when measured. */
  brandMarkHeight?: number;
  /** Free-form notes the agent wrote while using the app. */
  notes?: string[];
}

/**
 * One complaint a stranger would raise.
 */
export interface RefusalComplaint {
  /** Short complaint text. */
  text: string;
  /** Optional owning-role hint for the PM feedback loop. */
  suggestedOwner?: string;
}

/**
 * On-disk report: evidence/refusal-<slug>.json
 */
export interface RefusalReport {
  verdict: RefusalVerdict;
  complaints: RefusalComplaint[];
  /** Whether purpose was accomplished. */
  purposeAccomplished: boolean;
  /** Answers to the required questions. */
  answers: {
    primaryResultOffScreen: boolean;
    advertisedBroken: boolean;
    looksBuggy: boolean;
    looksFinished: boolean;
  };
  /** ISO timestamp. */
  writtenAt: string;
  slug: string;
  /**
   * Human override recorded in the same file. Only a human may set this;
   * another agent or the PM may not.
   */
  humanOverride?: {
    acceptDespiteRefusal: boolean;
    reason: string;
    recordedAt: string;
  };
}

/** Seed complaints from the session that produced this role. */
export const SEED_COMPLAINT_STANDARD: readonly string[] = Object.freeze([
  "the search doesn't appear to work",
  'the logo is way too small',
  "I can't type Sierra Vista",
  "there's no autocomplete"
]);

/**
 * Whether the primary result sits outside the first viewport.
 *
 * @param y - Document y of the result, or null when unknown.
 * @param viewportHeight - Viewport height.
 * @returns True when off-screen or unknown (fail closed).
 */
export function primaryResultOffScreen(
  y: number | null,
  viewportHeight: number
): boolean {
  if (y === null || y === undefined || !Number.isFinite(y)) return true;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return true;
  return y >= viewportHeight;
}

/**
 * Decide accept/refuse from stranger observations.
 *
 * Default is refuse. Accept only when purpose was accomplished, nothing
 * material is off-screen or broken, and the page does not look buggy.
 *
 * @param view - What a stranger can see and do.
 * @returns Verdict and complaints (at least three when refusing for product issues).
 */
export function decideUserRefuse(view: StrangerView): {
  verdict: RefusalVerdict;
  complaints: RefusalComplaint[];
  answers: RefusalReport['answers'];
} {
  const complaints: RefusalComplaint[] = [];
  const offScreen = primaryResultOffScreen(view.primaryResultY, view.viewportHeight);

  if (offScreen) {
    complaints.push({
      text:
        view.primaryResultY === null
          ? "the search doesn't appear to work -- no result was visible"
          : `the search result is off-screen (y=${view.primaryResultY} in a ${view.viewportHeight}px viewport)`,
      suggestedOwner: 'qa-visual'
    });
  }

  if (view.advertisedBroken) {
    complaints.push({
      text: 'something advertised does not work',
      suggestedOwner: 'engineer'
    });
  }

  if (view.looksBuggy) {
    complaints.push({
      text: 'a visible state looks like a bug',
      suggestedOwner: 'debugger'
    });
  }

  if (view.purposeAccomplished !== true) {
    complaints.push({
      text: "could not accomplish the app's stated purpose end to end",
      suggestedOwner: 'engineer'
    });
  }

  if (
    view.brandMarkHeight !== undefined &&
    Number.isFinite(view.brandMarkHeight) &&
    view.brandMarkHeight < 32
  ) {
    complaints.push({
      text: 'the logo is way too small',
      suggestedOwner: 'logo'
    });
  }

  for (const note of view.notes ?? []) {
    const lower = note.toLowerCase();
    if (SEED_COMPLAINT_STANDARD.some((s) => lower.includes(s.toLowerCase().slice(0, 12)))) {
      complaints.push({ text: note });
    }
  }

  const looksFinished =
    complaints.length === 0 &&
    view.purposeAccomplished === true &&
    !offScreen &&
    !view.advertisedBroken &&
    !view.looksBuggy;

  const answers: RefusalReport['answers'] = {
    primaryResultOffScreen: offScreen,
    advertisedBroken: view.advertisedBroken === true,
    looksBuggy: view.looksBuggy === true,
    looksFinished
  };

  // Default is no.
  if (!looksFinished) {
    // Ensure at least one complaint when refusing.
    if (complaints.length === 0) {
      complaints.push({
        text: 'would not call this finished -- default refuse'
      });
    }
    return { verdict: 'refuse', complaints, answers };
  }

  return { verdict: 'accept', complaints: [], answers };
}

/**
 * Build the on-disk refusal report.
 *
 * @param input - Slug and stranger view.
 * @returns Report ready to write.
 */
export function buildRefusalReport(input: {
  slug: string;
  view: StrangerView;
  writtenAt?: string;
}): RefusalReport {
  const decision = decideUserRefuse(input.view);
  return {
    verdict: decision.verdict,
    complaints: decision.complaints,
    purposeAccomplished: input.view.purposeAccomplished === true,
    answers: decision.answers,
    writtenAt: input.writtenAt ?? new Date().toISOString(),
    slug: input.slug
  };
}

/**
 * Write evidence/refusal-<slug>.json.
 *
 * @param rootDir - App or repo root.
 * @param report - Report to write.
 * @returns Absolute path written.
 */
export function writeRefusalReport(rootDir: string, report: RefusalReport): string {
  const rel = join('evidence', `refusal-${report.slug}.json`);
  const abs = join(rootDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return abs;
}

/**
 * Read a refusal report from disk.
 *
 * @param rootDir - App or repo root.
 * @param slug - App slug.
 * @returns Parsed report, or null when absent.
 */
export function readRefusalReport(rootDir: string, slug: string): RefusalReport | null {
  const abs = join(rootDir, 'evidence', `refusal-${slug}.json`);
  if (!existsSync(abs)) return null;
  try {
    const raw = JSON.parse(readFileSync(abs, 'utf8')) as RefusalReport;
    if (raw.verdict !== 'accept' && raw.verdict !== 'refuse') return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Whether isDone may treat user-refuse as satisfied.
 *
 * Accept, or a recorded human override. Never another agent.
 *
 * @param report - Loaded report, or null when missing.
 * @returns True when accept or valid human override.
 */
export function userRefuseOkFromReport(report: RefusalReport | null): boolean {
  if (report === null) return false;
  if (report.verdict === 'accept') return true;
  if (
    report.humanOverride?.acceptDespiteRefusal === true &&
    typeof report.humanOverride.reason === 'string' &&
    report.humanOverride.reason.trim() !== ''
  ) {
    return true;
  }
  return false;
}

/**
 * Stranger view for the known-bad below-the-fold fixture.
 *
 * @returns View that must REFUSE and name the off-screen search.
 */
export function knownBadBelowFoldStrangerView(): StrangerView {
  return {
    appDescription: 'Search crops and see when to plant them in Arizona.',
    url: 'https://example.test/below-fold',
    purposeAccomplished: false,
    primaryResultY: 1942,
    viewportHeight: 900,
    advertisedBroken: false,
    looksBuggy: false,
    brandMarkHeight: 48
  };
}

/**
 * Stranger view for the fixed in-view page.
 *
 * @returns View that may ACCEPT.
 */
export function knownGoodInViewStrangerView(): StrangerView {
  return {
    appDescription: 'Search crops and see when to plant them in Arizona.',
    url: 'https://example.test/in-view',
    purposeAccomplished: true,
    primaryResultY: 80,
    viewportHeight: 900,
    advertisedBroken: false,
    looksBuggy: false,
    brandMarkHeight: 48
  };
}
