/**
 * Replace `{key}` placeholders in an i18n template.
 *
 * @param template - Copy with `{name}` tokens.
 * @param vars - Replacement values keyed by token name.
 * @returns The template with known tokens substituted; unknown tokens stay put.
 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (full, key: string) => {
    const value = vars[key];
    return value === undefined ? full : String(value);
  });
}
