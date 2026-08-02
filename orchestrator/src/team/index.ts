/**
 * Autonomous app team -- public surface.
 */

export {
  ROLES,
  expandArtifacts,
  getRole,
  type Role,
  type RoleId
} from './roles';

export {
  assignUnmetRows,
  findUnownedChecklistRows,
  ownershipTokensForRow,
  rolesForRow,
  UnownedRowError,
  type AssignResult,
  type RoleAssignment
} from './assign';

export {
  decideQaVisual,
  reasonsForObservation,
  isYInViewport,
  isExcludedFromJudgement,
  buildQaVisualReport,
  writeQaVisualReport,
  readQaVisualReport,
  qaVisualOkFromReport,
  knownBadBelowFoldMetrics,
  knownGoodInViewMetrics,
  MIN_BRAND_MARK_DESKTOP,
  MIN_BRAND_MARK_MOBILE,
  type QaVisualMetrics,
  type QaVisualFinding,
  type QaVisualReport,
  type QaVisualVerdict
} from './qaVisual';

export {
  decideUserRefuse,
  primaryResultOffScreen,
  buildRefusalReport,
  writeRefusalReport,
  readRefusalReport,
  userRefuseOkFromReport,
  knownBadBelowFoldStrangerView,
  knownGoodInViewStrangerView,
  SEED_COMPLAINT_STANDARD,
  type StrangerView,
  type RefusalComplaint,
  type RefusalReport,
  type RefusalVerdict
} from './userRefuse';

export {
  runPm,
  planIteration,
  dryRunAssignments,
  type PmDeps,
  type PmConfig,
  type PmResult,
  type PmIterationPlan
} from './pm';

export {
  loadProductJudgementOpts,
  type ProductJudgementOpts
} from './finishOpts';

export {
  buildAssignment,
  installWorktreeEnforcement,
  evaluatePreCommit,
  evaluateCommitMsg,
  evaluatePromoteGuards,
  readAssignment,
  writeAssignment,
  missingArtifacts,
  messageClaimsDone,
  type WorktreeAssignment
} from './worktreeEnforcement';
