import type { DataStorage, WizardAnswers } from './job';
import { DEFAULT_DATA_STORAGE, slugFromPrompt, withWizardDefaults } from './job';

/** The effort estimate shape consumed by the PRD (structurally matches estimate()). */
export interface TokenEstimate {
  iterations: number;
  tokens: number;
  confidence: string;
}

export interface Prd {
  slug: string;
  title: string;
  /** Original user prompt used to generate this PRD. */
  prompt: string;
  /** Complete PRD as GitHub-flavored markdown, ready to paste into Claude. */
  markdown: string;
}

/** One graded self-check row rendered in §14. */
export interface PrdSelfCheckItem {
  id: string;
  label: string;
  pass: boolean;
}

/** Result of grading a PRD markdown document against completeness checks. */
export interface PrdSelfCheckResult {
  items: PrdSelfCheckItem[];
  passed: number;
  total: number;
  /** Integer percent 0–100 computed from passed/total (never hardcoded). */
  percent: number;
  /** Markdown block for section 14. */
  markdown: string;
}

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'for',
  'with',
  'app',
  'application',
  'to',
  'of',
  'and'
]);

/** Soft max character length for a title; cuts only on a word boundary (no ellipsis). */
const TITLE_MAX_CHARS = 72;

/** Gate threshold embedded in every generated PRD. */
const PRD_THRESHOLD = 90;

/** Required static pages every app must ship. */
const REQUIRED_PAGES = ['Home', 'About', 'Terms', 'Privacy', 'Contact'] as const;

/** Standard section headings in order (after YAML frontmatter). */
export const PRD_SECTION_HEADINGS = [
  '1. Introduction',
  '2. Problem Statement',
  '3. Solution Overview',
  '4. Success Outcome',
  '5. Non-goals / Out of scope',
  '6. User Stories',
  '7. Technical Requirements',
  '8. Core Features (MVP first)',
  '9. Acceptance Criteria',
  '10. Test Plan',
  '11. Build Plan (vertical slices)',
  '12. Verification & Gates',
  '13. Coding Standard (must)',
  '14. PRD Self-Check'
] as const;

/**
 * Derive a human product title from the prompt.
 * Title Case with stopwords kept lowercase mid-title. Never cuts mid-word;
 * if length-bounded, trims to the last full word under TITLE_MAX_CHARS.
 */
function titleFromPrompt(prompt: string): string {
  const cleaned = prompt
    .trim()
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return 'New App';

  let clause = cleaned;
  if (clause.length > TITLE_MAX_CHARS) {
    const head = clause.slice(0, TITLE_MAX_CHARS);
    const lastSpace = head.lastIndexOf(' ');
    // Prefer a word boundary; only hard-cut if there is no space past a minimal prefix.
    clause = lastSpace > 12 ? head.slice(0, lastSpace) : head;
  }

  const words = clause.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'New App';
  return words
    .map((w, i) =>
      i > 0 && STOPWORDS.has(w.toLowerCase()) ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1)
    )
    .join(' ');
}

/** Split the free-text entities field into a clean list. */
function entityList(entities: string): string[] {
  return entities
    .split(/[,;\n]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

/**
 * Normalize an entity label to a singular PascalCase type name (e.g. "trips" → "Trip").
 */
function entityPascal(name: string): string {
  const parts = name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'Item';
  return parts
    .map((part) => {
      const lower = part.toLowerCase();
      // Strip a trailing plural "s" for simple English plurals (trips → trip).
      const singular =
        lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')
          ? lower.slice(0, -1)
          : lower;
      return singular[0]!.toUpperCase() + singular.slice(1);
    })
    .join('');
}

/**
 * Normalize an entity label to a plural snake_case table / route segment
 * (e.g. "Trip" → "trips", "ear cleaning" → "ear_cleanings").
 */
function entityTable(name: string): string {
  const pascal = entityPascal(name);
  const snake = pascal.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  if (snake.endsWith('s')) return snake;
  return `${snake}s`;
}

/**
 * YAML-safe single-line string (escape quotes and backslashes).
 */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Build the machine-readable YAML frontmatter fence.
 */
function buildFrontmatter(opts: {
  slug: string;
  title: string;
  appType: string;
  hasAuth: boolean;
  entities: string[];
}): string {
  const entityYaml =
    opts.entities.length > 0
      ? `[${opts.entities.map((e) => yamlString(e)).join(', ')}]`
      : '["Item"]';
  return [
    '```yaml',
    `appType: ${yamlString(opts.appType)}`,
    `hasAuth: ${opts.hasAuth}`,
    `entities: ${entityYaml}`,
    'targetType: fullstack-web',
    `threshold: ${PRD_THRESHOLD}`,
    `slug: ${yamlString(opts.slug)}`,
    `title: ${yamlString(opts.title)}`,
    '```'
  ].join('\n');
}

/**
 * Build non-goals bullets from platform defaults and wizard answers.
 */
function buildNonGoals(
  hasAuth: boolean,
  entities: string[],
  appType: string,
  integrations: string
): string {
  const entityScope =
    entities.length > 0 ? entities.map((e) => entityPascal(e)).join(', ') : 'Item (default)';
  const namedIntegrations = integrations.trim();
  const paymentsLine =
    namedIntegrations.length > 0
      ? `- Do not invent integrations beyond those named in the wizard/Architecture (**${namedIntegrations}**). Secrets for them stay in env / Cloudflare secrets only — never in the repo.`
      : '- No payment processing, billing, or third-party integrations unless the mission names them (no Stripe, no vault, no secret files in the repo).';
  const lines = [
    `- Do not invent domain entities beyond the frontmatter list: **${entityScope}**.`,
    hasAuth
      ? '- Auth is in scope (Web Crypto only). Do not add OAuth, social login, or third-party IdPs unless the mission states them.'
      : '- **No authentication** — every route is public; do not add register/login, sessions, or user-owned scoping.',
    paymentsLine,
    '- No deploy automation inside the app itself (no CI push-to-prod buttons, no wrangler deploy from client code).',
    '- **Single-tenant** — no multi-org, team workspaces, or tenant isolation layers.',
    '- No Supabase, Express, bcrypt, or jsonwebtoken (Workers-incompatible).',
    '- No Node-only globals (`process`, `Buffer`) or native modules (`better-sqlite3`) in Worker/browser code.',
    appType.toLowerCase().includes('mobile')
      ? '- Mobile app type: ship a mobile-first responsive web UI; do not build a native iOS/Android shell unless explicitly required later.'
      : '- No native mobile shell — full-stack web (Cloudflare Pages) only.'
  ];
  return lines.join('\n');
}

/**
 * Emit CREATE TABLE DDL for one entity with concrete default columns.
 */
function entityDdl(entity: string, hasAuth: boolean): string {
  const table = entityTable(entity);
  const columns = [
    '  id TEXT PRIMARY KEY,',
    '  created_at TEXT NOT NULL,',
    ...(hasAuth ? ['  user_id TEXT NOT NULL,'] : []),
    '  title TEXT NOT NULL,',
    "  description TEXT NOT NULL DEFAULT '',",
    '  updated_at TEXT NOT NULL'
  ];
  const index = hasAuth
    ? `\nCREATE INDEX IF NOT EXISTS idx_${table}_user_id ON ${table}(user_id);`
    : '';
  return [
    `-- Default columns for ${entityPascal(entity)}; refine field names when product copy is known.`,
    `CREATE TABLE IF NOT EXISTS ${table} (`,
    ...columns,
    `);${index}`
  ].join('\n');
}

/**
 * Auth tables when hasAuth is true.
 */
function authDdl(): string {
  return [
    'CREATE TABLE IF NOT EXISTS users (',
    '  id TEXT PRIMARY KEY,',
    '  email TEXT NOT NULL UNIQUE,',
    '  password_hash TEXT NOT NULL,',
    '  salt TEXT NOT NULL,',
    '  created_at TEXT NOT NULL',
    ');',
    'CREATE TABLE IF NOT EXISTS sessions (',
    '  id TEXT PRIMARY KEY,',
    '  user_id TEXT NOT NULL,',
    '  token_hash TEXT NOT NULL,',
    '  expires_at TEXT NOT NULL,',
    '  FOREIGN KEY (user_id) REFERENCES users(id)',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);'
  ].join('\n');
}

/**
 * API route table + concrete request/response examples for one entity.
 */
function entityApiContract(entity: string): string {
  const table = entityTable(entity);
  const pascal = entityPascal(entity);
  const exampleTitle = `${pascal} example`;
  return [
    `### ${pascal}`,
    '',
    `| Method | Path | Purpose |`,
    `|--------|------|---------|`,
    `| GET | \`/api/${table}\` | List ${table} |`,
    `| POST | \`/api/${table}\` | Create one ${pascal} |`,
    `| GET | \`/api/${table}/:id\` | Get one by id |`,
    '',
    `- Zod: \`${pascal}CreateSchema\`, \`${pascal}UpdateSchema\`, \`${pascal}RowSchema\``,
    `- Handler file: \`functions/api/${table}.ts\``,
    '',
    '**Example contracts**',
    '',
    `GET /api/${table}`,
    'Request:  (no body; optional query `?q=` for title search)',
    `Response: 200 { "items": [{ "id": "rem_01", "title": "${exampleTitle}", "description": "", "createdAt": "2026-08-01T09:00:00.000Z", "updatedAt": "2026-08-01T09:00:00.000Z" }] }`,
    'Errors:   500 { "error": "Internal server error" } on unexpected failure',
    '',
    `POST /api/${table}`,
    `Request:  { "title": "${exampleTitle}", "description": "Scheduled care task" }`,
    `Response: 201 { "id": "rem_01", "title": "${exampleTitle}", "description": "Scheduled care task", "createdAt": "2026-08-01T09:00:00.000Z", "updatedAt": "2026-08-01T09:00:00.000Z" }`,
    'Errors:   400 { "error": "<message>" } on validation failure',
    '',
    `GET /api/${table}/:id`,
    'Request:  (no body; path param `id`)',
    `Response: 200 { "id": "rem_01", "title": "${exampleTitle}", "description": "", "createdAt": "2026-08-01T09:00:00.000Z", "updatedAt": "2026-08-01T09:00:00.000Z" }`,
    'Errors:   404 { "error": "Not found" } when id is missing; 400 { "error": "<message>" } on invalid id'
  ].join('\n');
}

/**
 * File tree with key function signatures.
 */
function buildFileTree(entities: string[], hasAuth: boolean): string {
  const primaryPascal = entities[0] ? entityPascal(entities[0]) : 'Item';
  const entityFiles =
    entities.length > 0
      ? entities
          .map((e) => `  api/          ${entityTable(e)}.ts   // list/create/get handlers`)
          .join('\n')
      : '  api/          items.ts          // list/create/get handlers';
  const authLine = hasAuth
    ? '  api/          auth.ts           // register, sign-in, sign-out\n'
    : '';
  const schemaNames =
    entities.length > 0
      ? entities
          .map((e) => `${entityPascal(e)}CreateSchema, ${entityPascal(e)}RowSchema`)
          .join('; ')
      : 'ItemCreateSchema, ItemRowSchema';

  return [
    '```',
    'src/',
    '  main.tsx, App.tsx, theme.ts',
    `  components/   Layout, ${primaryPascal}List, ${primaryPascal}Detail, states/`,
    `  pages/        Home, About, Terms, Privacy, Contact, ${primaryPascal}ListPage, ${primaryPascal}DetailPage`,
    '  lib/',
    '    api.ts      // typed fetch helpers',
    `    schemas.ts  // ${schemaNames}`,
    '  i18n/         en.ts',
    'functions/',
    entityFiles,
    authLine + '  api/          health.ts         // GET /api/health → { status: "ok" }',
    'migrations/    0001_init.sql',
    'wrangler.toml  # D1 binding DB',
    '',
    '// Key signatures (implement exactly these names; refine bodies as needed)',
    `export function list${primaryPascal}s(db: D1Database${hasAuth ? ', userId: string' : ''}): Promise<${primaryPascal}Row[]>`,
    `export function get${primaryPascal}(db: D1Database, id: string): Promise<${primaryPascal}Row | null>`,
    `export function create${primaryPascal}(db: D1Database, input: ${primaryPascal}Create${hasAuth ? ', userId: string' : ''}): Promise<${primaryPascal}Row>`,
    hasAuth
      ? [
          'export function hashPassword(password: string, salt: Uint8Array): Promise<ArrayBuffer>',
          'export function verifyPassword(password: string, salt: Uint8Array, hash: ArrayBuffer): Promise<boolean>',
          'export function createSession(db: D1Database, userId: string): Promise<{ token: string; expiresAt: string }>'
        ].join('\n')
      : '',
    'export async function onRequestGet(context: EventContext): Promise<Response>  // per route file',
    '```'
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** One feature used while assembling Core Features, Acceptance Criteria, and Test Plan. */
interface FeatureSpec {
  id: string;
  name: string;
  behavior: string;
  /** True when this feature is in the minimum set that solves the stated problem. */
  mvp: boolean;
  /** Testable acceptance bullets (GIVEN/WHEN/THEN form where natural). */
  acceptance: string[];
  /** Named unit / integration / e2e cases bound to acceptance. */
  tests: {
    unit: string[];
    integration: string[];
    e2e: string[];
  };
}

/** One vertical slice in the build plan. */
interface SliceSpec {
  index: number;
  name: string;
  mvp: boolean;
  db: string;
  api: string;
  ui: string;
  tests: string;
  verify: string;
  dependsOn: string;
}

/**
 * Template core features from entities + auth flag (F1, F2, …).
 * MVP features come first (browse, detail, access, manage primary); rest are beyond MVP.
 */
function buildFeatures(entities: string[], hasAuth: boolean): FeatureSpec[] {
  const primary = entities[0] ? entityPascal(entities[0]) : 'Item';
  const primaryTable = entities[0] ? entityTable(entities[0]) : 'items';
  const secondary = entities.slice(1);

  const features: FeatureSpec[] = [
    {
      id: 'F1',
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
        unit: [`filter${primary}s_byQuery_matchesTitle`, `filter${primary}s_byQuery_emptyReturnsEmpty`],
        integration: [`GET /api/${primaryTable} returns 200 with items array`, `GET /api/${primaryTable}?q= matches title`],
        e2e: [`${primaryTable}-list shows rows`, `${primaryTable}-list empty state`, `${primaryTable}-list error + retry`]
      }
    },
    {
      id: 'F2',
      name: `${primary} detail`,
      behavior: `Clicking a list row opens the full ${primary} record with title, description, and a back link.`,
      mvp: true,
      acceptance: [
        `GIVEN a ${primary} id that exists in D1 WHEN the user opens /${primaryTable}/:id THEN the page shows title, description, and a back link to the list`,
        `GIVEN an unknown id WHEN the user opens /${primaryTable}/:id THEN a not-found state with a path back to the list is shown`,
        `GIVEN the API returns 500 WHEN detail loads THEN an error message with a retry action is shown`
      ],
      tests: {
        unit: [`${primary}RowSchema_acceptsValidRow`, `${primary}RowSchema_rejectsMissingId`],
        integration: [`GET /api/${primaryTable}/:id returns 200 for existing`, `GET /api/${primaryTable}/:id returns 404 for missing`],
        e2e: [`${primaryTable}-detail shows fields`, `${primaryTable}-detail not-found state`]
      }
    }
  ];

  if (hasAuth) {
    features.push({
      id: 'F3',
      name: 'Accounts',
      behavior: 'Register and sign in with Web Crypto (PBKDF2 + HMAC-SHA256 sessions); data is scoped to the signed-in user.',
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
      name: 'Public access',
      behavior: 'No login required; all product pages and APIs are public.',
      mvp: true,
      acceptance: [
        'GIVEN an anonymous browser with no cookies WHEN the user visits Home, the list page, and a detail page THEN every page returns 200 without a redirect to login',
        'GIVEN no session WHEN the client calls list and create APIs THEN requests succeed without auth headers'
      ],
      tests: {
        unit: ['routeConfig_hasNoAuthGuard'],
        integration: ['GET /api/health is public', `GET /api/${primaryTable} is public`],
        e2e: ['smoke Home + list + detail without login']
      }
    });
  }

  // Primary entity manage is MVP; additional entities are beyond MVP.
  features.push({
    id: 'F4',
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
      e2e: [`${primaryTable}-crud create`, `${primaryTable}-crud edit`, `${primaryTable}-crud delete confirm/cancel`]
    }
  });

  secondary.forEach((entity, index) => {
    const pascal = entityPascal(entity);
    const table = entityTable(entity);
    const id = `F${5 + index}`;
    features.push({
      id,
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
        integration: [`POST /api/${table} returns 201`, `POST /api/${table} returns 400 on invalid`],
        e2e: [`${table}-crud create and delete`]
      }
    });
  });

  const pagesId = `F${features.length + 1}`;
  features.push({
    id: pagesId,
    name: 'Required pages & SEO',
    behavior: 'Ship Home, About, Terms, Privacy, Contact with per-route SEO, sitemap, and robots.txt.',
    mvp: false,
    acceptance: [
      'GIVEN the production build is served WHEN each required route is requested THEN each returns 200 with a unique title and description',
      'GIVEN the production build WHEN sitemap.xml and robots.txt are requested THEN both files exist and are non-empty',
      'GIVEN each required page WHEN the document head is inspected THEN OG title/description are present and unique per route'
    ],
    tests: {
      unit: ['seoMeta_uniquePerRoute'],
      integration: ['GET /about /terms /privacy /contact return 200', 'GET /sitemap.xml and /robots.txt exist'],
      e2e: ['required-pages smoke all five routes']
    }
  });

  return features;
}

/**
 * Render §8 Core Features with MVP first, then Beyond MVP.
 */
function renderCoreFeatures(features: FeatureSpec[]): string {
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
 */
function renderAcceptanceCriteria(features: FeatureSpec[]): string {
  return features
    .map((f) => {
      const bullets = f.acceptance.map((line) => `- ${line}`).join('\n');
      return `### ${f.id} — ${f.name}\n\n**Acceptance criteria**\n${bullets}`;
    })
    .join('\n\n');
}

/**
 * Render §10 Test Plan with named cases per feature.
 */
function renderTestPlan(features: FeatureSpec[]): string {
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

/**
 * Build vertical slices: Slice 0 walking skeleton, then one slice per MVP feature, then non-MVP.
 */
function buildSlices(opts: {
  slug: string;
  entities: string[];
  hasAuth: boolean;
  features: FeatureSpec[];
  dataStorage: DataStorage;
}): SliceSpec[] {
  const { slug, entities, hasAuth, features, dataStorage } = opts;
  const primary = entities[0] ? entityPascal(entities[0]) : 'Item';
  const primaryTable = entities[0] ? entityTable(entities[0]) : 'items';
  const entityLabel =
    entities.length > 0 ? entities.map((e) => entityPascal(e)).join(', ') : 'Item';

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
    const isPrimaryBrowse = feature.id === 'F1';
    const isPrimaryDetail = feature.id === 'F2';
    const isAccess = feature.id === 'F3';
    const isPrimaryManage = feature.id === 'F4';
    const isPages = feature.name.startsWith('Required pages');

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
      : isAccess && hasAuth
        ? 'npx vitest run functions/api/auth.test.ts && npx playwright test tests/auth.spec.ts'
        : isAccess && !hasAuth
          ? 'npx playwright test tests/smoke-public.spec.ts'
          : isPrimaryBrowse
            ? `npx vitest run functions/api/${primaryTable}.test.ts && npx playwright test tests/${primaryTable}-list.spec.ts`
            : isPrimaryDetail
              ? `npx playwright test tests/${primaryTable}-detail.spec.ts`
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
function renderBuildPlan(slices: SliceSpec[]): string {
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

/**
 * Human label for a data-storage wizard choice (embedded in the PRD).
 */
function storageLabel(storage: DataStorage): string {
  switch (storage) {
    case 'none':
      return 'None (stateless / no domain tables)';
    case 'relational':
      return 'Relational + search (D1 tables with indexes and list/search endpoints)';
    case 'simple':
    default:
      return 'Simple D1 tables (CRUD + parameterized queries)';
  }
}

/**
 * Architecture subsection: concrete Cloudflare stack, request flow, layer bounds.
 */
function buildArchitectureSection(opts: {
  hasAuth: boolean;
  dataStorage: DataStorage;
  hasRealtime: boolean;
  integrations: string;
}): string {
  const storageLine = storageLabel(opts.dataStorage);
  const realtimeLine = opts.hasRealtime
    ? 'Yes — design for live refresh (short polling or Server-Sent Events over Pages Functions; no long-lived Node WebSocket server). Document the chosen mechanism in the API contract before coding.'
    : 'No — request/response only; do not add sockets or live channels.';
  const integrationsLine =
    opts.integrations.trim().length > 0
      ? opts.integrations.trim()
      : 'None specified — do not invent third-party integrations.';
  const authLine = opts.hasAuth
    ? 'Web Crypto (PBKDF2 password hash + HMAC-SHA256 session cookies) in Pages Functions'
    : 'None (public routes; no session middleware)';

  return [
    'Concrete runtime for a coding agent that has **only this PRD**.',
    '',
    '### Stack',
    '',
    '| Layer | Choice |',
    '|-------|--------|',
    '| UI | Vite + React + TypeScript (strict) SPA on **Cloudflare Pages** |',
    '| API | **Cloudflare Pages Functions** (`functions/api/*`) |',
    `| Data | **Cloudflare D1** — ${storageLine} |`,
    `| Auth | ${authLine} |`,
    `| Realtime | ${realtimeLine} |`,
    `| Integrations | ${integrationsLine} |`,
    '',
    '### Request flow',
    '',
    '```',
    'Browser (SPA)',
    '   |  fetch /api/...',
    '   v',
    'Pages Function  -- Zod validate at boundary',
    '   |  parameterized SQL only',
    '   v',
    'D1 binding (env.DB)',
    '   |',
    '   v',
    'JSON Response + security headers (from shared http helper)',
    '```',
    '',
    '### Where concerns live',
    '',
    '- **Validation:** Zod schemas in `src/lib` / `functions` at every request boundary; fail closed (400) on invalid input.',
    '- **Error handling:** typed errors; never swallow exceptions; never render failure as an empty success.',
    '- **Security headers / CORS:** shared helper in `functions/lib/http.ts` (or equivalent) applied on every API response.',
    '- **Secrets:** Cloudflare secrets / `.env` only — never in source, client bundles, or logs.',
    '',
    '### Layer boundaries (hard)',
    '',
    '- No Node-only globals (`process`, `Buffer`) or native modules (`better-sqlite3`, `bcrypt`, `jsonwebtoken`) in Worker or browser code.',
    '- No Express or long-running Node server; no Supabase.',
    `- Data storage mode for this build: **${opts.dataStorage}** (default is \`${DEFAULT_DATA_STORAGE}\` when unspecified).`,
    opts.dataStorage === 'none'
      ? '- Storage is out of scope: do not add domain DDL beyond optional auth tables if auth is on.'
      : '- All domain tables and indexes are defined in `migrations/0001_init.sql` and match the Interface contract below.'
  ].join('\n');
}

/**
 * Design specifications as checkable requirements (premium shell + tokens).
 */
function buildDesignSpecifications(): string {
  return [
    'These are **checkable** requirements for the UI system. A visual + axe review must pass at the listed viewports in both themes.',
    '',
    '#### Theme and tokens',
    '',
    '- [ ] Semantic theme tokens only (no raw hex/rgb/px for color/space in components). Tokens resolve per theme (light + dark).',
    '- [ ] Light and dark themes ship with a visible theme toggle; default follows system preference; choice may persist.',
    '- [ ] WCAG AA contrast: at least **4.5:1** for body text, **3:1** for large text and UI chrome. Measure with **axe-core**, not hand-parsed CSS.',
    '',
    '#### Type and spacing',
    '',
    '- [ ] Type scale from the design system (body floor **16px** / scale step that maps to 16px minimum for readable body copy).',
    '- [ ] Spacing scale from design tokens (consistent rhythm; no one-off magic numbers for layout gaps).',
    '- [ ] Minimum touch target **44×44px** for interactive controls (R1.1).',
    '- [ ] Safe-area insets respected on sticky bars and primary CTAs (`env(safe-area-inset-*)`).',
    '',
    '#### Premium shell (required pages)',
    '',
    `- [ ] Sticky top nav with brand mark, primary links, clear **hover** and **active** states (not bare text links).`,
    '- [ ] Breadcrumbs on inner/detail pages.',
    `- [ ] Required routes: **${REQUIRED_PAGES.join(', ')}** with unique title/description/OG per route.`,
    '- [ ] Professional multi-column footer; real brand mark (not emoji).',
    '- [ ] Loading, error, and empty states on every data screen; confirm before destructive actions.',
    '',
    '#### Responsive verification',
    '',
    '- [ ] No overlapping or clipped text at **375px**.',
    '- [ ] Verified at **375 / 768 / 1280** in **both** light and dark themes via real screenshots + axe (zero serious/critical).'
  ].join('\n');
}

/**
 * RedAnvil coding non-negotiables embedded for agents that only receive the PRD.
 */
function buildCodingStandard(): string {
  return [
    'Echo of `rules/base-15.md` + `rules/per-app-pack.md`. Treat every line as a **must**.',
    '',
    '- [ ] **Strict TypeScript** — `strict` on; zero `any`; no untyped defs.',
    '- [ ] **Fail closed** — typed errors; unknown/partial state is an explicit error on screen and in APIs; never silent success.',
    '- [ ] **Parameterized D1 only** — no string-concatenated SQL.',
    '- [ ] **Zod at the boundary** — validate every request body/query; reject invalid input with 400.',
    '- [ ] **No Node-only globals/modules** in Worker or browser code (`process`, `Buffer`, `better-sqlite3`, `bcrypt`, `jsonwebtoken`).',
    '- [ ] **No secrets in code** — env / Cloudflare secrets only; never log secrets or PII.',
    '- [ ] **Real data only** — no filler copy, dummy rows, placeholder metrics, or fabricated scores.',
    '- [ ] **Smallest correct diff** — no speculative abstraction, no padding, no drive-by refactors.',
    '- [ ] **Single-purpose files** — small modules; pages compose named components.',
    '- [ ] **All user-facing copy** lives in the locale bundle (`src/i18n/en.ts`); no hardcoded UI strings.',
    '- [ ] **Theme tokens only** — colors/spacing/type from the design system; WCAG AA.',
    '- [ ] **Platform** — Cloudflare Pages + Pages Functions + D1; Web Crypto for auth when auth is in scope; no Express/Supabase.',
    '',
    '### Platform constraints checklist',
    '',
    '- **Platform:** Vite + React + TypeScript (strict) + Tailwind + React Router; Cloudflare Pages Functions + D1. No Express, no long-running Node server, no Supabase.',
    '- **Input safety:** parameterized SQL only; Zod validate every request body/query at the boundary.',
    '- **UX states:** every data screen defines loading, error, and empty; confirm before destructive actions.',
    '- **Fail closed:** typed errors; never log secrets or PII. Real data only — no fabricated metrics.'
  ].join('\n');
}

/**
 * Verification & gates section with exact commands.
 */
function buildVerificationSection(slug: string): string {
  return [
    `**Target score:** >= **${PRD_THRESHOLD}** (see frontmatter \`threshold\`). Stop only when the RedAnvil gate reports score >= threshold with zero tier-1 blockers. Do not trust self-report.`,
    '',
    'Run from the **app directory** unless noted:',
    '',
    '1. `npx tsc --noEmit`',
    '2. `npx eslint . --max-warnings 0`',
    '3. `npx vitest run`',
    '4. `npm run build`',
    '5. Runtime health (after `npx wrangler pages dev ./dist` or equivalent local serve):',
    '   `curl -sf http://127.0.0.1:<port>/api/health` → JSON including `"status":"ok"`',
    '6. Playwright primary flow + axe (zero serious/critical violations)',
    '7. Visual review screenshots at 375 / 768 / 1280 (light + dark)',
    '',
    'From the **RedAnvil monorepo root** (see root `README.md` / `npm run gate`):',
    '',
    '```bash',
    `npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}`,
    '```',
    '',
    'Optional excludes when a check is not applicable: `--na ci,process` (only with documented reason).'
  ].join('\n');
}

/**
 * User stories derived from features and the product framing.
 */
function buildUserStories(
  prompt: string,
  appType: string,
  features: FeatureSpec[],
  hasAuth: boolean
): string {
  const role = hasAuth ? 'registered user' : 'pet owner or end user';
  const appRole = appType.toLowerCase().includes('mobile') ? 'mobile user' : role;
  const stories = features
    .filter((f) => f.mvp)
    .map((f) => {
      const capability = f.name.charAt(0).toLowerCase() + f.name.slice(1);
      return `- As a **${appRole}**, I want **${capability}**, so that **${f.behavior.replace(/\.$/, '')}**.`;
    });
  stories.push(
    `- As a **builder**, I want **a vertical-slice build plan with verify commands**, so that **${prompt.trim().slice(0, 80)}${prompt.trim().length > 80 ? '…' : ''}** can be shipped with continuous end-to-end feedback.`
  );
  return stories.join('\n');
}

/**
 * Success outcome bullets — observable definition of done.
 */
function buildSuccessOutcome(
  title: string,
  features: FeatureSpec[],
  slug: string
): string {
  const mvp = features.filter((f) => f.mvp);
  const lines = [
    `- A user can complete the MVP flows (${mvp.map((f) => f.id).join(', ')}) without auth walls unless auth is in scope.`,
    `- Every MVP acceptance bullet under §9 is exercised by a named test in §10 and is green.`,
    `- \`GET /api/health\` returns JSON including \`"status":"ok"\` on a local Pages Functions serve.`,
    `- \`npx tsc --noEmit\`, \`npx eslint . --max-warnings 0\`, \`npx vitest run\`, and \`npm run build\` all exit 0.`,
    `- From monorepo root, \`npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}\` reports score >= **${PRD_THRESHOLD}** with zero tier-1 blockers.`,
    `- No incomplete stub copy remains in the product UI; all user-facing strings live in \`src/i18n/en.ts\`.`,
    `- The product named **${title}** solves the problem stated in §2 for the MVP feature set alone.`
  ];
  return lines.join('\n');
}

/**
 * Placeholder / incomplete markers that must not appear in a finished PRD body.
 * Excludes the self-check label text itself so grading is not self-defeating.
 */
/** Incomplete stub markers; word-boundary so normal prose is safe. */
const PLACEHOLDER_RE = /\b(TBD|TODO|FIXME|lorem ipsum)\b/i;

/**
 * Grade PRD markdown against verifiable completeness checks.
 * Score is always computed from the checks — never a hardcoded grade.
 *
 * @param markdown - Full PRD markdown (or a partial document under test).
 * @param opts - Optional generation context for entity/DDL checks.
 */
export function evaluatePrdSelfCheck(
  markdown: string,
  opts?: { entities?: string[]; hasDomainTables?: boolean }
): PrdSelfCheckResult {
  const entities = opts?.entities ?? [];
  const hasDomainTables = opts?.hasDomainTables ?? true;

  // Body used for placeholder scan: strip the self-check section so its own
  // checklist labels (which mention "placeholder") do not fail the check.
  const selfCheckAt = markdown.indexOf('## 14. PRD Self-Check');
  const bodyForPlaceholders = selfCheckAt >= 0 ? markdown.slice(0, selfCheckAt) : markdown;

  const hasFrontmatter =
    /```yaml[\s\S]*?threshold:\s*\d+[\s\S]*?```/.test(markdown) ||
    /```yaml[\s\S]*?slug:\s*".+?"[\s\S]*?```/.test(markdown);

  const problemSection = markdown.match(
    /## 2\. Problem Statement\s*\n+([\s\S]*?)(?=\n## \d+\.)/
  );
  const problemText = problemSection?.[1]?.trim() ?? '';

  const userStoryCount = (markdown.match(/As a \*\*[^*]+\*\*, I want/g) ?? []).length;

  const mvpFeatureCount = (markdown.match(/\*\*\[MVP\]\*\*/g) ?? []).length;

  // Acceptance bullets under §9: lines that look like "- GIVEN ..." or plain "- ..." after Acceptance criteria
  const acceptanceSection = markdown.match(
    /## 9\. Acceptance Criteria\s*\n+([\s\S]*?)(?=\n## \d+\.)/
  );
  const acceptanceBody = acceptanceSection?.[1] ?? '';
  const featureBlocks = acceptanceBody.split(/### F\d+ —/).slice(1);
  const everyFeatureHasAcceptanceBullet =
    featureBlocks.length > 0 &&
    featureBlocks.every((block) => /^\s*-\s+\S+/m.test(block));

  const entityDdlPresent =
    !hasDomainTables || entities.length === 0
      ? markdown.includes('CREATE TABLE') || markdown.includes('No D1 domain schema')
      : entities.every((e) =>
          markdown.includes(`CREATE TABLE IF NOT EXISTS ${entityTable(e)}`)
        );

  const slicesWithVerify =
    (markdown.match(/### Slice \d+ —/g) ?? []).length > 0 &&
    (markdown.match(/^- Verify: `/gm) ?? []).length >=
      (markdown.match(/### Slice \d+ —/g) ?? []).length;

  const noPlaceholders = !PLACEHOLDER_RE.test(bodyForPlaceholders);

  const gateNamed =
    /npm run gate -- /.test(markdown) && markdown.includes(`--threshold ${PRD_THRESHOLD}`);

  const hasApiExample =
    /Request:\s*\{[\s\S]*?\}/.test(markdown) && /Response:\s*\d{3}\s*\{/.test(markdown);

  const sectionsInOrder = PRD_SECTION_HEADINGS.every((heading, i) => {
    const at = markdown.indexOf(`## ${heading}`);
    if (at < 0) return false;
    if (i === 0) return true;
    const prevAt = markdown.indexOf(`## ${PRD_SECTION_HEADINGS[i - 1]}`);
    return prevAt >= 0 && prevAt < at;
  });

  const items: PrdSelfCheckItem[] = [
    { id: 'frontmatter', label: 'Machine frontmatter present', pass: hasFrontmatter },
    { id: 'problem', label: 'Problem statement present', pass: problemText.length > 0 },
    { id: 'user-stories', label: 'At least one user story', pass: userStoryCount >= 1 },
    { id: 'mvp-features', label: 'At least one MVP feature marked', pass: mvpFeatureCount >= 1 },
    {
      id: 'acceptance-bullets',
      label: 'Every feature has ≥1 acceptance bullet',
      pass: everyFeatureHasAcceptanceBullet
    },
    {
      id: 'ddl',
      label: 'DDL present for every entity (or explicit none)',
      pass: entityDdlPresent
    },
    {
      id: 'slice-verify',
      label: 'Every vertical slice has a verify command',
      pass: slicesWithVerify
    },
    {
      id: 'no-placeholders',
      label: 'No placeholder tokens (TBD/TODO/lorem) in body',
      pass: noPlaceholders
    },
    { id: 'gate', label: 'Gate command named with threshold', pass: gateNamed },
    {
      id: 'api-examples',
      label: 'API example includes request and response bodies',
      pass: hasApiExample
    },
    {
      id: 'sections-order',
      label: 'All 14 standard sections present in order',
      pass: sectionsInOrder
    },
    {
      id: 'success-outcome',
      label: 'Success Outcome (definition of done) present',
      pass: /## 4\. Success Outcome/.test(markdown) && markdown.includes('score >=')
    }
  ];

  const passed = items.filter((i) => i.pass).length;
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((passed / total) * 100);

  const checklist = items
    .map((i) => `- [${i.pass ? 'x' : ' '}] ${i.label}`)
    .join('\n');
  const markdownOut = [
    '## 14. PRD Self-Check',
    '',
    'Completeness graded from this document at generation time (not a hardcoded score).',
    '',
    checklist,
    '',
    `**Grade: ${passed}/${total} checks passed (${percent}%)**`
  ].join('\n');

  return { items, passed, total, percent, markdown: markdownOut };
}

/**
 * Generates a complete, agent-ready implementation spec (markdown) from the
 * wizard answers and the token estimate. Deterministic — the same answers
 * always produce the same document.
 *
 * Sections follow the standard 14-part outline: Introduction through PRD Self-Check,
 * with machine frontmatter first, vertical-slice build plan, MVP-first features,
 * and a computed self-grade.
 */
export function generatePrd(
  answers: Pick<WizardAnswers, 'prompt' | 'appType' | 'hasAuth' | 'entities'> &
    Partial<Pick<WizardAnswers, 'dataStorage' | 'hasRealtime' | 'integrations'>>,
  cost: TokenEstimate
): Prd {
  const full = withWizardDefaults(answers);
  const prompt = full.prompt.trim();
  const slug = slugFromPrompt(prompt);
  const title = titleFromPrompt(prompt);
  const entities = entityList(full.entities);
  const appType = full.appType.trim() || 'web application';
  const hasAuth = full.hasAuth;
  const dataStorage = full.dataStorage;
  const hasRealtime = full.hasRealtime;
  const integrations = full.integrations;

  const entityNames = entities.length > 0 ? entities : ['Item'];
  const features = buildFeatures(entityNames, hasAuth);
  const mvpFeatures = features.filter((f) => f.mvp);
  const featureIds = features.map((f) => f.id).join(', ');
  const mvpIds = mvpFeatures.map((f) => f.id).join(', ');
  const slices = buildSlices({
    slug,
    entities: entityNames,
    hasAuth,
    features,
    dataStorage
  });
  const lastSlice = slices[slices.length - 1]!;

  const ddlBlocks = [
    ...(hasAuth ? [authDdl()] : []),
    ...(dataStorage === 'none' ? [] : entityNames.map((e) => entityDdl(e, hasAuth)))
  ].join('\n\n');

  const apiBlocks =
    dataStorage === 'none'
      ? '_No domain CRUD tables (data storage = none). Health (and auth if in scope) still required._'
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
    dataStorage === 'none' ? '' : `| \`/${primaryTable}\` | List |`,
    dataStorage === 'none' ? '' : `| \`/${primaryTable}/:id\` | Detail |`,
    ...REQUIRED_PAGES.filter((p) => p !== 'Home').map((p) => `| \`/${p.toLowerCase()}\` | ${p} |`),
    hasAuth ? '| `/sign-in`, `/register` | Auth |' : ''
  ]
    .filter(Boolean)
    .join('\n');

  const entityListLabel = entityNames.map((e) => entityPascal(e)).join(', ');

  const promptClause = /[.!?]$/.test(prompt) ? prompt : `${prompt}.`;
  const introduction = [
    `**${title}** is a **${appType}** that addresses: ${promptClause}`,
    `It ships as a full-stack Cloudflare app (Pages + Pages Functions + D1) with gate threshold **${PRD_THRESHOLD}**.`,
    `MVP scope is ${mvpIds}; ship those vertical slices before Beyond-MVP work.`
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
    `Users complete MVP flows (${mvpIds}) first: browse and manage the primary entity, open detail, and ${hasAuth ? 'sign in' : 'use the app anonymously'}.`,
    'Each capability is delivered as a vertical slice (DB + API + UI + tests) so something works end-to-end after every slice, not only at the end of a horizontal phase plan.'
  ].join(' ');

  // Body without self-check first; grade against that body + section stubs, then append grade.
  const bodyBeforeSelfCheck = `# Implementation Spec — ${title}

${buildFrontmatter({ slug, title, appType, hasAuth, entities: entityNames })}

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

${buildNonGoals(hasAuth, entityNames, appType, integrations)}

## 6. User Stories

${buildUserStories(prompt, appType, features, hasAuth)}

## 7. Technical Requirements

### 7.1 Architecture

${buildArchitectureSection({ hasAuth, dataStorage, hasRealtime, integrations })}

### 7.2 Interface contract

Default columns below are concrete starting points to refine — do **not** invent extra tables or replace these defaults without updating this contract first.

#### File tree and key signatures

${buildFileTree(entityNames, hasAuth)}

#### D1 schema (DDL)

${
  dataStorage === 'none' && !hasAuth
    ? '_No D1 domain schema for this build (data storage = none, auth off)._'
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
    entities: entityNames,
    hasDomainTables: dataStorage !== 'none'
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
    entities: entityNames,
    hasDomainTables: dataStorage !== 'none'
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
