import type { WizardAnswers } from '../job';
import { slugFromPrompt, withWizardDefaults } from '../job';
import type { Prd, TokenEstimate } from './types';
import { PRD_THRESHOLD, REQUIRED_PAGES } from './types';
import { entityList, entityPascal, entityTable, storageLabel, titleFromPrompt } from './naming';
import { buildFrontmatter } from './sections/frontmatter';
import { buildNonGoals, buildSuccessOutcome, buildUserStories } from './sections/scope';
import { authDdl, buildFileTree, entityApiContract, entityDdl } from './sections/schema';
import {
  authRequiredByFeatures,
  buildFeatures,
  entitiesRequiredByFeatures,
  filterFeaturesBySelection,
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
import { evaluatePrdSelfCheck } from './selfCheck';

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
 */
export function generatePrd(
  answers: Pick<WizardAnswers, 'prompt' | 'appType' | 'hasAuth' | 'entities'> &
    Partial<
      Pick<WizardAnswers, 'dataStorage' | 'hasRealtime' | 'integrations' | 'selectedFeatureIds'>
    >,
  cost: TokenEstimate
): Prd {
  const full = withWizardDefaults(answers);
  const prompt = full.prompt.trim();
  const slug = slugFromPrompt(prompt);
  const title = titleFromPrompt(prompt);
  const entities = entityList(full.entities);
  const appType = full.appType.trim() || 'web application';
  const wizardHasAuth = full.hasAuth;
  const dataStorage = full.dataStorage;
  const hasRealtime = full.hasRealtime;
  const integrations = full.integrations;
  const selectedFeatureIds = full.selectedFeatureIds;

  // Full derivation uses wizard scope; selection filters after (legacy: no selection = all).
  const derivedEntityNames = entities.length > 0 ? entities : ['Item'];
  const allFeatures = buildFeatures(derivedEntityNames, wizardHasAuth, prompt);
  const features = filterFeaturesBySelection(allFeatures, selectedFeatureIds);
  const selectionActive = selectedFeatureIds != null;
  const entityNames = selectionActive
    ? entitiesRequiredByFeatures(derivedEntityNames, features)
    : derivedEntityNames;
  const hasAuth = selectionActive ? authRequiredByFeatures(wizardHasAuth, features) : wizardHasAuth;
  const hasDomainTables = dataStorage !== 'none' && entityNames.length > 0;
  const mvpFeatures = features.filter((f) => f.mvp);
  const featureIds = features.map((f) => f.id).join(', ');
  const mvpIds = mvpFeatures.map((f) => f.id).join(', ');
  const slices = buildSlices({
    slug,
    entities: entityNames.length > 0 ? entityNames : derivedEntityNames,
    hasAuth,
    features,
    dataStorage
  });
  const lastSlice = slices[slices.length - 1]!;

  const ddlBlocks = [
    ...(hasAuth ? [authDdl()] : []),
    ...(hasDomainTables ? entityNames.map((e) => entityDdl(e, hasAuth)) : [])
  ].join('\n\n');

  const apiBlocks = !hasDomainTables
    ? dataStorage === 'none'
      ? '_No domain CRUD tables (data storage = none). Health (and auth if in scope) still required._'
      : '_No domain CRUD tables for the selected features. Health (and auth if in scope) still required._'
    : entityNames.map((e) => entityApiContract(e)).join('\n\n');
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

  const primaryTable = entityNames[0] ? entityTable(entityNames[0]) : 'items';
  const routeMap = [
    '| Path | Page |',
    '|------|------|',
    '| `/` | Home |',
    hasDomainTables ? `| \`/${primaryTable}\` | List |` : '',
    hasDomainTables ? `| \`/${primaryTable}/:id\` | Detail |` : '',
    ...REQUIRED_PAGES.filter((p) => p !== 'Home').map((p) => `| \`/${p.toLowerCase()}\` | ${p} |`),
    hasAuth ? '| `/sign-in`, `/register` | Auth |' : ''
  ]
    .filter(Boolean)
    .join('\n');

  const entityListLabel =
    entityNames.length > 0
      ? entityNames.map((e) => entityPascal(e)).join(', ')
      : 'none (feature selection)';

  const promptClause = /[.!?]$/.test(prompt) ? prompt : `${prompt}.`;
  const introduction = [
    `**${title}** is a **${appType}** that addresses: ${promptClause}`,
    `It ships as a full-stack Cloudflare app (Pages + Pages Functions + D1) with gate threshold **${PRD_THRESHOLD}**.`,
    `MVP scope is ${mvpIds || 'none'}; ship those vertical slices before Beyond-MVP work.`
  ].join(' ');

  const problemStatement = [
    prompt,
    '',
    'Users lack a single, reliable place to track and act on the domain above. The cost of missing a due item is real-world failure (missed care, lost data, or repeated manual chase). This app exists so that the stated need is handled end-to-end in software, not spreadsheets or memory.'
  ].join('\n');

  const solutionOverview = [
    `The app solves the problem with a ${appType.toLowerCase()} built on Cloudflare Pages (Vite + React + TypeScript SPA), Pages Functions for the API, and Cloudflare D1 for persistence (${storageLabel(dataStorage)}).`,
    `Domain entities in scope: **${entityListLabel}**.`,
    hasAuth
      ? 'Authentication uses Web Crypto only (PBKDF2 + HMAC session cookies); all domain rows are scoped to the signed-in user.'
      : 'The product is fully public — no register/login, no session middleware, no user-owned scoping.',
    `Users complete MVP flows (${mvpIds || 'none'}) first: browse and manage the primary entity, open detail, and ${hasAuth ? 'sign in' : 'use the app anonymously'}.`,
    'Each capability is delivered as a vertical slice (DB + API + UI + tests) so something works end-to-end after every slice, not only at the end of a horizontal phase plan.'
  ].join(' ');

  const frontmatterEntities =
    entityNames.length > 0 ? entityNames : selectionActive ? [] : derivedEntityNames;

  // Body without self-check first; grade against that body + section stubs, then append grade.
  const bodyBeforeSelfCheck = `# Implementation Spec — ${title}

${buildFrontmatter({ slug, title, appType, hasAuth, entities: frontmatterEntities })}

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

${buildUserStories(prompt, appType, features, hasAuth)}

## 7. Technical Requirements

### 7.1 Architecture

${buildArchitectureSection({ hasAuth, dataStorage, hasRealtime, integrations })}

### 7.2 Interface contract

Default columns below are concrete starting points to refine — do **not** invent extra tables or replace these defaults without updating this contract first.

#### File tree and key signatures

${buildFileTree(frontmatterEntities.length > 0 ? frontmatterEntities : derivedEntityNames, hasAuth)}

#### D1 schema (DDL)

${
  !hasDomainTables && !hasAuth
    ? dataStorage === 'none'
      ? '_No D1 domain schema for this build (data storage = none, auth off)._'
      : '_No D1 domain schema for the selected features (auth off)._'
    : `\`\`\`sql
${ddlBlocks || '-- (auth tables only when hasAuth; no domain tables when storage is none)'}
\`\`\`

All queries are parameterized. Validate every input with Zod at the boundary.`
}

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

${buildDesignDirection(`${prompt}|${full.appType}|${full.entities}`)}

## 8. Core Features (MVP first)

${renderCoreFeatures(features)}

## 9. Acceptance Criteria

Each feature has an ID for task and UAT binding. Every bullet is one testable condition; bind each to a named test in §10.

${renderAcceptanceCriteria(features)}

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

  const selfCheck = evaluatePrdSelfCheck(bodyBeforeSelfCheck + '\n## 14. PRD Self-Check\n', {
    entities: frontmatterEntities.length > 0 ? frontmatterEntities : derivedEntityNames,
    hasDomainTables
  });

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

  const finalCheck = evaluatePrdSelfCheck(draftWithStub14, {
    entities: frontmatterEntities.length > 0 ? frontmatterEntities : derivedEntityNames,
    hasDomainTables
  });

  const markdown =
    bodyBeforeSelfCheck +
    '\n' +
    finalCheck.markdown +
    `\n\n## Initial build prompt (paste into the coder)\n\n` +
    `> Implement this spec as **vertical slices** (§11, Slice 0→Slice ${lastSlice.index}). Honor **§7** Technical Requirements (architecture, DDL, routes, Zod names, signatures, design specs) before polish. Satisfy every MVP feature (${mvpIds}) and its acceptance bullets (**§9**) with the named tests in **§10** (${featureIds}). Follow **§13** coding standard. Do not implement **§5** non-goals. After each slice, run that slice's Verify command. Do not stop until **§12** clears: \`npx tsc --noEmit\`, \`npx eslint . --max-warnings 0\`, \`npx vitest run\`, \`npm run build\`, runtime \`curl …/api/health\`, and from monorepo root \`npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}\` at score >= ${PRD_THRESHOLD}. No push, no deploy, no secrets. Smallest correct diff. Strict TypeScript, zero \`any\`.\n\n` +
    `_Effort (human/orchestrator only): ~${cost.iterations} iterations, ~${cost.tokens.toLocaleString()} tokens (${cost.confidence} confidence)._\n`;

  return { slug, title, prompt, markdown };
}
