/**
 * Load product-judgement opts for isDone from evidence on disk.
 *
 * qaVisualOk, userRefuseOk and independentReviewOk are fail-closed when the
 * files are absent (SPEC §3, §3b, §6). independentReviewOk is also pinned to
 * HEAD: a report for a different commit is not evidence for this gate.
 */

import {
  headCommit,
  independentReviewOkFromReport,
  readJudgeDiffReport
} from '../loop/independentReview';
import { qaVisualOkFromReport, readQaVisualReport } from './qaVisual';
import { readRefusalReport, userRefuseOkFromReport } from './userRefuse';

/**
 * isDone option fragment for product judgement.
 */
export interface ProductJudgementOpts {
  qaVisualOk: boolean;
  userRefuseOk: boolean;
  /** Independent judge-over-diff at HEAD; false when missing or stale. */
  independentReviewOk: boolean;
}

/**
 * Read QA-visual, user-refuse and judge-diff reports for an app and return
 * isDone opts.
 *
 * @param appDir - App root that may contain evidence/.
 * @param slug - App slug used in evidence file names.
 * @returns Opts that pass only when each report accepts (fail-closed).
 */
export function loadProductJudgementOpts(appDir: string, slug: string): ProductJudgementOpts {
  const expectedCommit = headCommit(appDir);
  return {
    qaVisualOk: qaVisualOkFromReport(readQaVisualReport(appDir, slug)),
    userRefuseOk: userRefuseOkFromReport(readRefusalReport(appDir, slug)),
    independentReviewOk: independentReviewOkFromReport(
      readJudgeDiffReport(appDir, slug),
      expectedCommit
    )
  };
}
