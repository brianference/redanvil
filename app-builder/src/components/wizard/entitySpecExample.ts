import { en } from '../../i18n/en';

/**
 * Help-text example for the Main entities field.
 *
 * Picks a short spec that matches the prompt when a domain is obvious.
 * Otherwise the contract example.
 *
 * @param prompt - The app description typed so far.
 * @returns Entity spec text to show under the field.
 */
export function entitySpecExampleForPrompt(prompt: string): string {
  const text = prompt.toLowerCase();
  const examples = en.wizard.entitySpecExamples;
  if (/\bdogs?\b|\bpets?\b|\bgroom|\bvets?\b/.test(text)) return examples.dog;
  if (/\bflights?\b|\bairline|\blayover/.test(text)) return examples.flight;
  if (/\bcrops?\b|\bplant|\bharvest\b/.test(text)) return examples.crop;
  if (/\brecipes?\b|\bcooks?\b/.test(text)) return examples.recipe;
  if (/\bshifts?\b|\bemployees?\b|\broster/.test(text)) return examples.shift;
  return examples.fallback;
}
