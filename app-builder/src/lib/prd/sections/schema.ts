import type { EntityField, EntitySpec, FieldType } from '../entitySpec';
import { entityPascal, entityTable } from '../naming';

/** ISO timestamp used in every example response. */
const EXAMPLE_AT = '2026-08-01T09:00:00.000Z';

/**
 * SQL for one declared column, without the trailing comma.
 *
 * @param field - Parsed field.
 * @returns Column SQL and an optional end-of-line comment.
 */
function columnSql(field: EntityField): { sql: string; comment?: string } {
  const name = field.name;
  switch (field.type) {
    case 'int':
      return { sql: `${name} INTEGER NOT NULL` };
    case 'real':
      return { sql: `${name} REAL NOT NULL` };
    case 'bool':
      return { sql: `${name} INTEGER NOT NULL CHECK (${name} IN (0,1))` };
    case 'date':
      return { sql: `${name} TEXT NOT NULL`, comment: 'ISO-8601 date' };
    case 'datetime':
      return { sql: `${name} TEXT NOT NULL`, comment: 'ISO-8601 datetime' };
    case 'text':
    default:
      return { sql: `${name} TEXT NOT NULL` };
  }
}

/**
 * Example id for an entity. The prefix is the entity name, never a stock `rem_`.
 *
 * @param entityName - Parsed entity name.
 * @returns An id such as `dog_01` or `caretask_01`.
 */
function exampleId(entityName: string): string {
  const prefix = entityName.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  return `${prefix.length > 0 ? prefix : 'row'}_01`;
}

/**
 * A realistic integer for a field name.
 *
 * @param name - Field name.
 * @returns A small integer a reader can recognise.
 */
function intExample(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('day') || lower.includes('repeat')) return 7;
  if (lower.includes('minute') || lower.includes('hour')) return 30;
  if (lower.includes('serving')) return 4;
  return 1;
}

/**
 * A realistic real number for a field name.
 *
 * @param name - Field name.
 * @returns A number that matches the field (coordinates, money, or a plain real).
 */
function realExample(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('lat')) return 33.4942;
  if (lower.includes('lng') || lower.includes('lon')) return -112.074;
  if (lower.includes('price') || lower.includes('cost') || lower.includes('mile')) return 18.5;
  return 1.5;
}

/**
 * A realistic text value for a field name.
 *
 * Falls back to the field name itself so the example stays traceable.
 * Never returns the stock phrase "Scheduled care task".
 *
 * @param name - Field name.
 * @returns Example text.
 */
function textExample(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('email')) return 'owner@example.com';
  if (lower.includes('breed')) return 'Shiba Inu';
  if (lower.includes('city')) return 'Phoenix';
  if (lower.includes('note')) return 'Completed on the morning walk';
  if (lower === 'title' || lower.endsWith('title')) return 'Ear cleaning';
  if (lower === 'name' || lower.endsWith('name')) return 'Miso';
  if (lower.includes('origin')) return 'PHX';
  if (lower.includes('destination')) return 'SAN';
  if (lower.includes('airport')) return 'PHX';
  if (lower.includes('method')) return 'seed';
  if (lower.includes('role')) return 'opener';
  if (lower.includes('status')) return 'open';
  if (lower.includes('url') || lower.includes('photo') || lower.includes('image')) {
    return 'https://example.com/photo.jpg';
  }
  return name;
}

/**
 * One example value for a field, chosen from its name and type.
 *
 * @param field - Parsed field.
 * @returns A JSON-ready value. References are the target entity's example id.
 */
function exampleValue(field: EntityField): string | number | boolean {
  if (field.ref !== undefined) return exampleId(field.ref);
  const type: FieldType = field.type;
  switch (type) {
    case 'int':
      return intExample(field.name);
    case 'real':
      return realExample(field.name);
    case 'bool':
      return true;
    case 'date':
      return field.name.toLowerCase().includes('birth') ? '2020-03-14' : '2026-08-01';
    case 'datetime':
      return EXAMPLE_AT;
    case 'text':
    default:
      return textExample(field.name);
  }
}

/**
 * Example row for one entity, including id and timestamps.
 *
 * @param entity - Parsed entity.
 * @returns A plain object whose keys are the API field names.
 */
function exampleRow(entity: EntitySpec): Record<string, string | number | boolean> {
  const row: Record<string, string | number | boolean> = { id: exampleId(entity.name) };
  for (const field of entity.fields) {
    row[field.name] = exampleValue(field);
  }
  row['createdAt'] = EXAMPLE_AT;
  row['updatedAt'] = EXAMPLE_AT;
  return row;
}

/**
 * Example request body: the declared fields only.
 *
 * @param entity - Parsed entity.
 * @returns A plain object.
 */
function exampleRequest(entity: EntitySpec): Record<string, string | number | boolean> {
  const body: Record<string, string | number | boolean> = {};
  for (const field of entity.fields) {
    body[field.name] = exampleValue(field);
  }
  return body;
}

/**
 * Emit CREATE TABLE DDL for one entity from its parsed fields.
 *
 * Every table has `id`, `created_at`, and `updated_at`. Sign-in adds
 * `user_id`. Declared fields follow. A ref is TEXT plus a foreign key and
 * an index. Date columns carry an ISO-8601 comment.
 *
 * @param entity - Parsed entity. Names are already validated by the spec parser.
 * @param hasAuth - Whether domain rows are scoped to a signed-in user.
 * @returns DDL for this table and its indexes.
 */
export function entityDdl(entity: EntitySpec, hasAuth: boolean): string {
  const table = entityTable(entity.name);
  const columnLines = [
    '  id TEXT PRIMARY KEY,',
    '  created_at TEXT NOT NULL,',
    ...(hasAuth ? ['  user_id TEXT NOT NULL,'] : []),
    ...entity.fields.map((field) => {
      const column = columnSql(field);
      const comment = column.comment !== undefined ? ` -- ${column.comment}` : '';
      return `  ${column.sql},${comment}`;
    })
  ];
  const foreignKeys = entity.fields.filter((field) => field.ref !== undefined);
  if (foreignKeys.length === 0) {
    columnLines.push('  updated_at TEXT NOT NULL');
  } else {
    columnLines.push('  updated_at TEXT NOT NULL,');
    foreignKeys.forEach((field, index) => {
      const last = index === foreignKeys.length - 1;
      const comma = last ? '' : ',';
      columnLines.push(
        `  FOREIGN KEY (${field.name}) REFERENCES ${entityTable(field.ref ?? '')}(id) ON DELETE CASCADE${comma}`
      );
    });
  }
  const indexes = [
    ...(hasAuth ? [`CREATE INDEX IF NOT EXISTS idx_${table}_user_id ON ${table}(user_id);`] : []),
    ...foreignKeys.map(
      (field) => `CREATE INDEX IF NOT EXISTS idx_${table}_${field.name} ON ${table}(${field.name});`
    )
  ];
  const indexBlock = indexes.length > 0 ? `\n${indexes.join('\n')}` : '';
  return [`CREATE TABLE IF NOT EXISTS ${table} (`, ...columnLines, `);${indexBlock}`].join('\n');
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
 * API route table and request/response examples built from the entity's fields.
 *
 * Example ids use a prefix from the entity name. Values come from the field
 * name and type (`dueDate` is a date string). The stock id `rem_01` and the
 * stock sentence "Scheduled care task" are not used.
 *
 * @param entity - Parsed entity.
 * @returns Markdown for this entity's API contract.
 */
export function entityApiContract(entity: EntitySpec): string {
  const table = entityTable(entity.name);
  const pascal = entityPascal(entity.name);
  const searchable = entity.fields.find((field) => field.type === 'text' && field.ref === undefined);
  const queryNote =
    searchable !== undefined
      ? `(no body; optional query \`?q=\` for ${searchable.name} search)`
      : '(no body; optional query `?q=`)';
  const listed = JSON.stringify({ items: [exampleRow(entity)] });
  const created = JSON.stringify(exampleRow(entity));
  const request = JSON.stringify(exampleRequest(entity));
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
    `Request:  ${queryNote}`,
    `Response: 200 ${listed}`,
    'Errors:   500 { "error": "Internal server error" } on unexpected failure',
    '',
    `POST /api/${table}`,
    `Request:  ${request}`,
    `Response: 201 ${created}`,
    'Errors:   400 { "error": "<message>" } on validation failure',
    '',
    `GET /api/${table}/:id`,
    'Request:  (no body; path param `id`)',
    `Response: 200 ${created}`,
    'Errors:   404 { "error": "Not found" } when id is missing; 400 { "error": "<message>" } on invalid id'
  ].join('\n');
}

/**
 * File tree with key function signatures.
 */
export function buildFileTree(entities: string[], hasAuth: boolean): string {
  const primaryPascal = entities[0] ? entityPascal(entities[0]) : '';
  const entityFiles =
    entities.length > 0
      ? entities
          .map((e) => `  api/          ${entityTable(e)}.ts   // list/create/get handlers`)
          .join('\n')
      : '  api/          (no domain handlers — entities unresolved or storage none)';
  const authLine = hasAuth
    ? '  api/          auth.ts           // register, sign-in, sign-out\n'
    : '';
  const schemaNames =
    entities.length > 0
      ? entities
          .map((e) => `${entityPascal(e)}CreateSchema, ${entityPascal(e)}RowSchema`)
          .join('; ')
      : '(none)';
  const componentLine =
    primaryPascal.length > 0
      ? `  components/   Layout, ${primaryPascal}List, ${primaryPascal}Detail, states/`
      : '  components/   Layout, states/';
  const pagesLine =
    primaryPascal.length > 0
      ? `  pages/        Home, About, Terms, Privacy, Contact, ${primaryPascal}ListPage, ${primaryPascal}DetailPage`
      : '  pages/        Home, About, Terms, Privacy, Contact';

  return [
    '```',
    'src/',
    '  main.tsx, App.tsx, theme.ts',
    componentLine,
    pagesLine,
    '  lib/',
    '    api.ts         // typed fetch helpers',
    `    schemas.ts     // ${schemaNames}`,
    '    safeHttpUrl.ts // scheme gate for data-driven href (u-sec-safe-href)',
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
