/**
 * PM product precondition -- product brief must exist before design or build.
 *
 * Gate-driven work only refuses what was built; product owns the PRD and the
 * outcome rows so a new app starts from promises, not from a missing design
 * file. Design-before-build stays intact and runs after this gate.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Role, RoleId } from './roles';
import { getRole } from './roles';
import { rolesForRow } from './assign';
import type { PmIterationPlan } from './pm';

/** Roles that must not run until the product brief exists. */
export const POST_PRODUCT_ROLE_IDS = Object.freeze([
  'logo',
  'layout',
  'engineer',
  'content',
  'testwriter'
] as const satisfies readonly RoleId[]);

/** Product role forced first when the brief is missing. */
export const PRODUCT_ROLE_ID = 'product' as const satisfies RoleId;

/**
 * Product brief path under the app (or monorepo docs/) relative to appDir.
 *
 * @param slug - App slug.
 * @returns Relative path template expansion.
 */
export function productBriefRel(slug: string): string {
  return `docs/${slug}-product-brief.md`;
}

/**
 * Authoritative PRD path the product role keeps.
 *
 * @param slug - App slug.
 * @returns Relative path.
 */
export function productPrdRel(slug: string): string {
  return `docs/${slug}-prd.md`;
}

/**
 * One product promise extracted from the PRD / product brief.
 */
export interface ProductPromise {
  /** Human-readable promise text. */
  name: string;
  /**
   * Checklist row id or rubric rule id this promise maps to.
   * Null/empty means the promise has no owning row -- hard error.
   */
  owningRow: string | null;
}

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
 * Status of product deliverables on disk.
 */
export interface ProductDeliverablesStatus {
  /** True when the product brief is present and non-empty. */
  ok: boolean;
  /** Relative paths that are absent or empty. */
  missingFiles: string[];
  /** Human-readable failure reasons. */
  reasons: string[];
  /** Resolved absolute path of the brief when found. */
  briefPath: string | null;
}

/**
 * Resolve product brief path: app-local docs/ first, then monorepo-style under appDir.
 *
 * @param appDir - App root.
 * @param slug - App slug.
 * @returns Absolute path if a non-empty brief exists, else null.
 */
export function resolveProductBriefPath(appDir: string, slug: string): string | null {
  const candidates = [
    join(appDir, productBriefRel(slug)),
    join(appDir, 'docs', `${slug}-product-brief.md`)
  ];
  for (const p of candidates) {
    if (isNonEmptyFile(p)) return p;
  }
  return null;
}

/**
 * Verify the product brief exists (artifact contract for the product role).
 *
 * @param appDir - App root.
 * @param slug - App slug.
 * @returns Deliverables status.
 */
export function evaluateProductDeliverables(
  appDir: string,
  slug: string
): ProductDeliverablesStatus {
  const rel = productBriefRel(slug);
  const abs = resolveProductBriefPath(appDir, slug);
  if (abs === null) {
    return {
      ok: false,
      missingFiles: [rel],
      reasons: [
        `product brief absent or empty: ${rel} — product has not run; design and build are blocked`
      ],
      briefPath: null
    };
  }
  return {
    ok: true,
    missingFiles: [],
    reasons: [],
    briefPath: abs
  };
}

/**
 * Parse product promises from a product-brief or PRD markdown body.
 *
 * Accepted line shapes (case-insensitive labels):
 * - `- Browse sitters | owns: B4`
 * - `- **Browse sitters** — row: fe-search-present`
 * - `| Browse sitters | B4 |` (table row)
 *
 * A promise line that names no row yields owningRow null (hard error later).
 *
 * @param markdown - Document text.
 * @returns Extracted promises (empty when no promises section / lines).
 */
export function parseProductPromises(markdown: string): ProductPromise[] {
  const lines = markdown.split(/\r?\n/);
  const promises: ProductPromise[] = [];
  let inPromises = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{1,3}\s+promises?\b/i.test(line)) {
      inPromises = true;
      continue;
    }
    if (inPromises && /^#{1,3}\s+/.test(line) && !/^#{1,3}\s+promises?\b/i.test(line)) {
      inPromises = false;
    }

    // Table row: | name | rowId |
    const table = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (table && inPromises) {
      const name = (table[1] ?? '').trim();
      const row = (table[2] ?? '').trim();
      if (/^name$/i.test(name) || /^-+$/.test(name) || /^owns/i.test(row)) continue;
      if (name.length === 0) continue;
      const owningRow =
        row.length === 0 || /^n\/?a$/i.test(row) || /^—$|^-$/.test(row) ? null : row;
      promises.push({ name, owningRow });
      continue;
    }

    // Bullet: - text | owns: ROW  or  - text — row: ROW
    const bullet = line.match(
      /^[-*]\s+(?:\*\*)?(.+?)(?:\*\*)?\s*(?:\||—|--)\s*(?:owns?|row)\s*:\s*([A-Za-z0-9._-]+)\s*$/i
    );
    if (bullet && (inPromises || /owns?|row\s*:/i.test(line))) {
      promises.push({
        name: (bullet[1] ?? '').trim(),
        owningRow: (bullet[2] ?? '').trim() || null
      });
      continue;
    }

    // Bullet with no owner: - some promise text  (only inside ## Promises)
    const bare = line.match(/^[-*]\s+(?:\*\*)?(.+?)(?:\*\*)?\s*$/);
    if (bare && inPromises && !/^\|/.test(line)) {
      const name = (bare[1] ?? '').trim();
      // Skip if it already matched an owns line above
      if (name.length > 0 && !/(?:owns?|row)\s*:/i.test(line)) {
        promises.push({ name, owningRow: null });
      }
    }
  }

  return promises;
}

/**
 * A PRD promise that does not map to any role-owned row.
 */
export interface UnownedPromise {
  /** Promise name. */
  name: string;
  /** Why it failed (no row declared, or row has no role owner). */
  reason: string;
}

/**
 * Hard-error check: every PRD promise must map to a row someone owns.
 *
 * Same fail-closed shape as an unmet checklist row with no owner.
 *
 * @param promises - Parsed promises.
 * @param roles - Role registry.
 * @returns Empty when complete; otherwise named failures.
 */
export function findPromisesWithoutOwner(
  promises: readonly ProductPromise[],
  roles: readonly Role[]
): UnownedPromise[] {
  const bad: UnownedPromise[] = [];
  for (const p of promises) {
    if (p.owningRow === null || p.owningRow.trim() === '') {
      bad.push({
        name: p.name,
        reason: `promise "${p.name}" has no owning row — every PRD promise must map to a checklist/rubric row someone owns`
      });
      continue;
    }
    const owners = rolesForRow(p.owningRow, roles);
    // rolesForRow only matches checklist row ids via CHECKLIST_RULE_MAP. Also
    // accept a direct owns[] token match (rule id such as fe-search-present).
    const direct = roles.filter((r) => r.owns.includes(p.owningRow!));
    if (owners.length === 0 && direct.length === 0) {
      bad.push({
        name: p.name,
        reason: `promise "${p.name}" maps to row/rule "${p.owningRow}" which no role owns`
      });
    }
  }
  return bad;
}

/**
 * Load promises from the product brief when present.
 *
 * @param appDir - App root.
 * @param slug - App slug.
 * @returns Promises, or empty when brief is missing.
 */
export function loadProductPromises(appDir: string, slug: string): ProductPromise[] {
  const path = resolveProductBriefPath(appDir, slug);
  if (path === null) return [];
  try {
    return parseProductPromises(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Outcome of applying the product-before-design gate.
 */
export interface ProductPreconditionResult {
  /** Plan after filtering post-product roles and forcing product when needed. */
  plan: PmIterationPlan;
  /** Role ids refused this iteration (design + build). */
  refusedRoles: RoleId[];
  /** Whether product was force-assigned. */
  assignedProduct: boolean;
  /** Log lines. */
  messages: string[];
  /** Deliverables status. */
  deliverables: ProductDeliverablesStatus;
}

/**
 * Apply product-before-design (and product-before-build) to a PM plan.
 *
 * When the product brief is missing:
 * - strip logo/layout/engineer/content/testwriter
 * - force-assign product
 * - emit explicit refusal messages
 *
 * When the brief exists, the plan is unchanged (design precondition still runs).
 *
 * @param plan - Raw or design-gated plan.
 * @param appDir - App directory.
 * @param slug - App slug.
 * @param roles - Role registry.
 * @returns Gated plan + refusal evidence.
 */
export function enforceProductBeforeDesign(
  plan: PmIterationPlan,
  appDir: string,
  slug: string,
  roles: readonly Role[]
): ProductPreconditionResult {
  const deliverables = evaluateProductDeliverables(appDir, slug);
  const messages: string[] = [];

  if (deliverables.ok) {
    messages.push(
      'product precondition: brief present — design and build may proceed (subject to design gate)'
    );
    return {
      plan,
      refusedRoles: [],
      assignedProduct: false,
      messages,
      deliverables
    };
  }

  // Every non-product assignment is blocked for score-raising until the brief
  // exists — including QA/brainstorm that used to fan out for free. Dispatch
  // ONLY product (the unblocking role).
  const priorIds = plan.assignments.map((a) => a.role.id);
  const refusedRoles = priorIds.filter((id) => id !== PRODUCT_ROLE_ID);

  let assignedProduct = false;
  let productAssignment = plan.assignments.find((a) => a.role.id === PRODUCT_ROLE_ID);
  if (!productAssignment) {
    const role = roles.find((r) => r.id === PRODUCT_ROLE_ID) ?? getRole(PRODUCT_ROLE_ID);
    if (role) {
      productAssignment = {
        role,
        rows: [],
        matchedOwns: [...role.owns]
      };
      assignedProduct = true;
    }
  } else {
    assignedProduct = true;
  }

  const onlyProduct = productAssignment ? [productAssignment] : [];
  const finalIds = new Set(onlyProduct.map((a) => a.role.id));
  // Prior plan roles that no longer dispatch (product force-add is not "saved").
  const sessionsSaved = priorIds.filter((id) => !finalIds.has(id)).length;

  if (refusedRoles.length > 0) {
    messages.push(
      `pm: REFUSED to dispatch role(s) [${refusedRoles.join(', ')}] — ` +
        'product brief missing (product has not run); only unblocking role product runs'
    );
  } else {
    messages.push(
      'pm: product brief missing — assigning product only (no score-raising path yet)'
    );
  }
  for (const r of deliverables.reasons) {
    messages.push(`  - ${r}`);
  }
  if (assignedProduct) {
    messages.push('pm: assigning product role first (unblocking only)');
  }
  if (sessionsSaved > 0) {
    messages.push(
      `pm: iteration economy — skipped ${sessionsSaved} role session(s) with no path to a better score`
    );
  }

  const gated: PmIterationPlan = {
    iteration: plan.iteration,
    assignments: onlyProduct,
    worktreeRoles: onlyProduct.filter((a) => a.role.needsWorktree).map((a) => a.role.id),
    readOnlyRoles: onlyProduct.filter((a) => !a.role.needsWorktree).map((a) => a.role.id),
    sessionsSavedThisIteration: sessionsSaved
  };

  return {
    plan: gated,
    refusedRoles,
    assignedProduct,
    messages,
    deliverables
  };
}
