import { describe, expect, it } from 'vitest';
import {
  ENTITY_SPEC_EXAMPLE,
  entitySpecReady,
  formatEntitySpec,
  parseEntitySpec
} from './entitySpec';

describe('parseEntitySpec', () => {
  it('parses the contract example with zero errors and round-trips', () => {
    const parsed = parseEntitySpec(ENTITY_SPEC_EXAMPLE);
    expect(parsed.errors).toEqual([]);
    expect(parsed.entities.map((entity) => entity.name)).toEqual(['Dog', 'CareTask', 'CareLog']);
    expect(parsed.entities[1]?.fields.find((field) => field.name === 'dog')?.ref).toBe('Dog');
    expect(parsed.entities[1]?.fields.find((field) => field.name === 'repeatDays')?.type).toBe(
      'int'
    );
    expect(parsed.entities[2]?.fields.find((field) => field.name === 'doneAt')?.type).toBe(
      'datetime'
    );
    expect(parsed.entities.every((entity) => entity.fields.length > 0)).toBe(true);
    const again = parseEntitySpec(formatEntitySpec(parsed.entities));
    expect(again).toEqual(parsed);
  });

  it('accepts a newline between entities', () => {
    const parsed = parseEntitySpec('Dog: name, breed\nCareTask: title, dog->Dog');
    expect(parsed.errors).toEqual([]);
    expect(parsed.entities.map((entity) => entity.name)).toEqual(['Dog', 'CareTask']);
  });

  it('normalises the first letter of entity and field names', () => {
    const parsed = parseEntitySpec('dog: Name, BirthDate:date');
    expect(parsed.errors).toEqual([]);
    expect(parsed.entities[0]?.name).toBe('Dog');
    expect(parsed.entities[0]?.fields[0]?.name).toBe('name');
    expect(parsed.entities[0]?.fields[1]?.name).toBe('birthDate');
    expect(parsed.entities[0]?.fields[1]?.type).toBe('date');
  });

  it('treats a bare name as text and drops :text on the way back out', () => {
    const parsed = parseEntitySpec('Dog: name:text, note');
    expect(parsed.errors).toEqual([]);
    expect(parsed.entities[0]?.fields.map((field) => field.type)).toEqual(['text', 'text']);
    expect(formatEntitySpec(parsed.entities)).toBe('Dog: name, note');
  });

  it('parses a legacy list as entities with no fields and zero errors', () => {
    const legacy = parseEntitySpec('Dog, CareTask');
    expect(legacy.errors).toEqual([]);
    expect(legacy.entities).toEqual([
      { name: 'Dog', fields: [] },
      { name: 'CareTask', fields: [] }
    ]);
    expect(entitySpecReady('Dog, CareTask')).toBe(false);
    const again = parseEntitySpec(formatEntitySpec(legacy.entities));
    expect(again.entities).toEqual(legacy.entities);
    expect(again.errors).toEqual([]);
  });

  it('rejects bad names, reserved names, unknown refs, and duplicates', () => {
    const badName = parseEntitySpec('Dog: 1bad, note');
    expect(badName.errors.some((error) => /invalid field name: 1bad/.test(error))).toBe(true);

    const badEntity = parseEntitySpec('dog name: title');
    expect(badEntity.errors.some((error) => /invalid entity name: dog name/.test(error))).toBe(
      true
    );
    expect(badEntity.entities).toEqual([]);

    const badType = parseEntitySpec('Dog: age:number');
    expect(badType.errors).toContain('invalid field type: number');

    const reserved = parseEntitySpec('Dog: id, created_at, name');
    expect(reserved.errors).toContain('reserved field: id');
    expect(reserved.errors).toContain('reserved field: created_at');
    expect(reserved.entities[0]?.fields.map((field) => field.name)).toEqual(['name']);

    const dangling = parseEntitySpec('CareTask: dog->Dog');
    expect(dangling.errors).toContain('unknown entity ref: dog->Dog');

    const duplicateEntity = parseEntitySpec('Dog: name; Dog: breed');
    expect(duplicateEntity.errors).toContain('duplicate entity: Dog');

    const duplicateField = parseEntitySpec('Dog: name, name');
    expect(duplicateField.errors).toContain('duplicate field: Dog.name');

    expect(entitySpecReady(ENTITY_SPEC_EXAMPLE)).toBe(true);
    expect(entitySpecReady('')).toBe(false);
    expect(entitySpecReady('Dog: id')).toBe(false);
  });

  it('returns nothing for an empty field', () => {
    expect(parseEntitySpec('')).toEqual({ entities: [], errors: [] });
    expect(parseEntitySpec('   ')).toEqual({ entities: [], errors: [] });
  });
});
