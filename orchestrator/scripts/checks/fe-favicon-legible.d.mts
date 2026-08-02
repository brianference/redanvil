export declare const MIN_INK: number;
export declare const MAX_INK: number;
export declare const MIN_DETAIL: number;
export interface FaviconMetrics {
  inkCoverage: number;
  detailEnergy: number;
  contrastOnWhite: number;
  contrastOnDark: number;
  inkCount: number;
  pixelCount: number;
}
export declare function analysePixels(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): FaviconMetrics;
export declare function evaluateMetrics(m: FaviconMetrics): string[];
export declare function runFaviconLegible(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra?: (m?: string) => never;
  },
  deps?: { pixels?: { rgba: Uint8ClampedArray; width: number; height: number } }
): Promise<void>;

/** First declared icon, or null. Kept for callers that want a single path. */
export declare function findFaviconPath(appDir: string): string | null;

/**
 * Every icon the app declares, in declaration order.
 *
 * All of them get measured: returning only the first match let a blank
 * favicon-32.png pass behind a good favicon.svg.
 */
export declare function findFaviconPaths(appDir: string): string[];
