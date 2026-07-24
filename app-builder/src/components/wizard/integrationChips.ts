/**
 * Whether a named integration chip is already present in the free-text field.
 *
 * @param integrations - Current integrations string.
 * @param chip - Chip label to test.
 * @returns True when the chip token is present (case-insensitive).
 */
export function integrationChipSelected(integrations: string, chip: string): boolean {
  const needle = chip.trim().toLowerCase();
  if (needle.length === 0) return false;
  return integrations
    .split(/[,;\n]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)
    .includes(needle);
}

/**
 * Toggle a common integration chip in/out of the free-text integrations field.
 *
 * @param integrations - Current integrations string.
 * @param chip - Chip label to add or remove.
 * @returns Updated comma-separated integrations string.
 */
export function toggleIntegrationChip(integrations: string, chip: string): string {
  const parts = integrations
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const needle = chip.trim().toLowerCase();
  const without = parts.filter((part) => part.toLowerCase() !== needle);
  if (without.length !== parts.length) {
    return without.join(', ');
  }
  return [...parts, chip.trim()].join(', ');
}
