/**
 * Parser for the wizard's Main entities field.
 *
 * One grammar, one place. The n8n PRD role writes text this accepts with
 * zero errors. Legacy comma lists (no colon) parse as entities with no
 * fields: valid to parse, not enough to generate.
 */

// Circular with naming.ts, which imports parseEntitySpec; both are only used at
// call time, never while either module is initialising, so the cycle is safe.
import { entityTable } from './naming';

/** Field types the entity-spec contract allows. */
export const FIELD_TYPES = ['text', 'int', 'real', 'bool', 'date', 'datetime'] as const;

/** One column type a field may declare. */
export type FieldType = (typeof FIELD_TYPES)[number];

/** A column on an entity, other than the columns every table gets. */
export interface EntityField {
  /** Field name, first letter lower case. */
  name: string;
  /** Storage type. A reference is stored as text (the other entity's id). */
  type: FieldType;
  /** When set, `name` holds that entity's id. */
  ref?: string;
}

/** One entity and the fields the user listed. */
export interface EntitySpec {
  /** Entity name, first letter upper case. */
  name: string;
  /** Declared fields. Empty for a legacy name-only entity. */
  fields: EntityField[];
}

/** What {@link parseEntitySpec} returns. Entities may be present alongside errors. */
export interface EntitySpecParse {
  /** Entities that had a legal name. Invalid names are omitted. */
  entities: EntitySpec[];
  /** Human-readable problems, in source order. */
  errors: string[];
}

/** Contract example. Also the fallback shown in the wizard. */
export const ENTITY_SPEC_EXAMPLE =
  'Dog: name, breed, birthDate:date; CareTask: title, dueDate:date, repeatDays:int, dog->Dog; CareLog: doneAt:datetime, note, task->CareTask';

/**
 * SQLite keywords (147), from https://www.sqlite.org/lang_keywords.html, fetched
 * 2026-09-24. A field or table named after one (`order`, `group`, `key`) made
 * the generated DDL a syntax error, so the parser refuses it with a rename hint.
 */
const SQL_KEYWORDS: ReadonlySet<string> = new Set([
  'abort',
  'action',
  'add',
  'after',
  'all',
  'alter',
  'always',
  'analyze',
  'and',
  'as',
  'asc',
  'attach',
  'autoincrement',
  'before',
  'begin',
  'between',
  'by',
  'cascade',
  'case',
  'cast',
  'check',
  'collate',
  'column',
  'commit',
  'conflict',
  'constraint',
  'create',
  'cross',
  'current',
  'current_date',
  'current_time',
  'current_timestamp',
  'database',
  'default',
  'deferrable',
  'deferred',
  'delete',
  'desc',
  'detach',
  'distinct',
  'do',
  'drop',
  'each',
  'else',
  'end',
  'escape',
  'except',
  'exclude',
  'exclusive',
  'exists',
  'explain',
  'fail',
  'filter',
  'first',
  'following',
  'for',
  'foreign',
  'from',
  'full',
  'generated',
  'glob',
  'group',
  'groups',
  'having',
  'if',
  'ignore',
  'immediate',
  'in',
  'index',
  'indexed',
  'initially',
  'inner',
  'insert',
  'instead',
  'intersect',
  'into',
  'is',
  'isnull',
  'join',
  'key',
  'last',
  'left',
  'like',
  'limit',
  'match',
  'materialized',
  'natural',
  'no',
  'not',
  'nothing',
  'notnull',
  'null',
  'nulls',
  'of',
  'offset',
  'on',
  'or',
  'order',
  'others',
  'outer',
  'over',
  'partition',
  'plan',
  'pragma',
  'preceding',
  'primary',
  'query',
  'raise',
  'range',
  'recursive',
  'references',
  'regexp',
  'reindex',
  'release',
  'rename',
  'replace',
  'restrict',
  'returning',
  'right',
  'rollback',
  'row',
  'rows',
  'savepoint',
  'select',
  'set',
  'table',
  'temp',
  'temporary',
  'then',
  'ties',
  'to',
  'transaction',
  'trigger',
  'unbounded',
  'union',
  'unique',
  'update',
  'using',
  'vacuum',
  'values',
  'view',
  'virtual',
  'when',
  'where',
  'window',
  'with',
  'without'
]);

/** Tables the auth kit creates. An entity mapping to one would collide with it. */
const AUTH_KIT_TABLES = new Set(['users', 'sessions']);

/** Names the generator always adds. Listing one is an error. */
const RESERVED_FIELDS = new Set(['id', 'created_at', 'updated_at']);

/** Entity name after the first letter is normalised to upper case. */
const ENTITY_NAME = /^[A-Z][A-Za-z0-9]{0,39}$/;

/** Field name after the first letter is normalised to lower case. */
const FIELD_NAME = /^[a-z][a-zA-Z0-9_]{0,39}$/;

/**
 * Trim and upper-case the first letter of an entity name.
 *
 * @param raw - Name text from the spec.
 * @returns Normalised name, or empty when the input is blank.
 */
function normaliseEntityName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Trim and lower-case the first letter of a field name.
 *
 * @param raw - Name text from the spec.
 * @returns Normalised name, or empty when the input is blank.
 */
function normaliseFieldName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/**
 * Whether a type token is one of the contract types.
 *
 * @param value - Lower-cased type text.
 * @returns True when the token is a {@link FieldType}.
 */
function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}

/**
 * Parse one field token (`name`, `name:type`, or `name->Entity`).
 *
 * @param token - Trimmed field text.
 * @param errors - Accumulator for problems with this token.
 * @returns The field, or null when the token is not usable.
 */
function parseFieldToken(token: string, errors: string[]): EntityField | null {
  const refMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*->\s*([A-Za-z][A-Za-z0-9]*)$/.exec(token);
  if (refMatch) {
    const name = normaliseFieldName(refMatch[1] ?? '');
    const ref = normaliseEntityName(refMatch[2] ?? '');
    if (!FIELD_NAME.test(name)) {
      errors.push(`invalid field name: ${refMatch[1] ?? token}`);
      return null;
    }
    if (RESERVED_FIELDS.has(name)) {
      errors.push(`reserved field: ${name}`);
      return null;
    }
    if (!ENTITY_NAME.test(ref)) {
      errors.push(`invalid entity ref: ${refMatch[2] ?? token}`);
      return null;
    }
    return { name, type: 'text', ref };
  }

  const typeMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z]+)$/.exec(token);
  if (typeMatch) {
    const name = normaliseFieldName(typeMatch[1] ?? '');
    const type = (typeMatch[2] ?? '').toLowerCase();
    if (!FIELD_NAME.test(name)) {
      errors.push(`invalid field name: ${typeMatch[1] ?? token}`);
      return null;
    }
    if (RESERVED_FIELDS.has(name)) {
      errors.push(`reserved field: ${name}`);
      return null;
    }
    if (!isFieldType(type)) {
      errors.push(`invalid field type: ${type}`);
      return null;
    }
    return { name, type };
  }

  const name = normaliseFieldName(token);
  if (!FIELD_NAME.test(name)) {
    errors.push(`invalid field name: ${token}`);
    return null;
  }
  if (RESERVED_FIELDS.has(name)) {
    errors.push(`reserved field: ${name}`);
    return null;
  }
  return { name, type: 'text' };
}

/**
 * Parse the wizard's Main entities text.
 *
 * `;` or a newline separates entities. A colon separates the name from its
 * fields. A chunk with no colon is a legacy list of entities that have no
 * fields.
 *
 * @param text - Raw field value. Nullish input parses as empty.
 * @returns Entities and errors. Errors do not throw.
 */
export function parseEntitySpec(text: string | null | undefined): EntitySpecParse {
  const errors: string[] = [];
  const entities: EntitySpec[] = [];
  const raw = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (raw.length === 0) return { entities, errors };

  const chunks = raw
    .split(/[;\n]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  for (const chunk of chunks) {
    const colon = chunk.indexOf(':');
    if (colon === -1) {
      for (const nameRaw of chunk.split(',')) {
        const trimmed = nameRaw.trim();
        if (trimmed.length === 0) continue;
        const name = normaliseEntityName(trimmed);
        if (!ENTITY_NAME.test(name)) errors.push(`invalid entity name: ${trimmed}`);
        else entities.push({ name, fields: [] });
      }
      continue;
    }

    const name = normaliseEntityName(chunk.slice(0, colon));
    if (!ENTITY_NAME.test(name)) {
      errors.push(`invalid entity name: ${chunk.slice(0, colon).trim()}`);
      continue;
    }
    const fields: EntityField[] = [];
    const fieldSrc = chunk.slice(colon + 1).trim();
    if (fieldSrc.length > 0) {
      for (const part of fieldSrc.split(',')) {
        const token = part.trim();
        if (token.length === 0) continue;
        const field = parseFieldToken(token, errors);
        if (field) fields.push(field);
      }
    }
    entities.push({ name, fields });
  }

  const names = new Set(entities.map((entity) => entity.name));
  // Compared case-insensitively and by the table each maps to: `Dog`/`DOG` and
  // `Box`/`Boxe` were both accepted, and `CREATE TABLE IF NOT EXISTS` then
  // silently dropped the second. SQLite identifiers are case-insensitive too.
  const tableOwner = new Map<string, string>();
  for (const entity of entities) {
    const table = entityTable(entity.name);
    if (SQL_KEYWORDS.has(entity.name.toLowerCase()) || SQL_KEYWORDS.has(table)) {
      errors.push(
        `${entity.name} (table ${table}) is a SQL keyword; rename it, for example ${entity.name}Item`
      );
    }
    if (AUTH_KIT_TABLES.has(table)) {
      errors.push(`${entity.name} maps to table ${table}, which the sign-in kit owns; rename it`);
    }
    const owner = tableOwner.get(table);
    if (owner !== undefined) {
      errors.push(
        owner === entity.name
          ? `duplicate entity: ${entity.name}`
          : `duplicate entity: ${owner} and ${entity.name} both map to table ${table}`
      );
    } else {
      tableOwner.set(table, entity.name);
    }
    const seenFields = new Set<string>();
    for (const field of entity.fields) {
      const key = field.name.toLowerCase();
      if (seenFields.has(key)) errors.push(`duplicate field: ${entity.name}.${field.name}`);
      seenFields.add(key);
      if (SQL_KEYWORDS.has(key)) {
        errors.push(
          `${entity.name}.${field.name} is a SQL keyword; rename it, for example ${field.name}Name`
        );
      }
      if (key === 'user_id') {
        errors.push(`reserved field: ${field.name} (sign-in adds user_id to every table)`);
      }
      if (field.ref !== undefined && !names.has(field.ref)) {
        errors.push(`unknown entity ref: ${field.name}->${field.ref}`);
      }
    }
  }
  return { entities, errors };
}

/**
 * Format entities as the wizard's Main entities value.
 *
 * `Name: field, field:type, field->Other`. Entities are separated by `; `.
 * A text field with no ref is just the name. Round-trips through
 * {@link parseEntitySpec}.
 *
 * @param entities - Parsed entities.
 * @returns Spec text.
 */
export function formatEntitySpec(entities: readonly EntitySpec[]): string {
  return entities
    .map((entity) => {
      const name = normaliseEntityName(entity.name);
      const fields = entity.fields.map((field) => {
        const fieldName = normaliseFieldName(field.name);
        if (field.ref !== undefined && field.ref.length > 0) {
          return `${fieldName}->${normaliseEntityName(field.ref)}`;
        }
        const type = field.type.toLowerCase();
        if (type === 'text') return fieldName;
        return `${fieldName}:${type}`;
      });
      return `${name}: ${fields.join(', ')}`;
    })
    .join('; ');
}

/**
 * Whether the spec is enough to generate a PRD.
 *
 * Parsing can succeed and still not be ready: zero entities, any entity
 * with no fields, or any error.
 *
 * @param text - Raw Main entities value.
 * @returns True when generation may use the spec.
 */
export function entitySpecReady(text: string): boolean {
  const parsed = parseEntitySpec(text);
  return (
    parsed.errors.length === 0 &&
    parsed.entities.length > 0 &&
    parsed.entities.every((entity) => entity.fields.length > 0)
  );
}
