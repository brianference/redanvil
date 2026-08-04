/**
 * Load product-judgement opts for isDone from evidence on disk.
 *
 * qaVisualOk, userRefuseOk and independentReviewOk are fail-closed when the
 * files are absent (SPEC §3, §3b, §6). independentReviewOk is pinned to the
 * app's newest SOURCE commit (not repo HEAD): a report for a different source
 * tree is not evidence for this gate; an evidence-only commit does not age it.
 */

import {
  independentReviewOkFromReport,
  readJudgeDiffReport
} from '../loop/independentReview';
import { loadAcceptedFindings } from '../gate/acceptedFindings.mjs';
import { gitRoot, reviewPinCommit } from '../git/newestSourceCommit.mjs';
import { qaVisualOkFromReport, readQaVisualReport } from './qaVisual';
import { readRefusalReport, userRefuseOkFromReport } from './userRefuse';

/**
 * isDone option fragment for product judgement.
 */
export interface ProductJudgementOpts {
  qaVisualOk: boolean;
  userRefuseOk: boolean;
  /**
   * Independent judge-over-diff at the app's newest source commit; false when
   * missing, stale, incomplete, or carrying unaccepted failing findings.
   */
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
  const expectedCommit = reviewPinCommit(appDir);
  const report = readJudgeDiffReport(appDir, slug);
  const root = gitRoot(appDir);
  const accepted = root !== null ? loadAcceptedFindings(root, slug) : [];
  return {
    qaVisualOk: qaVisualOkFromReport(readQaVisualReport(appDir, slug)),
    userRefuseOk: userRefuseOkFromReport(readRefusalReport(appDir, slug)),
    independentReviewOk: independentReviewOkFromReport(report, expectedCommit, {
      app: slug,
      acceptedFindings: accepted
    })
  };
}
