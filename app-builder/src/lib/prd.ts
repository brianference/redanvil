import type { WizardAnswers } from './job';
import { slugFromPrompt } from './job';

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
function buildNonGoals(hasAuth: boolean, entities: string[], appType: string): string {
  const entityScope =
    entities.length > 0 ? entities.map((e) => entityPascal(e)).join(', ') : 'Item (default)';
  const lines = [
    `- Do not invent domain entities beyond the frontmatter list: **${entityScope}**.`,
    hasAuth
      ? '- Auth is in scope (Web Crypto only). Do not add OAuth, social login, or third-party IdPs unless the mission states them.'
      : '- **No authentication** — every route is public; do not add register/login, sessions, or user-owned scoping.',
    '- No payment processing, billing, or secrets handling in the app (no Stripe, no vault, no secret files in the repo).',
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
 * API route lines and Zod schema names for one entity.
 */
function entityApiContract(entity: string): string {
  const table = entityTable(entity);
  const pascal = entityPascal(entity);
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
    `- Handler file: \`functions/api/${table}.ts\``
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

/** One feature row used while assembling section 4. */
interface FeatureSpec {
  id: string;
  name: string;
  behavior: string;
  given: string;
  when: string;
  then: string;
  verify: string;
}

/**
 * Template core features from entities + auth flag (F1, F2, …).
 */
function buildFeatures(entities: string[], hasAuth: boolean): FeatureSpec[] {
  const primary = entities[0] ? entityPascal(entities[0]) : 'Item';
  const primaryTable = entities[0] ? entityTable(entities[0]) : 'items';
  const features: FeatureSpec[] = [
    {
      id: 'F1',
      name: `Browse & search ${primary}`,
      behavior: `Users can search and filter the ${primaryTable} list.`,
      given: `seeded ${primaryTable} exist and the list page is open`,
      when: 'the user enters a query that matches one title (or clears the query)',
      then: 'matching rows render, or an empty-state message shows when nothing matches / the list is empty',
      verify: 'unit (search/filter pure function) + Playwright list page'
    },
    {
      id: 'F2',
      name: `${primary} detail`,
      behavior: `Clicking a list row opens the full ${primary} record.`,
      given: `a ${primary} id that exists in D1`,
      when: `the user opens /${primaryTable}/:id`,
      then: 'the page shows title, description, and a back link to the list',
      verify: `Playwright ${primaryTable}-detail.spec.ts`
    }
  ];

  if (hasAuth) {
    features.push({
      id: 'F3',
      name: 'Accounts',
      behavior: 'Register and sign in with Web Crypto (PBKDF2 + HMAC-SHA256 sessions).',
      given: 'no session cookie',
      when: 'the user registers, signs out, and signs back in with the same credentials',
      then: 'they receive a session and only see their own rows on list endpoints',
      verify: 'Playwright auth flow + curl register/sign-in with cookie jar'
    });
  } else {
    features.push({
      id: 'F3',
      name: 'Public access',
      behavior: 'No login required; all product pages are public.',
      given: 'an anonymous browser with no cookies',
      when: 'the user visits Home, the list page, and a detail page',
      then: 'every page returns 200 without a redirect to login',
      verify: 'curl / and Playwright smoke (no auth gates)'
    });
  }

  const manageEntities = entities.length > 0 ? entities.slice(0, 3) : ['Item'];
  manageEntities.forEach((entity, index) => {
    const pascal = entityPascal(entity);
    const table = entityTable(entity);
    const id = `F${4 + index}`;
    features.push({
      id,
      name: `Manage ${pascal}`,
      behavior: `Create, edit, and delete ${table} with confirmation before delete.`,
      given: hasAuth ? 'an authenticated user on the manage form' : 'the manage form is open',
      when: `the user creates a ${pascal}, edits its title, then confirms delete`,
      then: 'list reflects create/edit and the row is gone after confirmed delete (cancel leaves it)',
      verify: `Playwright ${table}-crud.spec.ts + unit on ${pascal}CreateSchema`
    });
  });

  // Required pages as a final feature so UAT can bind to them.
  const pagesId = `F${features.length + 1}`;
  features.push({
    id: pagesId,
    name: 'Required pages & SEO',
    behavior: 'Ship Home, About, Terms, Privacy, Contact with per-route SEO.',
    given: 'the production build is served',
    when: 'each required route is requested',
    then: 'each returns 200 with a unique title/description and sitemap.xml + robots.txt exist',
    verify: 'curl routes + file presence check'
  });

  return features;
}

/**
 * Render feature section markdown.
 */
function renderFeatures(features: FeatureSpec[]): string {
  return features
    .map(
      (f) =>
        `### ${f.id} — ${f.name}\n\n` +
        `${f.behavior}\n\n` +
        `**Acceptance:** GIVEN ${f.given} WHEN ${f.when} THEN ${f.then}\n\n` +
        `**Verify:** ${f.verify}`
    )
    .join('\n\n');
}

/**
 * Dependency-ordered task list with real verify commands.
 */
function buildTasks(opts: { slug: string; entities: string[]; hasAuth: boolean }): string {
  const { slug, entities, hasAuth } = opts;
  const primary = entities[0] ? entityPascal(entities[0]) : 'Item';
  const primaryTable = entities[0] ? entityTable(entities[0]) : 'items';
  const entityListLabel =
    entities.length > 0 ? entities.map((e) => entityPascal(e)).join(', ') : 'Item';

  type Task = { id: string; intent: string; verify: string };
  const tasks: Task[] = [
    {
      id: 'T1',
      intent: 'Scaffold Vite + React + TS strict + Tailwind + theme tokens + package scripts.',
      verify: 'npx tsc --noEmit'
    },
    {
      id: 'T2',
      intent: `Add D1 migration with DDL from §3 for ${entityListLabel}${hasAuth ? ' + users/sessions' : ''} and wire wrangler.toml D1 binding.`,
      verify: 'test -f migrations/0001_init.sql && npx wrangler d1 migrations apply DB --local'
    },
    {
      id: 'T3',
      intent: `Add Zod schemas (${entityListLabel} Create/Row) and a typed API client in src/lib.`,
      verify: 'npx vitest run src/lib/schemas.test.ts'
    },
    {
      id: 'T4',
      intent: 'Implement GET /api/health returning JSON { "status": "ok" }.',
      verify:
        'npx wrangler pages dev ./dist --port 8788 & sleep 3; curl -sf http://127.0.0.1:8788/api/health'
    }
  ];

  if (hasAuth) {
    tasks.push({
      id: 'T5',
      intent:
        'Auth: register, sign-in, sign-out with Web Crypto PBKDF2 + HMAC session cookies; scope data by user_id.',
      verify: 'npx vitest run functions/api/auth.test.ts && npx playwright test tests/auth.spec.ts'
    });
  }

  const crudId = hasAuth ? 'T6' : 'T5';
  tasks.push({
    id: crudId,
    intent: `Entity CRUD APIs for ${entityListLabel}: GET list, POST create, GET :id (parameterized SQL only).`,
    verify: `npx vitest run functions/api/${primaryTable}.test.ts`
  });

  const uiId = hasAuth ? 'T7' : 'T6';
  tasks.push({
    id: uiId,
    intent: `List/search + detail UI for ${primary}; loading, error, empty states.`,
    verify: `npx playwright test tests/${primaryTable}-flow.spec.ts`
  });

  const pagesId = hasAuth ? 'T8' : 'T7';
  tasks.push({
    id: pagesId,
    intent: `Required pages (${REQUIRED_PAGES.join(', ')}) + full SEO (title/description/OG, sitemap, robots.txt).`,
    verify: 'test -f public/sitemap.xml && test -f public/robots.txt && npx vitest run src/pages'
  });

  const uxId = hasAuth ? 'T9' : 'T8';
  tasks.push({
    id: uxId,
    intent: 'Confirm dialogs before destructive deletes; empty/error/loading on every data screen.',
    verify: `npx playwright test tests/${primaryTable}-crud.spec.ts`
  });

  const a11yId = hasAuth ? 'T10' : 'T9';
  tasks.push({
    id: a11yId,
    intent: 'a11y (axe zero serious/critical) and visual check at 375 / 768 / 1280 (light + dark).',
    verify: 'npx playwright test tests/a11y.spec.ts'
  });

  const gateId = hasAuth ? 'T11' : 'T10';
  tasks.push({
    id: gateId,
    intent: `Full RedAnvil gate at threshold ${PRD_THRESHOLD} from monorepo root.`,
    verify: `npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}`
  });

  return tasks
    .map((t, i) => `${i + 1}. **${t.id}** — ${t.intent}\n   - **Verify:** \`${t.verify}\``)
    .join('\n');
}

/**
 * Merged stack / design / quality constraints as a checkable list.
 */
function buildConstraints(hasAuth: boolean): string {
  return [
    `- **Platform:** Vite + React + TypeScript (strict) + Tailwind + React Router; Cloudflare Pages Functions + D1. No Express, no long-running Node server, no Supabase. **Check:** runtime curl + gate \`u-plat-worker-runtime\`.`,
    hasAuth
      ? `- **Auth:** Web Crypto only (PBKDF2 password hashing, HMAC-SHA256 session tokens). No bcrypt, no jsonwebtoken. **Check:** auth unit + Playwright session flow.`
      : `- **Auth:** none (public app). Do not add session middleware. **Check:** public route smoke.`,
    `- **No Node-only globals/modules** in Worker or browser code (\`process\`, \`Buffer\`, \`better-sqlite3\`). **Check:** gate runtime parity (\`lg-runtime-parity\`).`,
    `- **Strict TS, zero \`any\`.** Smallest reviewable diff; no speculative abstraction. **Check:** \`npx tsc --noEmit\`, \`npx eslint . --max-warnings 0\`.`,
    `- **Input safety:** parameterized SQL only; Zod validate every request body/query at the boundary. **Check:** gate \`u-sec-param-sql\`, \`u-val-input-validation\`.`,
    `- **Theme tokens only** (no raw hex/px in components). WCAG AA contrast (4.5:1 text, 3:1 large/UI). **Check:** gate theme rules + axe.`,
    `- **Responsive:** no overlap/clip at 375px; verify 375 / 768 / 1280. Sticky header + wordmark + multi-column footer. **Check:** Playwright viewports + visual review.`,
    `- **UX states:** every data screen defines loading, error, and empty; confirm before destructive actions. **Check:** Playwright + component tests.`,
    `- **Required pages + SEO:** ${REQUIRED_PAGES.join(', ')}; title/description/OG per route; sitemap.xml; robots.txt. **Check:** file presence + route smoke.`,
    `- **Copy & structure:** pages compose named components; user-facing strings live in \`src/i18n/en.ts\`. **Check:** lint + code review.`,
    `- **Fail closed:** typed errors; never log secrets or PII. Real data only — no fabricated metrics. **Check:** judge/UAT + SAST.`
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
 * Generates a complete, agent-ready implementation spec (markdown) from the
 * wizard answers and the token estimate. Deterministic — the same answers
 * always produce the same document.
 *
 * Sections: machine frontmatter, mission, non-goals, interface contract
 * (DDL + API + signatures), features with GIVEN/WHEN/THEN, ordered tasks,
 * constraints checklist, verification gates, and initial build prompt.
 */
export function generatePrd(answers: WizardAnswers, cost: TokenEstimate): Prd {
  const prompt = answers.prompt.trim();
  const slug = slugFromPrompt(prompt);
  const title = titleFromPrompt(prompt);
  const entities = entityList(answers.entities);
  const appType = answers.appType.trim() || 'web application';
  const hasAuth = answers.hasAuth;

  const entityNames = entities.length > 0 ? entities : ['Item'];
  const features = buildFeatures(entities, hasAuth);
  const featureIds = features.map((f) => f.id).join(', ');
  const lastTaskId = hasAuth ? 'T11' : 'T10';

  const ddlBlocks = [
    ...(hasAuth ? [authDdl()] : []),
    ...entityNames.map((e) => entityDdl(e, hasAuth))
  ].join('\n\n');

  const apiBlocks = entityNames.map((e) => entityApiContract(e)).join('\n\n');
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
        '- Handler file: `functions/api/auth.ts`'
      ].join('\n')
    : '';

  const primaryTable = entityNames[0] ? entityTable(entityNames[0]) : 'items';
  const routeMap = [
    '| Path | Page |',
    '|------|------|',
    '| `/` | Home |',
    `| \`/${primaryTable}\` | List |`,
    `| \`/${primaryTable}/:id\` | Detail |`,
    ...REQUIRED_PAGES.filter((p) => p !== 'Home').map((p) => `| \`/${p.toLowerCase()}\` | ${p} |`),
    hasAuth ? '| `/sign-in`, `/register` | Auth |' : ''
  ]
    .filter(Boolean)
    .join('\n');

  const markdown = `# Implementation Spec — ${title}

${buildFrontmatter({ slug, title, appType, hasAuth, entities: entityNames })}

> Generated by RedAnvil App Builder. Paste this whole document into Claude (or Grok) to build the app. Threshold to ship: **score >= ${PRD_THRESHOLD}** on the RedAnvil rubric.

## 1. Mission

${prompt}

Ship a **${appType}** as a full-stack Cloudflare app. Gate: score >= **${PRD_THRESHOLD}**.

## 2. Non-goals / out of scope

${buildNonGoals(hasAuth, entityNames, appType)}

## 3. Interface contract

Default columns below are concrete starting points to refine — do **not** invent extra tables or replace these defaults without updating this contract first.

### 3.1 File tree and key signatures

${buildFileTree(entityNames, hasAuth)}

### 3.2 D1 schema (DDL)

\`\`\`sql
${ddlBlocks}
\`\`\`

All queries are parameterized. Validate every input with Zod at the boundary.

### 3.3 API surface and Zod schemas

${apiBlocks}${authApi}

Also required:

| Method | Path | Purpose |
|--------|------|---------|
| GET | \`/api/health\` | Liveness — \`{ "status": "ok" }\` |

### 3.4 Client route map

${routeMap}

## 4. Features with acceptance criteria

Each feature has an ID for task and UAT binding. Exercise every acceptance line.

${renderFeatures(features)}

## 5. Task breakdown (dependency order)

Build in order. Do not start Ti+1 until Ti's verify command passes.

${buildTasks({ slug, entities: entityNames, hasAuth })}

## 6. Constraints checklist

${buildConstraints(hasAuth)}

## 7. Verification and gates

${buildVerificationSection(slug)}

## 8. Initial build prompt (paste into the coder)

> Implement this spec in dependency order (**§5**, ${hasAuth ? 'T1→T11' : 'T1→T10'}; last task **${lastTaskId}**). Honor the **§3** interface contract (DDL, routes, Zod names, signatures) before UI polish. Satisfy every feature acceptance criterion (**§4**: ${featureIds}) with the named test type. Do not implement **§2** non-goals. After each task, run that task's Verify command. Do not stop until **§7** clears: \`npx tsc --noEmit\`, \`npx eslint . --max-warnings 0\`, \`npx vitest run\`, \`npm run build\`, runtime \`curl …/api/health\`, and from monorepo root \`npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}\` at score >= ${PRD_THRESHOLD}. No push, no deploy, no secrets. Smallest correct diff. Strict TypeScript, zero \`any\`.

_Effort (human/orchestrator only): ~${cost.iterations} iterations, ~${cost.tokens.toLocaleString()} tokens (${cost.confidence} confidence)._
`;

  return { slug, title, prompt, markdown };
}
