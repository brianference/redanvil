import { describe, expect, it } from 'vitest';
import { estimate } from '../estimate';
import { generatePrd } from './generate';
import { detectCapabilities } from './sections/capabilities';

/**
 * The prompt that shipped a scheduling PRD for a dog-care tracker.
 *
 * "appointments" used to win because the detector kept the first two regex
 * hits, and schedule was earlier in the list than track. The entities come
 * from the wizard spec, not from mining the sentence.
 */
const DOG_CARE_PROMPT =
  'A reminder app for dog owners that tracks recurring care tasks like vaccinations, grooming and vet appointments per dog, with due dates and a history';

/** Contract example. Every entity has fields, so generation is allowed to run. */
const DOG_CARE_SPEC =
  'Dog: name, breed, birthDate:date; CareTask: title, dueDate:date, repeatDays:int, dog->Dog; CareLog: doneAt:datetime, note, task->CareTask';

describe('dog-care capability regression', () => {
  it('ranks tracking ahead of scheduling, and the schema comes from the wizard spec', () => {
    const kinds = detectCapabilities(DOG_CARE_PROMPT, ['Dog', 'CareTask', 'CareLog']).map(
      (capability) => capability.kind
    );
    expect(kinds[0]).toBe('track');
    expect(kinds).not.toContain('schedule');

    const prd = generatePrd(
      {
        prompt: DOG_CARE_PROMPT,
        appName: 'Dog Care',
        appType: 'Mobile app',
        hasAuth: false,
        entities: DOG_CARE_SPEC
      },
      estimate({ features: 4, hasAuth: false, entities: 3 })
    );

    expect(prd.markdown).not.toMatch(/double-booking/i);
    expect(prd.markdown).not.toMatch(/refuses assignments that conflict/i);
    expect(prd.markdown).toContain('CREATE TABLE IF NOT EXISTS dogs');
    expect(prd.markdown).toContain('CREATE TABLE IF NOT EXISTS care_tasks');
    expect(prd.markdown).toContain('dueDate TEXT NOT NULL, -- ISO-8601 date');
    expect(prd.markdown).toContain(
      'FOREIGN KEY (dog) REFERENCES dogs(id) ON DELETE CASCADE'
    );
    expect(prd.markdown).toMatch(/entities: \["Dog", "CareTask", "CareLog"\]/);
    expect(prd.markdown).not.toContain('rem_01');
    expect(prd.markdown).not.toContain('Scheduled care task');
  });
});
