import type { FeatureSpec } from '../types';
import { entityPascal, entityTable, primaryEntity } from '../naming';
import { capabilityFeatures, detectCapabilities } from './capabilities';

/**
 * One feature suggestion shown in the wizard Features step before the PRD is forged.
 * Ids and titles match {@link buildFeatures} so the user's pick is exactly what ships.
 */
export interface FeatureSuggestion {
  /** Stable feature id (F1, F2, …). */
  id: string;
  /** Feature title shown in the wizard and the PRD. */
  title: string;
  /** One-line rationale tied to the user's scope answers. */
  rationale: string;
  /** Whether this feature is MVP by default (selected on first paint). */
  mvp: boolean;
}

/**
 * Template core features from entities + auth flag (F1, F2, …).
 * MVP features come first (browse, detail, access, manage primary); rest are beyond MVP.
 *
 * Never invents a default "Item" entity when `entities` is empty — capability
 * features and access/pages still emit; entity CRUD templates are omitted.
 *
 * @param entities - Domain entity names (primary first).
 * @param hasAuth - Whether the wizard auth flag is on.
 * @param prompt - Raw prompt (drives capability features).
 * @returns Ordered feature specs for the PRD sections.
 */
export function buildFeatures(entities: string[], hasAuth: boolean, prompt = ''): FeatureSpec[] {
  // What the app is FOR comes first. Entities say what it stores; only the
  // prompt says what it does, and it was not being read at all — a request for
  // "the lowest cost airline flight, nonstop or one layover, with limits on
  // layover duration, arrival time and total travel time" produced a CRUD app
  // over a table with `title` and `description`, containing no flight search.
  const capabilities = capabilityFeatures(detectCapabilities(prompt, entities), 1);
  const primary = primaryEntity(entities);
  const primaryTable = entities[0] ? entityTable(entities[0]) : '';
  const secondary = entities.slice(1);
  const features: FeatureSpec[] = [];

  if (primary && primaryTable) {
    features.push(
      {
        id: 'F1',
        role: 'entity-browse',
        name: `Browse & search ${primary}`,
        behavior: `Users can open the ${primaryTable} list, search by title, and see matching rows or an empty state.`,
        mvp: true,
        acceptance: [
          `GIVEN seeded ${primaryTable} exist WHEN the user opens the list THEN each row shows title and a link to detail`,
          `GIVEN seeded ${primaryTable} exist WHEN the user enters a query that matches one title THEN only matching rows render`,
          `GIVEN no ${primaryTable} exist WHEN the list loads THEN an empty state explains how to add one`,
          `GIVEN the API returns 500 WHEN the list loads THEN an error message with a retry action is shown`
        ],
        tests: {
          unit: [
            `filter${primary}s_byQuery_matchesTitle`,
            `filter${primary}s_byQuery_emptyReturnsEmpty`
          ],
          integration: [
            `GET /api/${primaryTable} returns 200 with items array`,
            `GET /api/${primaryTable}?q= matches title`
          ],
          e2e: [
            `${primaryTable}-list shows rows`,
            `${primaryTable}-list empty state`,
            `${primaryTable}-list error + retry`
          ]
        }
      },
      {
        id: 'F2',
        role: 'entity-detail',
        name: `${primary} detail`,
        behavior: `Clicking a list row opens the full ${primary} record with title, description, and a back link. Any external URL from data is rendered only after safeHttpUrl/safeHref validation (no anchor when unsafe).`,
        mvp: true,
        acceptance: [
          `GIVEN a ${primary} id that exists in D1 WHEN the user opens /${primaryTable}/:id THEN the page shows title, description, and a back link to the list`,
          `GIVEN an unknown id WHEN the user opens /${primaryTable}/:id THEN a not-found state with a path back to the list is shown`,
          `GIVEN the API returns 500 WHEN detail loads THEN an error message with a retry action is shown`,
          `GIVEN a detail record whose source/external URL is javascript: or otherwise non-http(s) WHEN the page renders THEN no anchor is emitted for that URL (safeHttpUrl/SafeExternalLink; u-sec-safe-href)`
        ],
        tests: {
          unit: [`${primary}RowSchema_acceptsValidRow`, `${primary}RowSchema_rejectsMissingId`],
          integration: [
            `GET /api/${primaryTable}/:id returns 200 for existing`,
            `GET /api/${primaryTable}/:id returns 404 for missing`
          ],
          e2e: [`${primaryTable}-detail shows fields`, `${primaryTable}-detail not-found state`]
        }
      }
    );
  }

  if (hasAuth) {
    features.push({
      id: 'F3',
      role: 'accounts',
      name: 'Accounts',
      behavior:
        'Register and sign in with Web Crypto (PBKDF2 + HMAC-SHA256 sessions); data is scoped to the signed-in user.',
      mvp: true,
      acceptance: [
        'GIVEN no session cookie WHEN the user registers with valid email and password THEN they receive a session and land on a signed-in view',
        'GIVEN a registered account WHEN the user signs out and signs back in with the same credentials THEN they receive a session again',
        'GIVEN two users with their own rows WHEN user A lists domain data THEN only user A rows are returned',
        'GIVEN invalid credentials WHEN the user signs in THEN a 401 error message is shown and no session is set'
      ],
      tests: {
        unit: ['hashPassword_isDeterministicWithSalt', 'verifyPassword_rejectsWrongPassword'],
        integration: [
          'POST /api/auth/register returns 201 + Set-Cookie',
          'POST /api/auth/sign-in returns 200 with valid creds',
          'list endpoints scope by user_id'
        ],
        e2e: ['auth register → sign-out → sign-in flow', 'auth blocks cross-user data']
      }
    });
  } else {
    features.push({
      id: 'F3',
      role: 'public-access',
      name: 'Public access',
      behavior: 'No login required; all product pages and APIs are public.',
      mvp: true,
      acceptance: [
        'GIVEN an anonymous browser with no cookies WHEN the user visits Home, the list page, and a detail page THEN every page returns 200 without a redirect to login',
        'GIVEN no session WHEN the client calls list and create APIs THEN requests succeed without auth headers'
      ],
      tests: {
        unit: ['routeConfig_hasNoAuthGuard'],
        integration: [
          'GET /api/health is public',
          primaryTable.length > 0
            ? `GET /api/${primaryTable} is public`
            : 'GET /api/health remains public without auth headers'
        ],
        e2e: ['smoke Home + list + detail without login']
      }
    });
  }

  // Primary entity manage is MVP; additional entities are beyond MVP.
  if (primary && primaryTable) {
    features.push({
      id: 'F4',
      role: 'entity-manage',
      name: `Manage ${primary}`,
      behavior: `Create, edit, and delete ${primaryTable} with confirmation before delete.`,
      mvp: true,
      acceptance: [
        `GIVEN the manage form is open WHEN the user creates a ${primary} with a valid title THEN the list includes the new row`,
        `GIVEN an existing ${primary} WHEN the user edits its title and saves THEN the list and detail show the new title`,
        `GIVEN an existing ${primary} WHEN the user confirms delete THEN the row is gone from the list`,
        `GIVEN an existing ${primary} WHEN the user cancels delete THEN the row remains`,
        `GIVEN invalid input (empty title) WHEN the user submits create THEN a 400 validation message is shown and no row is created`
      ],
      tests: {
        unit: [`${primary}CreateSchema_requiresTitle`, `${primary}CreateSchema_acceptsValid`],
        integration: [
          `POST /api/${primaryTable} returns 201`,
          `POST /api/${primaryTable} returns 400 on empty title`,
          `DELETE or update path removes/updates row`
        ],
        e2e: [
          `${primaryTable}-crud create`,
          `${primaryTable}-crud edit`,
          `${primaryTable}-crud delete confirm/cancel`
        ]
      }
    });
  }

  secondary.forEach((entity, index) => {
    const pascal = entityPascal(entity);
    const table = entityTable(entity);
    if (!pascal || !table) return;
    const id = `F${5 + index}`;
    features.push({
      id,
      role: 'entity-manage',
      name: `Manage ${pascal}`,
      behavior: `Create, edit, and delete ${table} with confirmation before delete.`,
      mvp: false,
      acceptance: [
        `GIVEN the ${pascal} manage form is open WHEN the user creates a ${pascal} with a valid title THEN the list includes the new row`,
        `GIVEN an existing ${pascal} WHEN the user confirms delete THEN the row is gone from the list`,
        `GIVEN invalid input WHEN the user submits create THEN a validation error is shown and no row is created`
      ],
      tests: {
        unit: [`${pascal}CreateSchema_requiresTitle`],
        integration: [
          `POST /api/${table} returns 201`,
          `POST /api/${table} returns 400 on invalid`
        ],
        e2e: [`${table}-crud create and delete`]
      }
    });
  });

  // Standard features every app ships. Scored by fe-search-present and
  // fe-assistant-present; omitting them from a PRD is how a planting calendar
  // shipped with no search and no way to ask it a question.
  const collectionLabel = primary
    ? primaryTable || primary.toLowerCase()
    : entities[0]
      ? entityTable(entities[0]) || entities[0]
      : 'records';
  const collectionTitle = primary ?? (entities[0] ? entityPascal(entities[0]) : 'records');
  const assistantSubject =
    primary ?? (entities[0] ? entityPascal(entities[0]) : undefined) ?? 'app data';
  const filterStem =
    typeof collectionTitle === 'string' && collectionTitle.length > 0
      ? collectionTitle.replace(/[^A-Za-z0-9]/g, '') || 'Records'
      : 'Records';

  features.push({
    id: `F${features.length + 1}`,
    role: 'search-filter',
    name: `Search and filter ${collectionTitle}`,
    behavior: `Users can search or filter the ${collectionLabel} collection with a control whose accessible name matches /search|find|filter/i; the query must narrow the visible results (a decorative box fails).`,
    mvp: true,
    acceptance: [
      `GIVEN seeded ${collectionLabel} exist WHEN the user opens the collection view THEN a search or filter control with an accessible name matching /search|find|filter/i is present`,
      `GIVEN seeded ${collectionLabel} exist WHEN the user enters a query that matches one item THEN only matching rows render`,
      `GIVEN seeded ${collectionLabel} exist WHEN the user enters a query that matches nothing THEN an empty or no-match state is shown (not the full unfiltered list)`,
      `GIVEN the collection API fails WHEN the user is on the collection view THEN an error state with recovery is shown rather than a silent full list`
    ],
    tests: {
      unit: [
        `filter${filterStem}_byQuery_matches`,
        `filter${filterStem}_byQuery_noMatchReturnsEmpty`
      ],
      integration: [
        `GET or client filter on ${collectionLabel} honours q/filter and returns a narrower set`
      ],
      e2e: [
        `${collectionLabel}-search narrows results`,
        `${collectionLabel}-search empty match state`
      ]
    }
  });

  features.push({
    id: `F${features.length + 1}`,
    role: 'assistant',
    name: `Ask the assistant about ${assistantSubject}`,
    behavior: `A chat affordance reachable from the shell posts to functions/api/assistant.ts (or equivalent). The Worker calls Cloudflare Workers AI (env.AI) and grounds the answer in this app's own data -- not general knowledge. A failed model call surfaces an error state, never an empty success. No secrets in code; the binding comes from env.`,
    mvp: true,
    acceptance: [
      `GIVEN the shell is open WHEN the user opens the assistant THEN a chat input is reachable without leaving the product chrome`,
      `GIVEN the assistant endpoint and Workers AI binding are healthy WHEN the user asks a question about ${assistantSubject} THEN the answer is grounded in app data (DB rows, catalog filters, or structured domain query) rather than generic model knowledge alone`,
      `GIVEN the model call fails (502 / binding missing / empty model output) WHEN the user submits a message THEN an error state is shown -- never an empty success or a silent no-op`,
      `GIVEN invalid input (empty message) WHEN the user submits THEN a 400 validation response is shown and no model call is required`
    ],
    tests: {
      unit: [
        'assistantBodySchema_rejectsEmptyMessage',
        'assistant_groundsInAppData_notGeneralKnowledge'
      ],
      integration: [
        'POST /api/assistant returns 200 with grounded payload when AI + data are available',
        'POST /api/assistant returns 502/503 error body when the model or binding fails (not 200 empty)',
        'POST /api/assistant returns 400 on empty message'
      ],
      e2e: [
        'assistant open from shell',
        'assistant shows error state on failed model call',
        'assistant answer references app data for a known seed question'
      ]
    }
  });

  features.push({
    id: `F${features.length + 1}`,
    role: 'required-pages',
    name: 'Required pages & SEO',
    behavior:
      'Ship Home, About, Terms, Privacy, Contact with per-route SEO, sitemap, and robots.txt.',
    mvp: false,
    acceptance: [
      'GIVEN the production build is served WHEN each required route is requested THEN each returns 200 with a unique title and description',
      'GIVEN the production build WHEN sitemap.xml and robots.txt are requested THEN both files exist and are non-empty',
      'GIVEN each required page WHEN the document head is inspected THEN OG title/description are present and unique per route'
    ],
    tests: {
      unit: ['seoMeta_uniquePerRoute'],
      integration: [
        'GET /about /terms /privacy /contact return 200',
        'GET /sitemap.xml and /robots.txt exist'
      ],
      e2e: ['required-pages smoke all five routes']
    }
  });

  // Capability features lead WITHIN their tier, but MVP still comes first
  // overall — the PRD promises "ship only the MVP set and have a working
  // product", and a beyond-MVP capability sitting at F1 breaks that. Putting
  // capabilities first unconditionally made a "track" prompt open with a
  // non-MVP feature ahead of the MVP ones.
  const combined = [...capabilities, ...features];
  const ordered = [...combined.filter((f) => f.mvp), ...combined.filter((f) => !f.mvp)];

  // Ids are assigned here rather than hard-coded, because the entity templates
  // were written when F1 was always "Browse & search <Entity>" and that is no
  // longer the first thing the app does. Slices and acceptance bind to
  // feature.id, so one renumbering point keeps every reference consistent.
  return ordered.map((feature, index) => ({ ...feature, id: `F${index + 1}` }));
}

/**
 * Build wizard feature suggestions from the same derivation as the PRD.
 * Does not invent a parallel list — titles and ids come from {@link buildFeatures}.
 *
 * @param entities - Domain entity names (primary first).
 * @param hasAuth - Whether the wizard auth flag is on.
 * @returns Suggestions with rationale and default MVP selection flag.
 */
export function buildFeatureSuggestions(
  entities: string[],
  hasAuth: boolean,
  prompt = ''
): FeatureSuggestion[] {
  const features = buildFeatures(entities, hasAuth, prompt);
  const primary = primaryEntity(entities) ?? 'record';
  return features.map((feature) => ({
    id: feature.id,
    title: feature.name,
    rationale: rationaleForFeature(feature, entities, hasAuth, primary),
    mvp: feature.mvp
  }));
}

/**
 * Default selected ids for the Features step (MVP features only).
 *
 * @param entities - Domain entity names (primary first).
 * @param hasAuth - Whether the wizard auth flag is on.
 * @returns Feature ids that should start selected.
 */
export function defaultSelectedFeatureIds(
  entities: string[],
  hasAuth: boolean,
  prompt = ''
): string[] {
  return buildFeatureSuggestions(entities, hasAuth, prompt)
    .filter((suggestion) => suggestion.mvp)
    .map((suggestion) => suggestion.id);
}

/**
 * Filter derived features by the user's explicit selection.
 * When `selectedFeatureIds` is null or undefined, returns every feature (legacy behaviour).
 *
 * @param features - Full list from {@link buildFeatures}.
 * @param selectedFeatureIds - Chosen ids, or null/undefined for no filter.
 * @returns Features to include in the PRD.
 */
export function filterFeaturesBySelection(
  features: FeatureSpec[],
  selectedFeatureIds: string[] | null | undefined
): FeatureSpec[] {
  if (selectedFeatureIds == null) {
    return features;
  }
  const selected = new Set(selectedFeatureIds);
  return features.filter((feature) => selected.has(feature.id));
}

/**
 * Domain entities still required by the selected features (for schema / API / file tree).
 * Preserves the original entity order. Empty when no entity-scoped feature remains.
 *
 * @param allEntities - Full entity list used to derive features.
 * @param selectedFeatures - Features that will appear in the PRD.
 * @returns Entities that still have schema rows or feature work.
 */
export function entitiesRequiredByFeatures(
  allEntities: string[],
  selectedFeatures: FeatureSpec[]
): string[] {
  if (selectedFeatures.length === 0 || allEntities.length === 0) {
    return [];
  }
  const primaryLabel = primaryEntity(allEntities);
  const primaryRaw = allEntities[0];
  const needed = new Set<string>();

  for (const feature of selectedFeatures) {
    // Match by feature shape, not hard-coded F-ids — capability features renumber the list.
    if (
      feature.name.startsWith('Browse & search ') ||
      feature.name.endsWith(' detail') ||
      (primaryLabel !== null && feature.name === `Manage ${primaryLabel}`)
    ) {
      if (primaryRaw) needed.add(primaryRaw);
      continue;
    }
    const manageMatch = /^Manage (.+)$/.exec(feature.name);
    if (manageMatch) {
      const pascal = manageMatch[1] ?? '';
      if (primaryLabel !== null && pascal === primaryLabel && primaryRaw) {
        needed.add(primaryRaw);
      } else {
        const match = allEntities.find((entity) => entityPascal(entity) === pascal);
        if (match) {
          needed.add(match);
        }
      }
    }
  }

  return allEntities.filter((entity) => needed.has(entity));
}

/**
 * Whether this feature is the accounts/session feature, identified by the
 * role discriminant set where it was constructed. Ids are positional and
 * names are display copy — neither is identity.
 *
 * @param feature - A derived feature spec.
 * @returns True when the feature is the accounts feature.
 */
export function isAccountsFeature(feature: FeatureSpec): boolean {
  return feature.role === 'accounts';
}

/**
 * Whether auth tables/routes stay in the PRD after feature selection.
 *
 * An explicit wizard Yes is kept even when the accounts feature is missing
 * from the selection. Silently rewriting that Yes as hasAuth: false is the
 * measured defect (provenance Yes, front matter false). An explicit No
 * always wins, whatever is selected.
 *
 * The accounts feature is identified by {@link isAccountsFeature} (role),
 * not by a positional id. Ids are reassigned after capability features lead.
 *
 * @param wizardHasAuth - Auth flag from the Scope step.
 * @param selectedFeatures - Features that will appear in the PRD.
 * @returns True when auth schema and routes must remain.
 */
export function authRequiredByFeatures(
  wizardHasAuth: boolean,
  selectedFeatures: FeatureSpec[]
): boolean {
  // An explicit No always wins. An explicit Yes is ALWAYS kept -- including
  // when the accounts feature is absent from the selection, which is the
  // contradiction that produced the measured defect. `selectedFeatures` is
  // therefore not consulted: writing `some(isAccountsFeature) ? true : true`
  // would read as a decision while making none. generate.ts uses
  // isAccountsFeature separately to SAY in the PRD that auth was kept despite
  // the selection, which is where that distinction belongs.
  void selectedFeatures;
  return wizardHasAuth;
}

/**
 * One-line rationale for a derived feature, tied to the user's scope answers.
 *
 * @param feature - Feature from {@link buildFeatures}.
 * @param entities - Domain entity names.
 * @param hasAuth - Wizard auth flag.
 * @param primary - PascalCase primary entity label.
 * @returns Rationale string for the Features step.
 */
function rationaleForFeature(
  feature: FeatureSpec,
  entities: string[],
  hasAuth: boolean,
  primary: string
): string {
  // Keyed to the FEATURE, never to its id. These used to switch on F1..F4,
  // which silently became wrong the moment ids were assigned dynamically: with
  // two capability features leading, "Search airline flight" was captioned
  // "browse and search the list" and every rationale was off by two.
  if (
    feature.name.startsWith('Search ') ||
    feature.name.startsWith('Filter and sort ') ||
    feature.name.startsWith('Filter ') ||
    feature.name.endsWith(' grid')
  ) {
    return 'From your description (the core job the app does)';
  }
  if (feature.name.startsWith('Schedule ') || feature.name.startsWith('Alerts for ')) {
    return 'From your description (the core job the app does)';
  }
  if (feature.name.startsWith('Compute ') || feature.name.endsWith(' history')) {
    return 'From your description (supporting capability)';
  }
  if (feature.name.startsWith('Import and export ')) {
    return 'From your description (supporting capability)';
  }
  if (feature.name.startsWith('Browse & search ')) {
    return `From entity ${primary} (browse and search the list)`;
  }
  if (feature.name.endsWith(' detail')) {
    return `From entity ${primary} (open a single record)`;
  }
  if (feature.role === 'accounts' || feature.role === 'public-access') {
    return hasAuth
      ? 'From sign-in = Yes (accounts and session-scoped data)'
      : 'From sign-in = No (public pages and APIs)';
  }
  if (feature.name === `Manage ${primary}`) {
    return `From entity ${primary} (create, edit, and delete)`;
  }
  if (feature.name.startsWith('Search and filter ')) {
    return 'Standard feature: every collection must be searchable (fe-search-present)';
  }
  if (feature.name.startsWith('Ask the assistant about ')) {
    return 'Standard feature: AI assistant grounded in app data (fe-assistant-present)';
  }
  if (feature.name.startsWith('Required pages')) {
    return 'Required product pages for every app (About, Terms, Privacy, Contact)';
  }
  const manageMatch = /^Manage (.+)$/.exec(feature.name);
  if (manageMatch) {
    const label = manageMatch[1] ?? feature.name;
    const source = entities.find((entity) => entityPascal(entity) === label) ?? label;
    return `From entity ${source} (beyond MVP manage)`;
  }
  return `From scope: ${feature.name}`;
}

/**
 * Render §8 Core Features with MVP first, then Beyond MVP.
 *
 * @param features - Features to render (already filtered by selection when applicable).
 * @returns Markdown for the Core Features section body.
 */
export function renderCoreFeatures(features: FeatureSpec[]): string {
  const mvp = features.filter((f) => f.mvp);
  const rest = features.filter((f) => !f.mvp);
  const renderOne = (f: FeatureSpec): string => {
    const tag = f.mvp ? ' **[MVP]**' : '';
    return `### ${f.id} — ${f.name}${tag}\n\n${f.behavior}`;
  };
  const lines: string[] = [
    'MVP features are the **minimum** set that solves the stated problem. An agent must be able to ship only the MVP set and have a working product. Build MVP first; Beyond MVP only after MVP acceptance is green.',
    '',
    '### MVP',
    '',
    mvp.map(renderOne).join('\n\n')
  ];
  if (rest.length > 0) {
    lines.push('', '### Beyond MVP', '', rest.map(renderOne).join('\n\n'));
  }
  return lines.join('\n');
}

/**
 * Render §9 Acceptance Criteria as bullet lists per feature.
 *
 * @param features - Features to render (already filtered by selection when applicable).
 * @returns Markdown for the Acceptance Criteria section body.
 */
export function renderAcceptanceCriteria(features: FeatureSpec[]): string {
  return features
    .map((f) => {
      const bullets = f.acceptance.map((line) => `- ${line}`).join('\n');
      return `### ${f.id} — ${f.name}\n\n**Acceptance criteria**\n${bullets}`;
    })
    .join('\n\n');
}

/**
 * Render §10 Test Plan with named cases per feature.
 *
 * @param features - Features to render (already filtered by selection when applicable).
 * @returns Markdown for the Test Plan section body.
 */
export function renderTestPlan(features: FeatureSpec[]): string {
  return features
    .map((f) => {
      const unit = f.tests.unit.map((c) => `- \`${c}\``).join('\n');
      const integration = f.tests.integration.map((c) => `- \`${c}\``).join('\n');
      const e2e = f.tests.e2e.map((c) => `- \`${c}\``).join('\n');
      return [
        `### ${f.id} — ${f.name}`,
        '',
        '**Unit**',
        unit,
        '',
        '**Integration**',
        integration,
        '',
        '**E2E**',
        e2e
      ].join('\n');
    })
    .join('\n\n');
}
