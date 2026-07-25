/**
 * Public surface for the PRD generator.
 * Re-exports match the historical `lib/prd` module API exactly.
 */

export type { Prd, TokenEstimate, PrdSelfCheckItem, PrdSelfCheckResult } from './types';
export { PRD_SECTION_HEADINGS } from './types';
export { evaluatePrdSelfCheck } from './selfCheck';
export { generatePrd } from './generate';
