/**
 * QA-visual -- product judgement a mechanical rule cannot make.
 *
 * Pure decision over a metrics object so vitest and pytest/hypothesis both
 * exercise the same path the gate uses (docs/SPEC-agent-team.md §3).
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Pass or fail -- a fail blocks isDone at any score. */
export type QaVisualVerdict = 'pass' | 'fail';

/**
 * Measured facts for one route x viewport x theme observation.
 * All lengths are CSS pixels. y grows downward from the top of the document.
 */
export interface QaVisualMetrics {
  /** Viewport width used for the observation. */
  viewportWidth: number;
  /** Viewport height used for the observation. */
  viewportHeight: number;
  /**
   * Document y of the primary control's result (nearest changed element after
   * the primary action). Null when no result element was found.
   */
  primaryResultY: number | null;
  /** Height of the primary result element, when known. */
  primaryResultHeight: number;
  /** Rendered brand-mark height in the header. */
  brandMarkHeight: number;
  /** Header bar height. */
  headerHeight: number;
  /** Hero / first content block height below the header. */
  heroHeight: number;
  /**
   * Count of truncated or placeholder-looking elements that are not
   * sr-only and not inside an overflow scroll container we treat as intentional.
   */
  truncatedElementCount: number;
  /** True when the primary action (search, submit) is inside the first viewport. */
  primaryActionAboveFold: boolean;
  /** Route path observed (for the report, not the decision). */
  route?: string;
  /** Theme label. */
  theme?: 'light' | 'dark';
}

/**
 * One written finding from the agent that looked at the screenshots.
 */
export interface QaVisualFinding {
  /** Short label (e.g. route + viewport). */
  where: string;
  /** What a first-time visitor would try first. */
  firstAction: string;
  /** Whether anything important is off-screen. */
  offScreen: string;
  /** Whether the page looks finished. */
  looksFinished: string;
  /** Free-form notice a person would see first. */
  firstNotice: string;
}

/**
 * On-disk report shape: evidence/qa-visual-<slug>.json
 */
export interface QaVisualReport {
  verdict: QaVisualVerdict;
  findings: QaVisualFinding[];
  measurements: {
    observations: QaVisualMetrics[];
    /** Reasons the pure decision failed, empty on pass. */
    failReasons: string[];
  };
  /** ISO timestamp when written. */
  writtenAt: string;
  /** App slug. */
  slug: string;
}

/** Minimum rendered brand-mark height at desktop (mirrors fe-brand-mark-size). */
export const MIN_BRAND_MARK_DESKTOP = 72;
/** Minimum rendered brand-mark height at mobile. */
export const MIN_BRAND_MARK_MOBILE = 48;
/** Viewport width at or above which desktop brand-mark floor applies. */
export const DESKTOP_WIDTH_FLOOR = 1280;

/**
 * Whether an element at document y is inside the first viewport.
 *
 * sr-only and overflow-scroll exclusions are applied by the caller before
 * constructing metrics (they never enter primaryResultY). This function only
 * compares y to the viewport.
 *
 * @param y - Document y of the element's top edge.
 * @param viewportHeight - Viewport height in CSS pixels.
 * @param elementHeight - Element height; top edge in view counts even if bottom clips.
 * @returns True when any part of the element intersects [0, viewportHeight).
 */
export function isYInViewport(
  y: number,
  viewportHeight: number,
  elementHeight = 0
): boolean {
  if (!Number.isFinite(y) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return false;
  }
  const bottom = y + Math.max(0, elementHeight);
  // Fully below the fold, or fully above (negative y past the element).
  if (y >= viewportHeight) return false;
  if (bottom <= 0) return false;
  return true;
}

/**
 * Whether a metrics sample should be excluded as sr-only or intentional scroll.
 *
 * Pure helper tested by vitest; the browser harness marks these before decide.
 *
 * @param flags - Exclusion flags from the measurer.
 * @returns True when this sample must not influence the verdict.
 */
export function isExcludedFromJudgement(flags: {
  srOnly?: boolean;
  insideScrollContainer?: boolean;
}): boolean {
  return flags.srOnly === true || flags.insideScrollContainer === true;
}

/**
 * Decide pass/fail over one metrics observation.
 *
 * Fail closed on missing primary result, result below the fold, primary action
 * off-screen, brand mark too small, or truncated content.
 *
 * @param m - Measured metrics for one observation.
 * @returns Fail reasons (empty array means this observation passes).
 */
export function reasonsForObservation(m: QaVisualMetrics): string[] {
  const reasons: string[] = [];
  const label = [
    m.route ?? 'route?',
    `${m.viewportWidth}x${m.viewportHeight}`,
    m.theme ?? 'theme?'
  ].join(' ');

  if (m.primaryResultY === null || m.primaryResultY === undefined) {
    reasons.push(`${label}: primary result y is missing (fail closed)`);
  } else if (
    !isYInViewport(m.primaryResultY, m.viewportHeight, m.primaryResultHeight ?? 0)
  ) {
    reasons.push(
      `${label}: primary result y=${m.primaryResultY} is outside viewport height ${m.viewportHeight}`
    );
  }

  if (m.primaryActionAboveFold !== true) {
    reasons.push(`${label}: primary action is not above the fold`);
  }

  const minMark =
    m.viewportWidth >= DESKTOP_WIDTH_FLOOR ? MIN_BRAND_MARK_DESKTOP : MIN_BRAND_MARK_MOBILE;
  if (!Number.isFinite(m.brandMarkHeight) || m.brandMarkHeight < minMark) {
    reasons.push(
      `${label}: brand-mark height ${m.brandMarkHeight}px is below floor ${minMark}px`
    );
  }

  if ((m.truncatedElementCount ?? 0) > 0) {
    reasons.push(
      `${label}: ${m.truncatedElementCount} truncated/placeholder element(s) visible`
    );
  }

  return reasons;
}

/**
 * Pure pass/fail decision over a list of metrics observations.
 *
 * Invariant: a result whose y exceeds the viewport height always fails.
 * Invariant: verdict does not depend on observation order or count of unrelated nodes.
 *
 * @param observations - One or more measured observations.
 * @returns Verdict and concatenated fail reasons.
 */
export function decideQaVisual(observations: readonly QaVisualMetrics[]): {
  verdict: QaVisualVerdict;
  failReasons: string[];
} {
  if (!observations || observations.length === 0) {
    return {
      verdict: 'fail',
      failReasons: ['no observations supplied -- missing measurement is a fail']
    };
  }

  const failReasons: string[] = [];
  for (const m of observations) {
    failReasons.push(...reasonsForObservation(m));
  }

  return {
    verdict: failReasons.length === 0 ? 'pass' : 'fail',
    failReasons
  };
}

/**
 * Build the on-disk report object.
 *
 * @param input - Slug, observations, and optional agent findings.
 * @returns Report ready to serialise.
 */
export function buildQaVisualReport(input: {
  slug: string;
  observations: readonly QaVisualMetrics[];
  findings?: readonly QaVisualFinding[];
  writtenAt?: string;
}): QaVisualReport {
  const decision = decideQaVisual(input.observations);
  return {
    verdict: decision.verdict,
    findings: [...(input.findings ?? [])],
    measurements: {
      observations: [...input.observations],
      failReasons: decision.failReasons
    },
    writtenAt: input.writtenAt ?? new Date().toISOString(),
    slug: input.slug
  };
}

/**
 * Write evidence/qa-visual-<slug>.json under a root directory.
 *
 * @param rootDir - App or repo root.
 * @param report - Report to write.
 * @returns Absolute path written.
 */
export function writeQaVisualReport(rootDir: string, report: QaVisualReport): string {
  const rel = join('evidence', `qa-visual-${report.slug}.json`);
  const abs = join(rootDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return abs;
}

/**
 * Read a QA-visual report from disk.
 *
 * @param rootDir - App or repo root.
 * @param slug - App slug.
 * @returns Parsed report, or null when absent / unreadable.
 */
export function readQaVisualReport(rootDir: string, slug: string): QaVisualReport | null {
  // Two conventions coexist in this repo: verdicts-<slug>.json and the
  // screenshot set live under the REPO root's evidence/, while this reader was
  // written against the APP dir. A report written to the documented-looking
  // place was then reported "missing", which reads as "the QA never ran" rather
  // than "it ran and I looked in the wrong folder" -- a silent false negative on
  // a fail-closed rule. Resolve both, app dir first.
  const candidates = [
    join(rootDir, 'evidence', `qa-visual-${slug}.json`),
    join(rootDir, '..', 'evidence', `qa-visual-${slug}.json`)
  ];
  for (const abs of candidates) {
    if (!existsSync(abs)) continue;
    try {
      const raw = JSON.parse(readFileSync(abs, 'utf8')) as QaVisualReport;
      if (raw.verdict !== 'pass' && raw.verdict !== 'fail') continue;
      return raw;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Whether isDone may treat QA-visual as satisfied.
 *
 * @param report - Loaded report, or null when missing.
 * @returns True only when verdict is explicitly pass.
 */
export function qaVisualOkFromReport(report: QaVisualReport | null): boolean {
  return report !== null && report.verdict === 'pass';
}

/**
 * Known-bad metrics: primary result 1000px below a 900px viewport fold.
 * Encodes this session's y=1942 defect as a fixture rather than a memory.
 *
 * @returns Metrics that must FAIL.
 */
export function knownBadBelowFoldMetrics(): QaVisualMetrics {
  return {
    viewportWidth: 1280,
    viewportHeight: 900,
    primaryResultY: 1942,
    primaryResultHeight: 40,
    brandMarkHeight: 72,
    headerHeight: 88,
    heroHeight: 200,
    truncatedElementCount: 0,
    primaryActionAboveFold: true,
    route: '/',
    theme: 'light'
  };
}

/**
 * Fixed metrics: result beside the input, inside the first viewport.
 *
 * @returns Metrics that must PASS.
 */
export function knownGoodInViewMetrics(): QaVisualMetrics {
  return {
    viewportWidth: 1280,
    viewportHeight: 900,
    primaryResultY: 80,
    primaryResultHeight: 40,
    brandMarkHeight: 72,
    headerHeight: 88,
    heroHeight: 200,
    truncatedElementCount: 0,
    primaryActionAboveFold: true,
    route: '/',
    theme: 'light'
  };
}
