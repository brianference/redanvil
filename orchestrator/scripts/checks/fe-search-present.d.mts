/**
 * Types for pure helpers in `fe-search-present.mjs`.
 */

export declare const MIN_ROWS_FOR_NARROW: number;

export declare function hasBrowsableCollection(
  appDir: string,
  sources: string[]
): boolean;

export declare function pickSubsetQuery(tokens: string[]): string | null;

export declare function countJsonCollection(body: unknown): number | null;
