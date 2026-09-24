import { en } from '../../i18n/en';
import { parseEntitySpec } from '../../lib/prd/entitySpec';

/**
 * Why Scope cannot advance and Forge cannot run, or null when the spec is usable.
 *
 * The message names every gap: no entities, an entity with no fields, and each
 * parser error. It is null exactly when the spec is ready to generate.
 *
 * @param text - Raw Main entities value.
 * @returns One sentence-separated message, or null.
 */
export function entitySpecBlockMessage(text: string): string | null {
  const parsed = parseEntitySpec(text);
  const parts: string[] = [];
  if (parsed.entities.length === 0) parts.push(en.wizard.entitiesRequired);
  for (const entity of parsed.entities) {
    if (entity.fields.length === 0) parts.push(en.wizard.entityNeedsField(entity.name));
  }
  for (const error of parsed.errors) parts.push(error);
  if (parts.length === 0) return null;
  return parts.join(' ');
}
