import type { DataStorage } from '../../job';
import type { FeatureSpec, SliceSpec } from '../types';
import { PRD_THRESHOLD, REQUIRED_PAGES } from '../types';
import { entityPascal, entityTable } from '../naming';

/**
 * Build vertical slices: Slice 0 walking skeleton, then one slice per MVP feature, then non-MVP.
 */
export function buildSlices(opts: {
  slug: string;
  entities: string[];
  hasAuth: boolean;
  features: FeatureSpec[];
  dataStorage: DataStorage;
}): SliceSpec[] {
  const { slug, entities, hasAuth, features, dataStorage } = opts;
  const primary = entities[0] ? entityPascal(entities[0]) : '';
  const primaryTable = entities[0] ? entityTable(entities[0]) : '';
  const entityLabel =
    entities.length > 0
      ? entities.map((e) => entityPascal(e)).filter(Boolean).join(', ')
      : 'none';

  const slices: SliceSpec[] = [
    {
      index: 0,
      name: 'Walking skeleton',
      mvp: true,
      db:
        dataStorage === 'none'
          ? 'No domain migration yet (storage = none); wrangler.toml D1 binding present if auth later needs it'
          : `migrations/0001_init.sql with DDL for ${entityLabel}${hasAuth ? ' + users/sessions' : ''}; wrangler.toml D1 binding DB`,
      api: 'GET /api/health → `{ "status": "ok" }` (functions/api/health.ts)',
      ui: 'Home page shell (Layout + theme tokens + i18n stub) loads at `/`',
      tests: 'unit: health handler returns ok; e2e: home loads 200',
      verify: `npx tsc --noEmit && npx vitest run && npm run build; curl -sf http://127.0.0.1:<port>/api/health → {"status":"ok"}`,
      dependsOn: 'None (first slice)'
    }
  ];

  let next = 1;
  for (const feature of features) {
    // Keyed to the FEATURE, never to its id. These used to test `feature.id ===
    // 'F1'`, which stopped meaning "browse the primary entity" the moment
    // capability features could lead the list. The result was a spec whose
    // slices contradicted its own features: "Slice 1 — Search airline flight"
    // built a CRUD list page, and every unmatched feature fell through to the
    // secondary-entity branch, which invented a table from the feature NAME —
    // hence `public_access` and `compute_airline_flight_totals` tables.
    const isPrimaryBrowse = feature.name === `Browse & search ${primary}`;
    const isPrimaryDetail = feature.name === `${primary} detail`;
    const isAccess = feature.name === 'Accounts' || feature.name === 'Public access';
    const isPrimaryManage = feature.name === `Manage ${primary}`;
    const isPages = feature.name.startsWith('Required pages');
    const isSearchFilter = feature.name.startsWith('Search and filter ');
    const isAssistant = feature.name.startsWith('Ask the assistant about ');
    const isSecondaryManage = /^Manage .+$/.test(feature.name) && !isPrimaryManage;
    // Capability features come from the prompt, not from an entity. They must
    // never mint a table: "Compute airline flight totals" is a calculation over
    // existing rows, not a new noun to store.
    const isCapability =
      !isPrimaryBrowse &&
      !isPrimaryDetail &&
      !isAccess &&
      !isPrimaryManage &&
      !isPages &&
      !isSearchFilter &&
      !isAssistant &&
      !isSecondaryManage;

    let db = 'No new migration (tables from Slice 0)';
    let api = 'No new endpoint';
    let ui = 'No new screen';
    let tests = feature.tests.unit
      .concat(feature.tests.integration, feature.tests.e2e)
      .map((c) => `\`${c}\``)
      .join(', ');

    if (isPrimaryBrowse) {
      db = `Use \`${primaryTable}\` table from Slice 0; seed rows for list tests`;
      api = `GET /api/${primaryTable} (+ optional ?q=); contract in §7`;
      ui = `${primary}ListPage at \`/${primaryTable}\` with loading / empty / error states`;
    } else if (isPrimaryDetail) {
      db = `Read one row from \`${primaryTable}\``;
      api = `GET /api/${primaryTable}/:id`;
      ui = `${primary}DetailPage at \`/${primaryTable}/:id\` with back link`;
    } else if (isAccess && hasAuth) {
      db = 'users + sessions tables (from Slice 0 DDL)';
      api = 'POST /api/auth/register, /api/auth/sign-in, /api/auth/sign-out';
      ui = 'Register + Sign-in pages; session-aware nav';
    } else if (isAccess && !hasAuth) {
      db = 'No auth tables';
      api = 'Confirm domain routes have no auth middleware';
      ui = 'No login UI; public nav only';
    } else if (isPrimaryManage) {
      db = `INSERT/UPDATE/DELETE on \`${primaryTable}\``;
      api = `POST /api/${primaryTable} (+ update/delete as specified); Zod ${primary}CreateSchema`;
      ui = `Create/edit form + confirm dialog before delete on ${primary} manage UI`;
    } else if (isPages) {
      db = 'No domain change';
      api = 'Static routes only';
      ui = `${REQUIRED_PAGES.join(', ')} pages + sitemap.xml + robots.txt + per-route SEO`;
    } else if (isSearchFilter) {
      db = primaryTable
        ? `Indexes on \`${primaryTable}\` columns used by search/filter; seed rows that prove narrowing`
        : 'Seed or fixture rows that prove search narrows the collection';
      api = primaryTable
        ? `GET /api/${primaryTable}?q= (and any filter params); contract returns a narrower set for a matching query`
        : 'Collection list endpoint (or client-side filter over loaded rows) honours q/filter';
      ui = `Search/filter control on the collection view with accessible name matching /search|find|filter/i; results narrow; empty-match and error states`;
    } else if (isAssistant) {
      db = primaryTable
        ? `Read-only queries over \`${primaryTable}\` (and related tables) to ground answers — never invent rows`
        : 'Read domain data the assistant needs to ground answers (or structured filters over the catalog)';
      api =
        'POST /api/assistant — Zod body `{ message }`; calls Workers AI via `env.AI.run` in the Worker; grounds in app data; 502/503 on model/binding failure (not empty 200); 400 on empty message';
      ui =
        'Chat affordance reachable from the shell (sheet/panel/route); loading + error states; never render a failed model call as empty success';
    } else if (isCapability) {
      // Reads and computes over the entity tables that already exist.
      db = `Query \`${primaryTable}\`; add indexes for the fields this feature filters or sorts on`;
      api = `POST /api/search — accepts the query and every filter named in §9, returns ordered results`;
      ui = `The screens this feature needs, per §7.3a: query input, results, and its controls`;
    } else {
      // Secondary entity manage
      const match = feature.name.match(/^Manage (.+)$/);
      const pascal = match?.[1] ?? feature.name;
      const table = entityTable(pascal);
      db = `Use \`${table}\` table from Slice 0`;
      api = `GET/POST /api/${table}, GET /api/${table}/:id`;
      ui = `${pascal} list/detail/manage screens`;
    }

    const verifyCmd = isPages
      ? 'test -f public/sitemap.xml && test -f public/robots.txt && npx playwright test tests/required-pages.spec.ts'
      : isSearchFilter
        ? `npx vitest run && npx playwright test tests/${primaryTable || 'collection'}-search.spec.ts`
        : isAssistant
          ? 'npx vitest run functions/api/assistant.test.ts && npx playwright test tests/assistant.spec.ts'
          : isAccess && hasAuth
            ? 'npx vitest run functions/api/auth.test.ts && npx playwright test tests/auth.spec.ts'
            : isAccess && !hasAuth
              ? 'npx playwright test tests/smoke-public.spec.ts'
              : isPrimaryBrowse
                ? `npx vitest run functions/api/${primaryTable}.test.ts && npx playwright test tests/${primaryTable}-list.spec.ts`
                : isPrimaryDetail
                  ? `npx playwright test tests/${primaryTable}-detail.spec.ts`
                  : isCapability
                    ? `npx vitest run && npx playwright test tests/search.spec.ts`
                    : isPrimaryManage
                      ? `npx vitest run src/lib/schemas.test.ts && npx playwright test tests/${primaryTable}-crud.spec.ts`
                      : `npx vitest run && npx playwright test tests/${entityTable(feature.name.replace(/^Manage /, ''))}-crud.spec.ts`;

    slices.push({
      index: next,
      name: feature.name,
      mvp: feature.mvp,
      db,
      api,
      ui,
      tests,
      verify: verifyCmd,
      dependsOn: `Slice ${next - 1}`
    });
    next += 1;
  }

  // Final quality slice after features
  slices.push({
    index: next,
    name: 'A11y, visual, and full gate',
    mvp: false,
    db: 'No schema change',
    api: 'No new endpoint',
    ui: 'axe-clean interactive controls; light + dark at 375 / 768 / 1280',
    tests: '`a11y zero serious/critical`, visual regression screenshots',
    verify: `npx playwright test tests/a11y.spec.ts; from monorepo root: npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}`,
    dependsOn: `Slice ${next - 1}`
  });

  return slices;
}

/**
 * Render §11 Build Plan as vertical slices.
 */
export function renderBuildPlan(slices: SliceSpec[]): string {
  const intro = [
    'Each slice is a **tracer bullet** that crosses DB + API + UI + tests for **one** capability.',
    'Ship and verify a slice before starting the next. Dependency order is explicit.',
    'Do **not** build horizontally (all DDL, then all APIs, then all UI) — that delays end-to-end feedback.'
  ].join(' ');

  const body = slices
    .map((s) => {
      const tag = s.mvp ? ' [MVP]' : '';
      return [
        `### Slice ${s.index} — ${s.name}${tag}`,
        `- DB: ${s.db}`,
        `- API: ${s.api}`,
        `- UI: ${s.ui}`,
        `- Tests: ${s.tests}`,
        `- Verify: \`${s.verify}\`  → expected result: command exits 0 / assertions pass`,
        `- Depends on: ${s.dependsOn}`
      ].join('\n');
    })
    .join('\n\n');

  return `${intro}\n\n${body}`;
}
