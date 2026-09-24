import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePrd } from './generate';
import { estimate } from '../estimate';
import { unmatchedPromptRequirements } from './selfCheck';

/** The dog-care prompt both documents below were generated from. */
const DOG_CARE_PROMPT =
  'A reminder app for dog owners that tracks recurring care tasks like vaccinations, grooming and vet appointments per dog, with due dates and a history';

/** The entity spec a person fills in on the wizard for that prompt. */
const DOG_CARE_SPEC =
  'Dog: name, breed, birthDate:date; CareTask: title, dueDate:date, repeatDays:int, dog->Dog; CareLog: doneAt:datetime, note, task->CareTask';

/**
 * Sections 8 and 9 of the PRD the old generator produced for the same prompt:
 * a double-booking scheduler with no dog, due date or history.
 */
const OLD_WRONG_PRODUCT = readFileSync(
  fileURLToPath(new URL('./__fixtures__/old-dog-care-features.md', import.meta.url)),
  'utf8'
);

describe('fidelity calibration', () => {
  it('passes the PRD generated from the entity spec', () => {
    const prd = generatePrd(
      { prompt: DOG_CARE_PROMPT, appType: 'Mobile app', hasAuth: false, entities: DOG_CARE_SPEC },
      estimate({ features: 6, entities: 3, hasAuth: false, scopeSignals: 2 })
    );
    expect(prd.markdown).toMatch(/^fidelity: pass$/m);
    expect(prd.markdown).not.toMatch(/Grade: FAIL/);
  });

  it('fails the old wrong-product PRD for the same prompt', () => {
    expect(unmatchedPromptRequirements(DOG_CARE_PROMPT, OLD_WRONG_PRODUCT)).toEqual([DOG_CARE_PROMPT]);
  });

  it('does not fail a right PRD on filler words such as "owners" or "you"', () => {
    const corpus = 'Dog CareTask dueDate history reminder alerts for care task';
    expect(unmatchedPromptRequirements(DOG_CARE_PROMPT, corpus)).toEqual([]);
  });
});
