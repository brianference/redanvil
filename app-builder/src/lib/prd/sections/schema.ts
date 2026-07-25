import { entityPascal, entityTable } from '../naming';

/**
 * Emit CREATE TABLE DDL for one entity with concrete default columns.
 */
export function entityDdl(entity: string, hasAuth: boolean): string {
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
export function authDdl(): string {
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
export function entityApiContract(entity: string): string {
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
export function buildFileTree(entities: string[], hasAuth: boolean): string {
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
