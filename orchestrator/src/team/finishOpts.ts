/**
 * Load product-judgement opts for isDone from evidence on disk.
 *
 * qaVisualOk and userRefuseOk are fail-closed when the files are absent
 * (SPEC §3, §3b, §6).
 */

import { qaVisualOkFromReport, readQaVisualReport } from './qaVisual';
import { readRefusalReport, userRefuseOkFromReport } from './userRefuse';

/**
 * isDone option fragment for product judgement.
 */
export interface ProductJudgementOpts {
  qaVisualOk: boolean;
  userRefuseOk: boolean;
}

/**
 * Read QA-visual and user-refuse reports for an app and return isDone opts.
 *
 * @param appDir - App root that may contain evidence/.
 * @param slug - App slug used in evidence file names.
 * @returns Opts that pass only when both reports accept.
 */
export function loadProductJudgementOpts(appDir: string, slug: string): ProductJudgementOpts {
  return {
    qaVisualOk: qaVisualOkFromReport(readQaVisualReport(appDir, slug)),
    userRefuseOk: userRefuseOkFromReport(readRefusalReport(appDir, slug))
  };
}
