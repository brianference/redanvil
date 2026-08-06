/**
 * PM design precondition -- design deliverables must exist and be real before
 * any BUILD role (engineer, content, testwriter) may be dispatched.
 *
 * A file that exists is not a decision: blank or placeholder DECISION.md counts
 * as MISSING (process map "DECISION.md blank" loop-back).
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Role, RoleId } from './roles';
import { getRole } from './roles';
import type { RoleAssignment } from './assign';
import type { PmIterationPlan } from './pm';

/** Roles that must not run until design is decided. */
export const BUILD_ROLE_IDS = Object.freeze([
  'engineer',
  'content',
  'testwriter'
] as const satisfies readonly RoleId[]);

/** Design roles the PM assigns first when deliverables are missing. */
export const DESIGN_ROLE_IDS = Object.freeze([
  'logo',
  'layout'
] as const satisfies readonly RoleId[]);

/** Required logo files under design-refs/logo/. */
export const LOGO_REQUIRED_FILES = Object.freeze([
  'design-refs/logo/mark-01.png',
  'design-refs/logo/mark-02.png',
  'design-refs/logo/mark-03.png',
  'design-refs/logo/gallery.html',
  'design-refs/logo/DECISION.md'
] as const);

/** Required layout files under design-refs/design-options/. */
export const LAYOUT_REQUIRED_FILES = Object.freeze([
  'design-refs/design-options/gallery.html',
  'design-refs/design-options/DECISION.md'
] as const);

/** Scaffold / unwritten markers that mean the decision was never finished. */
const UNWRITTEN_MARKERS: readonly RegExp[] = [
  /\bTBD\b/i,
  /Fill this in/i,
  /\bTODO\b/i,
  /\[UNWRITTEN/i,
  /THIS DOCUMENT HAS NOT BEEN WRITTEN/i,
  /\bplaceholder\b/i,
  /\bcoming soon\b/i
];

/**
 * Whether a path is a non-empty regular file.
 *
 * @param abs - Absolute path.
 * @returns True when the file exists and has size > 0.
 */
function isNonEmptyFile(abs: string): boolean {
  if (!existsSync(abs)) return false;
  try {
    const st = statSync(abs);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

/**
 * Whether DECISION.md names a real choice and reason (not blank/placeholder).
 *
 * @param doc - Document text.
 * @returns ok + failure reasons.
 */
export function isRealDecision(doc: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const trimmed = doc.trim();
  if (trimmed.length < 40) {
    reasons.push('DECISION.md is empty or near-empty — not a completed design decision');
    return { ok: false, reasons };
  }
  for (const re of UNWRITTEN_MARKERS) {
    if (re.test(trimmed)) {
      reasons.push(
        `DECISION.md still contains a placeholder/unwritten marker (/${re.source.slice(0, 40)}/)`
      );
      break;
    }
  }
  const namesChoice =
    /\b(chosen|selected|picked|we chose|chose option|choice\s*:|selected option)\b/i.test(
      trimmed
    ) || /\boption\s*[ABC1-3]\b/i.test(trimmed) || /\bmark-0[123]\b/i.test(trimmed);
  if (!namesChoice) {
    reasons.push(
      'DECISION.md must name which option/mark was chosen (e.g. "Chosen: mark-02" or "we selected option B")'
    );
  }
  const hasWhy =
    /\b(because|reason|why|trade-?off|prefer|better for|wins on)\b/i.test(trimmed);
  if (!hasWhy) {
    reasons.push('DECISION.md must state why the option was chosen');
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Result of checking design deliverables on disk.
 */
export interface DesignDeliverablesStatus {
  /** True only when logo + layout artifacts and real DECISION.md files exist. */
  ok: boolean;
  /** Relative paths that are absent or empty. */
  missingFiles: string[];
  /** Human-readable failure reasons (including blank DECISION.md). */
  reasons: string[];
  /** Logo side is complete. */
  logoOk: boolean;
  /** Layout side is complete. */
  layoutOk: boolean;
}

/**
 * Verify design-refs logo + layout deliverables are present and decided.
 *
 * Failing inputs (each must refuse build dispatch):
 * - no design-refs at all
 * - files present but DECISION.md empty / TBD / placeholder
 *
 * @param appDir - App root (absolute or cwd-relative).
 * @returns Status with missing paths and reasons.
 */
export function evaluateDesignDeliverables(appDir: string): DesignDeliverablesStatus {
  const missingFiles: string[] = [];
  const reasons: string[] = [];

  for (const rel of LOGO_REQUIRED_FILES) {
    if (!isNonEmptyFile(join(appDir, rel))) {
      missingFiles.push(rel);
    }
  }
  for (const rel of LAYOUT_REQUIRED_FILES) {
    if (!isNonEmptyFile(join(appDir, rel))) {
      missingFiles.push(rel);
    }
  }

  if (missingFiles.length > 0) {
    reasons.push(
      `design deliverables absent or empty: ${missingFiles.join(', ')}`
    );
  }

  // A file that exists is not a decision — evaluate DECISION.md content.
  const logoDecision = join(appDir, 'design-refs/logo/DECISION.md');
  if (isNonEmptyFile(logoDecision)) {
    const evalDoc = isRealDecision(readFileSync(logoDecision, 'utf8'));
    if (!evalDoc.ok) {
      reasons.push(...evalDoc.reasons.map((r) => `logo: ${r}`));
      // Count as missing for dispatch purposes.
      if (!missingFiles.includes('design-refs/logo/DECISION.md')) {
        missingFiles.push('design-refs/logo/DECISION.md');
      }
    }
  }

  const layoutDecision = join(appDir, 'design-refs/design-options/DECISION.md');
  if (isNonEmptyFile(layoutDecision)) {
    const evalDoc = isRealDecision(readFileSync(layoutDecision, 'utf8'));
    if (!evalDoc.ok) {
      reasons.push(...evalDoc.reasons.map((r) => `layout: ${r}`));
      if (!missingFiles.includes('design-refs/design-options/DECISION.md')) {
        missingFiles.push('design-refs/design-options/DECISION.md');
      }
    }
  }

  const logoOk =
    LOGO_REQUIRED_FILES.every((rel) => isNonEmptyFile(join(appDir, rel))) &&
    isNonEmptyFile(logoDecision) &&
    isRealDecision(readFileSync(logoDecision, 'utf8')).ok;

  const layoutOk =
    LAYOUT_REQUIRED_FILES.every((rel) => isNonEmptyFile(join(appDir, rel))) &&
    isNonEmptyFile(layoutDecision) &&
    isRealDecision(readFileSync(layoutDecision, 'utf8')).ok;

  return {
    ok: logoOk && layoutOk && reasons.length === 0,
    missingFiles,
    reasons,
    logoOk,
    layoutOk
  };
}

/**
 * Outcome of applying the design gate to a PM plan.
 */
export interface DesignPreconditionResult {
  /** Plan after filtering build roles and forcing design roles when needed. */
  plan: PmIterationPlan;
  /** Build role ids refused this iteration. */
  refusedBuildRoles: RoleId[];
  /** Design role ids assigned (or already present) because deliverables are missing. */
  assignedDesignRoles: RoleId[];
  /** Human-readable refusal / status lines (for logs and tests). */
  messages: string[];
  /** Deliverables status that drove the decision. */
  deliverables: DesignDeliverablesStatus;
}

/**
 * Ensure design roles appear in assignments when deliverables are incomplete.
 *
 * @param assignments - Current plan assignments.
 * @param roles - Registry.
 * @param deliverables - Disk check result.
 * @returns Assignments with logo/layout forced as needed.
 */
function ensureDesignAssignments(
  assignments: RoleAssignment[],
  roles: readonly Role[],
  deliverables: DesignDeliverablesStatus
): { assignments: RoleAssignment[]; assignedDesignRoles: RoleId[] } {
  const assignedDesignRoles: RoleId[] = [];
  const byId = new Map(assignments.map((a) => [a.role.id, a]));

  const needLogo = !deliverables.logoOk;
  const needLayout = !deliverables.layoutOk;

  for (const id of DESIGN_ROLE_IDS) {
    const needed = id === 'logo' ? needLogo : needLayout;
    if (!needed) continue;
    assignedDesignRoles.push(id);
    if (byId.has(id)) continue;
    const role = roles.find((r) => r.id === id) ?? getRole(id);
    if (!role) continue;
    byId.set(id, {
      role,
      rows: [],
      matchedOwns: [...role.owns]
    });
  }

  return {
    assignments: [...byId.values()],
    assignedDesignRoles
  };
}

/**
 * Apply the design-before-build gate to a PM iteration plan.
 *
 * When design deliverables are missing or undecided:
 * - strip engineer / content / testwriter from the plan
 * - assign logo and/or layout first
 * - emit explicit refusal messages
 *
 * When deliverables are complete, the plan is unchanged (build roles dispatch).
 *
 * @param plan - Raw plan from planIteration.
 * @param appDir - App directory to inspect.
 * @param roles - Role registry.
 * @returns Gated plan + refusal evidence.
 */
export function enforceDesignBeforeBuild(
  plan: PmIterationPlan,
  appDir: string,
  roles: readonly Role[]
): DesignPreconditionResult {
  const deliverables = evaluateDesignDeliverables(appDir);
  const messages: string[] = [];

  if (deliverables.ok) {
    messages.push(
      'design precondition: deliverables present and decided — build roles may dispatch'
    );
    return {
      plan,
      refusedBuildRoles: [],
      assignedDesignRoles: [],
      messages,
      deliverables
    };
  }

  const priorIds = plan.assignments.map((a) => a.role.id);
  const refusedBuildRoles = plan.assignments
    .filter((a) => (BUILD_ROLE_IDS as readonly string[]).includes(a.role.id))
    .map((a) => a.role.id);

  // Score-raising build work is blocked. QA/debugger/etc. cannot raise the
  // score either until design (and then build) land — pay only for unblocking
  // design roles (logo/layout), not a full fan-out.
  const designOnlySeed = plan.assignments.filter((a) =>
    (DESIGN_ROLE_IDS as readonly string[]).includes(a.role.id)
  );

  const { assignments: withDesign, assignedDesignRoles } = ensureDesignAssignments(
    designOnlySeed,
    roles,
    deliverables
  );

  // Keep only logo/layout — never reintroduce non-design roles here.
  const onlyDesign = withDesign.filter((a) =>
    (DESIGN_ROLE_IDS as readonly string[]).includes(a.role.id)
  );
  const finalIds = new Set(onlyDesign.map((a) => a.role.id));
  // Count prior plan roles that no longer dispatch (force-added design roles
  // are not "saved" — they still run).
  const sessionsSaved = priorIds.filter((id) => !finalIds.has(id)).length;

  if (refusedBuildRoles.length > 0) {
    messages.push(
      `pm: REFUSED to dispatch build role(s) [${refusedBuildRoles.join(', ')}] — ` +
        'design deliverables missing or undecided; only unblocking design roles run'
    );
  } else {
    messages.push(
      'pm: design deliverables missing or undecided — assigning design roles only (no full fan-out)'
    );
  }
  for (const r of deliverables.reasons) {
    messages.push(`  - ${r}`);
  }
  if (assignedDesignRoles.length > 0) {
    messages.push(
      `pm: assigning design role(s) first: ${assignedDesignRoles.join(', ')}`
    );
  }
  if (sessionsSaved > 0) {
    messages.push(
      `pm: iteration economy — skipped ${sessionsSaved} role session(s) with no path to a better score`
    );
  }

  const gated: PmIterationPlan = {
    iteration: plan.iteration,
    assignments: onlyDesign,
    worktreeRoles: onlyDesign.filter((a) => a.role.needsWorktree).map((a) => a.role.id),
    readOnlyRoles: onlyDesign.filter((a) => !a.role.needsWorktree).map((a) => a.role.id),
    sessionsSavedThisIteration: sessionsSaved
  };

  return {
    plan: gated,
    refusedBuildRoles,
    assignedDesignRoles,
    messages,
    deliverables
  };
}
