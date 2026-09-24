import { describe, expect, it } from 'vitest';
import { parseEntitySpec } from '../entitySpec';
import { entityApiContract, entityDdl } from './schema';

const dog = parseEntitySpec(
  'Dog: name, breed, birthDate:date, walkIn:bool; CareTask: title, dueDate:date, repeatDays:int, dog->Dog'
).entities;

describe('entityDdl', () => {
  it('builds columns from the parsed fields and always adds id, created_at, updated_at', () => {
    const ddl = entityDdl(dog[0]!, false);
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS dogs');
    expect(ddl).toContain('id TEXT PRIMARY KEY');
    expect(ddl).toContain('created_at TEXT NOT NULL');
    expect(ddl).toContain('updated_at TEXT NOT NULL');
    expect(ddl).toContain('name TEXT NOT NULL');
    expect(ddl).toContain('breed TEXT NOT NULL');
    expect(ddl).toContain('birthDate TEXT NOT NULL, -- ISO-8601 date');
    expect(ddl).toContain('walkIn INTEGER NOT NULL CHECK (walkIn IN (0,1))');
    expect(ddl).not.toContain('title TEXT');
    expect(ddl).not.toContain('description TEXT');
    expect(ddl).not.toContain('user_id');
  });

  it('adds user_id when sign-in is on, and a foreign key plus an index per ref', () => {
    const ddl = entityDdl(dog[1]!, true);
    expect(ddl).toContain('user_id TEXT NOT NULL');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_care_tasks_user_id');
    expect(ddl).toContain('dueDate TEXT NOT NULL, -- ISO-8601 date');
    expect(ddl).toContain('repeatDays INTEGER NOT NULL');
    expect(ddl).toContain('dog TEXT NOT NULL');
    expect(ddl).toContain('FOREIGN KEY (dog) REFERENCES dogs(id) ON DELETE CASCADE');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_care_tasks_dog ON care_tasks(dog)');
  });
});

describe('entityApiContract', () => {
  it('builds examples from the real fields and never uses the stock reminder payload', () => {
    const contract = entityApiContract(dog[1]!);
    expect(contract).toContain('"dueDate":"2026-08-01"');
    expect(contract).toContain('"repeatDays":7');
    expect(contract).toContain('"dog":"dog_01"');
    expect(contract).toContain('"id":"caretask_01"');
    expect(contract).not.toContain('rem_01');
    expect(contract).not.toContain('Scheduled care task');
    const dogContract = entityApiContract(dog[0]!);
    expect(dogContract).toContain('"birthDate":"2020-03-14"');
    expect(dogContract).toContain('"walkIn":true');
    expect(dogContract).toContain('"breed":"Shiba Inu"');
  });
});
