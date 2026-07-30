/**
 * Types for the pure helpers in `u-api-real-output.mjs`.
 *
 * The check itself is `.mjs` because every check in this directory is — they
 * run as standalone scripts under `check.mjs` with no build step. The response
 * evaluators are pure functions with real edge cases (a non-2xx expectation, an
 * empty body, a collection the app named itself), and those deserve direct unit
 * tests rather than only being reached by spawning a subprocess and reading
 * text out of its stderr. This declaration is what lets the TypeScript suite
 * import them under `strict` without `allowJs`.
 */

/** What an example asserts about a route's live response. */
export interface ApiExampleExpectation {
  status?: number;
  nonEmpty?: boolean;
  minItems?: number;
}

/** One realistic call against one route. */
export interface ApiExample {
  route?: string;
  method?: string;
  body?: unknown;
  query?: Record<string, string | number>;
  params?: Record<string, string | number>;
  headers?: Record<string, string>;
  expect?: ApiExampleExpectation;
}

/** A captured live response. */
export interface CapturedResponse {
  status: number | null;
  text: string;
  body: unknown;
  error: string | null;
}

export declare function discoverRoutes(appDir: string): string[];
export declare function fillParams(
  route: string,
  params?: Record<string, string | number>
): { path: string; missing: string[] };
export declare function withQuery(
  path: string,
  query?: Record<string, string | number>
): string;
export declare function isEmptyBody(body: unknown): boolean;
export declare function primaryCollection(body: unknown): unknown[] | null;
export declare function evaluateResponse(
  example: ApiExample,
  got: CapturedResponse
): string | null;
export declare function runApiRealOutput(
  appDir: string,
  io: { pass: () => void; fail: (m?: string) => void; notApplicable: (w?: string) => void },
  deps?: { boot?: unknown }
): Promise<void>;
