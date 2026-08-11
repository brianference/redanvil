/**
 * Small text normalisers shared across RedAnvil apps.
 *
 * React-free and dependency-free, like `http.ts` and `theme.ts`.
 */

/**
 * Treat a blank or whitespace-only query value as absent.
 *
 * Written as a plain function rather than a zod helper so the shared module
 * never imports zod: the apps are not all on the same major version (one is on
 * zod 4, the rest on 3), and a schema built from one copy and validated by
 * another is the class of bug that is very hard to read from a stack trace.
 * Each app keeps its own `z` and passes this to `.transform(...)`.
 *
 * @param value - Raw query value, possibly undefined.
 * @returns The trimmed value, or undefined when absent or blank.
 */
export function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
