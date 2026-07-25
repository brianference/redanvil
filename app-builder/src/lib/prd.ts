/**
 * Thin re-export so existing imports of `../lib/prd` and `./prd` keep working
 * after the split into `prd/` modules. Public API is unchanged.
 */
export type {
  Prd,
  TokenEstimate,
  PrdSelfCheckItem,
  PrdSelfCheckResult
} from './prd/index';
export { PRD_SECTION_HEADINGS, evaluatePrdSelfCheck, generatePrd } from './prd/index';
