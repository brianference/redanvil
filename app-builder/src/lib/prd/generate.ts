import type { WizardAnswers } from '../job';
import { slugFromPrompt, withWizardDefaults } from '../job';
import type { Prd, TokenEstimate } from './types';
import { PRD_THRESHOLD, REQUIRED_PAGES } from './types';
import { parseEntitySpec, type EntitySpec } from './entitySpec';
import {
  entityPascal,
  entityTable,
  isTitleFragment,
  storageLabel,
  stripGeneratorDirectives,
  titleFromPrompt
} from './naming';
import { buildClaims, claimsJson } from './claims';
import { buildFrontmatter } from './sections/frontmatter';
import { buildNonGoals, buildSuccessOutcome, buildUserStories } from './sections/scope';
import { authDdl, buildFileTree, entityApiContract, entityDdl } from './sections/schema';
import {
  authRequiredByFeatures,
  buildFeatures,
  entitiesRequiredByFeatures,
  filterFeaturesBySelection,
  isAccountsFeature,
  renderAcceptanceCriteria,
  renderCoreFeatures,
  renderTestPlan
} from './sections/features';
import { buildSlices, renderBuildPlan } from './sections/slices';
import {
  buildArchitectureSection,
  buildCodingStandard,
  buildDesignSpecifications,
  buildVerificationSection
} from './sections/architecture';
import { buildDesignDirection } from './sections/design';
import { detectCapabilities } from './sections/capabilities';
import { evaluatePrdSelfCheck, unmatchedPromptRequirements } from './selfCheck';

/**
 * Error thrown when generatePrd cannot resolve a required product identity
 * (entities or name) without inventing one. Callers must surface this; never
 * silently emit a document for the wrong product.
 */
export class UnresolvedPrdError extends Error {
  /**
   * @param code - Stable machine code (`unresolved-entities` | `unresolved-title`).
   * @param message - Human-readable explanation.
   */
  constructor(
    readonly code: 'unresolved-entities' | 'unresolved-title',
    message: string
  ) {
    super(message);
    this.name = 'UnresolvedPrdError';
  }
}

/**
 * Problem-statement prose derived from the detected capability, without
 * hardcoded reminder-app filler.
 *
 * @param productPrompt - Prompt with generator directives stripped.
 * @param kind - Primary capability kind, if any.
 * @param subject - Domain subject phrase.
 * @returns §2 body text.
 */
function buildProblemStatement(
  productPrompt: string,
  kind: string | undefined,
  subject: string
): string {
  const lines = [productPrompt, ''];
  switch (kind) {
    case 'reference':
      lines.push(
        `Users need a single, citable reference for ${subject || 'this domain'} — not a spreadsheet they rebuild each season, and not invented sample data. The app exists so the stated windows and criteria are visible end-to-end.`
      );
      break;
    case 'search-rank':
      lines.push(
        `Users need a reliable way to find and rank ${subject || 'results'} under the constraints they named. The cost of a wrong shortlist is wasted time and bad choices; this app exists so the search and its filters are product, not prose.`
      );
      break;
    case 'schedule':
      lines.push(
        `Users need to assign ${subject || 'work'} without double-booking. Conflicts that only surface in conversation are the failure mode; this app exists so assignments and refusals are explicit.`
      );
      break;
    case 'track':
      lines.push(
        `Users need a durable history of ${subject || 'records'} they can trust later. Memory and ad-hoc notes lose the trail; this app exists so every recorded change is queryable.`
      );
      break;
    case 'notify':
      lines.push(
        `Users need to be told when a condition on ${subject || 'the domain'} becomes true — once, not as noise. Missed signals are the failure mode this app removes.`
      );
      break;
    default:
      // Omit domain filler when no capability was detected; the prompt stands alone.
      break;
  }
  return lines.join('\n').trim();
}

/**
 * Generates a complete, agent-ready implementation spec (markdown) from the
 * wizard answers and the token estimate. Deterministic — the same answers
 * always produce the same document.
 *
 * Sections follow the standard 14-part outline: Introduction through PRD Self-Check,
 * with machine frontmatter first, vertical-slice build plan, MVP-first features,
 * and a computed self-grade.
 *
 * @param answers - Wizard answers (core fields required; storage/realtime/integrations optional).
 * @param cost - Effort estimate embedded in the final build prompt footer.
 * @returns Structured PRD with slug, title, prompt, and full markdown.
 * @throws {UnresolvedPrdError} When the entity spec is missing, field-less, or invalid, or the title is a fragment without `appName`.
 */
export function generatePrd(
  answers: Pick<WizardAnswers, 'prompt' | 'appType' | 'hasAuth' | 'entities'> &
    Partial<
      Pick<WizardAnswers, 'dataStorage' | 'hasRealtime' | 'integrations' | 'selectedFeatureIds'>
    > & {
      /**
       * Product name. Sets the title and the slug — and the slug is the
       * deployed hostname and every gate command in the document, so deriving
       * it from a description produced URLs like
       * `a-mobile-first-app-that-finds-the-lowest-cost-air`. Omit to keep the
       * derived name.
       */
      appName?: string;
    },
  cost: TokenEstimate
): Prd {
  const full = withWizardDefaults(answers);
  const prompt = full.prompt.trim();
  const { productPrompt, references } = stripGeneratorDirectives(prompt);
  const named = answers.appName?.trim() ?? '';
  const title = named.length > 0 ? named : titleFromPrompt(prompt);
  if (named.length === 0 && isTitleFragment(title)) {
    throw new UnresolvedPrdError(
      'unresolved-title',
      `Unresolved product name: derived title "${title}" is still a sentence fragment. Provide appName (e.g. "Desert Planting Calendar") before forging the PRD.`
    );
  }
  // Slug from the product title, not the multi-line sentence.
  const slug = slugFromPrompt(title);

  const parsedEntities = parseEntitySpec(full.entities);
  const missingFields = parsedEntities.entities.filter((entity) => entity.fields.length === 0);
  if (
    parsedEntities.errors.length > 0 ||
    parsedEntities.entities.length === 0 ||
    missingFields.length > 0
  ) {
    const detail =
      missingFields.length > 0
        ? `${missingFields.map((entity) => entity.name).join(', ')} ${missingFields.length === 1 ? 'has' : 'have'} no fields. Every entity needs at least one field.`
        : parsedEntities.errors.length > 0
          ? parsedEntities.errors.join('; ')
          : 'name at least one entity with fields (for example Dog: name, breed).';
    throw new UnresolvedPrdError('unresolved-entities', `Unresolved entities: ${detail}`);
  }
  const entitySpecs = parsedEntities.entities;
  const listedEntityNames = entitySpecs.map((entity) => entity.name);

  const appType = full.appType.trim() || 'web application';
  const wizardHasAuth = full.hasAuth;
  const dataStorage = full.dataStorage;
  const hasRealtime = full.hasRealtime;
  const integrations = full.integrations;
  const selectedFeatureIds = full.selectedFeatureIds;

  const capabilities = detectCapabilities(productPrompt, listedEntityNames);
  const primaryCap = capabilities[0];
  const subject = primaryCap?.subject ?? listedEntityNames[0] ?? '';

  // Full derivation uses wizard scope; selection filters after (legacy: no selection = all).
  const fieldsByEntity = new Map(
    entitySpecs.map((entity) => [entity.name, entity.fields.map((field) => field.name)] as const)
  );
  const allFeatures = buildFeatures(listedEntityNames, wizardHasAuth, productPrompt, fieldsByEntity);
  const features = filterFeaturesBySelection(allFeatures, selectedFeatureIds);
  const selectionActive = selectedFeatureIds != null;
  const entityNames = selectionActive
    ? entitiesRequiredByFeatures(listedEntityNames, features)
    : listedEntityNames;
  // Picked behaviour: keep the user's sign-in answer. Feature selection may
  // omit the accounts *section*, but an explicit Yes is never rewritten as
  // hasAuth: false in front matter (measured: provenance Yes, yaml false).
  const hasAuth = selectionActive ? authRequiredByFeatures(wizardHasAuth, features) : wizardHasAuth;
  const accountsSelected = features.some(isAccountsFeature);
  const hasDomainTables = dataStorage !== 'none' && entityNames.length > 0;
  const mvpFeatures = features.filter((f) => f.mvp);
  const featureIds = features.map((f) => f.id).join(', ');
  const mvpIds = mvpFeatures.map((f) => f.id).join(', ');
  const slices = buildSlices({
    slug,
    entities: entityNames.length > 0 ? entityNames : listedEntityNames,
    hasAuth,
    features,
    dataStorage
  });
  const lastSlice = slices[slices.length - 1]!;

  const specByName = new Map(entitySpecs.map((entity) => [entity.name, entity]));
  const ddlEntities = entityNames
    .map((name) => specByName.get(name))
    .filter((entity): entity is EntitySpec => entity !== undefined);

  const ddlBlocks = [
    ...(hasAuth ? [authDdl()] : []),
    ...(hasDomainTables ? ddlEntities.map((entity) => entityDdl(entity, hasAuth)) : [])
  ].join('\n\n');

  const apiBlocks = !hasDomainTables
    ? dataStorage === 'none'
      ? '_No domain CRUD tables (data storage = none). Health (and auth if in scope) still required._'
      : '_No domain CRUD tables for the selected features. Health (and auth if in scope) still required._'
    : ddlEntities.map((entity) => entityApiContract(entity)).join('\n\n');
  const authApi = hasAuth
    ? [
        '',
        '### Auth',
        '',
        '| Method | Path | Purpose |',
        '|--------|------|---------|',
        '| POST | `/api/auth/register` | Create account |',
        '| POST | `/api/auth/sign-in` | Start session |',
        '| POST | `/api/auth/sign-out` | End session |',
        '',
        '- Zod: `RegisterSchema`, `SignInSchema`',
        '- Handler file: `functions/api/auth.ts`',
        '',
        '**Example contracts**',
        '',
        'POST /api/auth/register',
        'Request:  { "email": "owner@example.com", "password": "correct-horse-battery" }',
        'Response: 201 { "id": "usr_01", "email": "owner@example.com", "createdAt": "2026-08-01T09:00:00.000Z" }',
        'Errors:   400 { "error": "<message>" } on validation failure; 409 { "error": "Email already registered" }'
      ].join('\n')
    : '';

  const primaryTable = entityNames[0] ? entityTable(entityNames[0]) : '';
  const routeMap = [
    '| Path | Page |',
    '|------|------|',
    '| `/` | Home |',
    hasDomainTables && primaryTable ? `| \`/${primaryTable}\` | List |` : '',
    hasDomainTables && primaryTable ? `| \`/${primaryTable}/:id\` | Detail |` : '',
    ...REQUIRED_PAGES.filter((p) => p !== 'Home').map((p) => `| \`/${p.toLowerCase()}\` | ${p} |`),
    hasAuth ? '| `/sign-in`, `/register` | Auth |' : ''
  ]
    .filter(Boolean)
    .join('\n');

  const entityListLabel =
    entityNames.length > 0
      ? entityNames.map((e) => entityPascal(e)).filter(Boolean).join(', ')
      : 'none (feature selection)';

  const introSource = productPrompt.replace(/\s+/g, ' ').trim();
  const promptClause = /[.!?]$/.test(introSource) ? introSource : `${introSource}.`;
  const introduction = [
    `**${title}** is a **${appType}** that addresses: ${promptClause}`,
    `It ships as a full-stack Cloudflare app (Pages + Pages Functions + D1) with gate threshold **${PRD_THRESHOLD}**.`,
    `MVP scope is ${mvpIds || 'none'}; ship those vertical slices before Beyond-MVP work.`
  ].join(' ');

  const problemStatement = buildProblemStatement(productPrompt, primaryCap?.kind, subject);

  const solutionOverview = [
    `The app solves the problem with a ${appType.toLowerCase()} built on Cloudflare Pages (Vite + React + TypeScript SPA), Pages Functions for the API, and Cloudflare D1 for persistence (${storageLabel(dataStorage)}).`,
    `Domain entities in scope: **${entityListLabel}**.`,
    hasAuth
      ? wizardHasAuth && selectionActive && !accountsSelected
        ? 'Authentication remains in scope because sign-in was answered Yes, even though no accounts feature is in the selected set. Authentication uses Web Crypto only (PBKDF2 + HMAC session cookies); all domain rows are scoped to the signed-in user.'
        : 'Authentication uses Web Crypto only (PBKDF2 + HMAC session cookies); all domain rows are scoped to the signed-in user.'
      : 'The product is fully public — no register/login, no session middleware, no user-owned scoping.',
    `Users complete MVP flows (${mvpIds || 'none'}) first: browse and manage the primary entity, open detail, and ${hasAuth ? 'sign in' : 'use the app anonymously'}.`,
    'Each capability is delivered as a vertical slice (DB + API + UI + tests) so something works end-to-end after every slice, not only at the end of a horizontal phase plan.'
  ].join(' ');

  // Prefer scoped entity names; with an explicit feature pick and no remaining
  // entities, emit none (not the full derived list); legacy null selection keeps
  // the full derived list.
  let frontmatterEntities: string[];
  if (entityNames.length > 0) {
    frontmatterEntities = entityNames;
  } else if (selectionActive) {
    frontmatterEntities = [];
  } else {
    frontmatterEntities = listedEntityNames;
  }

  // DDL body for §7.2 — empty domain + no auth gets a prose note; otherwise fenced SQL.
  let ddlSectionMarkdown: string;
  if (!hasDomainTables && !hasAuth) {
    if (dataStorage === 'none') {
      ddlSectionMarkdown =
        '_No D1 domain schema for this build (data storage = none, auth off)._';
    } else {
      ddlSectionMarkdown = '_No D1 domain schema for the selected features (auth off)._';
    }
  } else {
    ddlSectionMarkdown = `\`\`\`sql
${ddlBlocks || '-- (auth tables only when hasAuth; no domain tables when storage is none)'}
\`\`\`

All queries are parameterized. Validate every input with Zod at the boundary.`;
  }

  const referencesBlock =
    references.length > 0
      ? [
          '',
          '#### Named references (from the prompt)',
          '',
          ...references.map((r) => `- ${r}`),
          '',
          'These are information-architecture or source citations for the builder — not integrations to implement unless also listed above.'
        ].join('\n')
      : '';

  const coreFeaturesMarkdown = renderCoreFeatures(features);
  const acceptanceMarkdown = renderAcceptanceCriteria(features);
  // Declared entity and field names are the owner's own domain words, so they
  // count as coverage alongside the feature text.
  const declaredDomain = entitySpecs
    .map((entity) => [entity.name, ...entity.fields.map((field) => field.name)].join(' '))
    .join('\n');
  const fidelityUnmatched = unmatchedPromptRequirements(
    productPrompt,
    `${coreFeaturesMarkdown}\n${acceptanceMarkdown}\n${declaredDomain}`
  );
  const fidelity = fidelityUnmatched.length === 0 ? 'pass' : 'fail';

  // Body without self-check first; grade against that body + section stubs, then append grade.
  const bodyBeforeSelfCheck = `# Implementation Spec — ${title}

${buildFrontmatter({
  slug,
  title,
  appType,
  hasAuth,
  entities: frontmatterEntities,
  fidelity,
  fidelityUnmatched
})}

> Generated by RedAnvil App Builder. Paste this whole document into Claude (or Grok) to build the app. Threshold to ship: **score >= ${PRD_THRESHOLD}** on the RedAnvil rubric.

## 1. Introduction

${introduction}

## 2. Problem Statement

${problemStatement}

## 3. Solution Overview

${solutionOverview}

## 4. Success Outcome

Definition of done — observable, checkable statements (not aspirations):

${buildSuccessOutcome(title, features, slug)}

## 5. Non-goals / Out of scope

${buildNonGoals(hasAuth, frontmatterEntities, appType, integrations)}

## 6. User Stories

${buildUserStories(productPrompt, appType, features, hasAuth, subject)}

## 7. Technical Requirements

### 7.1 Architecture

${buildArchitectureSection({ hasAuth, dataStorage, hasRealtime, integrations })}${referencesBlock}

### 7.2 Interface contract

Columns below are \`id\`, \`created_at\`, \`updated_at\`, \`user_id\` when sign-in is on, and the fields from the entity spec. Do not add tables that are not listed here.

#### File tree and key signatures

${buildFileTree(frontmatterEntities.length > 0 ? frontmatterEntities : listedEntityNames, hasAuth)}

#### D1 schema (DDL)

${ddlSectionMarkdown}

#### API surface, Zod schemas, and examples

${apiBlocks}${authApi}

Also required:

| Method | Path | Purpose |
|--------|------|---------|
| GET | \`/api/health\` | Liveness — \`{ "status": "ok" }\` |

**Example — health**

GET /api/health
Request:  (no body)
Response: 200 { "status": "ok" }
Errors:   500 { "error": "Internal server error" } on unexpected failure

#### Client route map

${routeMap}

### 7.3 Design specifications

${buildDesignSpecifications()}

### 7.3a Design direction (binding)

${buildDesignDirection(`${productPrompt}|${appType}|${frontmatterEntities.join(',')}`)}

## 8. Core Features (MVP first)

${coreFeaturesMarkdown}

## 9. Acceptance Criteria

Each feature has an ID for task and UAT binding. Every bullet is one testable condition; bind each to a named test in §10.

${acceptanceMarkdown}

## 10. Test Plan

Named cases per feature (not categories). Acceptance bullets in §9 map to these names.

${renderTestPlan(features)}

## 11. Build Plan (vertical slices)

${renderBuildPlan(slices)}

## 12. Verification & Gates

${buildVerificationSection(slug)}

## 13. Coding Standard (must)

${buildCodingStandard()}
`;

  const selfCheckOpts = {
    entities: frontmatterEntities.length > 0 ? frontmatterEntities : listedEntityNames,
    hasDomainTables,
    prompt: productPrompt,
    // Same corpus the frontmatter fidelity used, so the two cannot disagree.
    domainWords: declaredDomain
  };

  const selfCheck = evaluatePrdSelfCheck(bodyBeforeSelfCheck + '\n## 14. PRD Self-Check\n', selfCheckOpts);

  // Re-evaluate once the self-check section structure is known: sections-order needs §14 heading.
  // Build final markdown with the checklist, then re-grade the complete document so
  // "sections in order" and other full-doc checks are honest.
  const draftWithStub14 =
    bodyBeforeSelfCheck +
    '\n' +
    selfCheck.markdown +
    `\n\n## Initial build prompt (paste into the coder)\n\n` +
    `> Implement this spec as **vertical slices** (§11, Slice 0→Slice ${lastSlice.index}). Honor **§7** Technical Requirements (architecture, DDL, routes, Zod names, signatures, design specs) before polish. Satisfy every MVP feature (${mvpIds}) and its acceptance bullets (**§9**) with the named tests in **§10** (${featureIds}). Follow **§13** coding standard. Do not implement **§5** non-goals. After each slice, run that slice's Verify command. Do not stop until **§12** clears: \`npx tsc --noEmit\`, \`npx eslint . --max-warnings 0\`, \`npx vitest run\`, \`npm run build\`, runtime \`curl …/api/health\`, and from monorepo root \`npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}\` at score >= ${PRD_THRESHOLD}. No push, no deploy, no secrets. Smallest correct diff. Strict TypeScript, zero \`any\`.\n\n` +
    `_Effort (human/orchestrator only): ~${cost.iterations} iterations, ~${cost.tokens.toLocaleString()} tokens (${cost.confidence} confidence)._\n`;

  const finalCheck = evaluatePrdSelfCheck(draftWithStub14, selfCheckOpts);

  const markdown =
    bodyBeforeSelfCheck +
    '\n' +
    finalCheck.markdown +
    `\n\n## Initial build prompt (paste into the coder)\n\n` +
    `> Implement this spec as **vertical slices** (§11, Slice 0→Slice ${lastSlice.index}). Honor **§7** Technical Requirements (architecture, DDL, routes, Zod names, signatures, design specs) before polish. Satisfy every MVP feature (${mvpIds}) and its acceptance bullets (**§9**) with the named tests in **§10** (${featureIds}). Follow **§13** coding standard. Do not implement **§5** non-goals. After each slice, run that slice's Verify command. Do not stop until **§12** clears: \`npx tsc --noEmit\`, \`npx eslint . --max-warnings 0\`, \`npx vitest run\`, \`npm run build\`, runtime \`curl …/api/health\`, and from monorepo root \`npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}\` at score >= ${PRD_THRESHOLD}. No push, no deploy, no secrets. Smallest correct diff. Strict TypeScript, zero \`any\`.\n\n` +
    `_Effort (human/orchestrator only): ~${cost.iterations} iterations, ~${cost.tokens.toLocaleString()} tokens (${cost.confidence} confidence)._\n\n` +
    claimsSection(slug, title, productPrompt, appType, hasAuth, frontmatterEntities, features);

  return { slug, title, prompt, markdown };
}

/**
 * The closing claims fence. Same inputs the design section and the feature
 * list already used, so a gate reading `.redanvil/claims.json` sees the spec
 * the builder read.
 *
 * @param slug - Deployed hostname.
 * @param title - Product title.
 * @param prompt - Prompt with generator directives stripped.
 * @param appType - App type written into the frontmatter.
 * @param hasAuth - Auth flag written into the frontmatter.
 * @param entities - Entity names written into the frontmatter.
 * @param features - Features rendered in §8.
 * @returns Markdown section, including the trailing fence.
 */
function claimsSection(
  slug: string,
  title: string,
  prompt: string,
  appType: string,
  hasAuth: boolean,
  entities: string[],
  features: ReturnType<typeof buildFeatures>
): string {
  const json = claimsJson(
    buildClaims({
      slug,
      title,
      prompt,
      appType,
      hasAuth,
      entities,
      features
    })
  );
  return `## Machine-readable claims\n\n\`\`\`json claims\n${json}\`\`\`\n`;
}
