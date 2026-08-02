/** Types for pure helpers and runner in `fe-result-in-viewport.mjs`. */

export declare const VIEWPORTS: ReadonlyArray<{ width: number; height: number }>;

export declare function evaluateViewportResult(input: {
  before: { signature: string; items: { y: number; text: string; tag: string }[] };
  after: { signature: string; items: { y: number; text: string; tag: string }[] };
  viewportHeight: number;
  scrollY: number;
}): {
  ok: boolean;
  reason?: string;
  nearestY?: number;
  belowFoldBy?: number;
};

export declare function pickSubsetQuery(tokens: string[]): string | null;
export declare function sourceHasSearch(appDir: string): boolean;

export declare function serveFixture(htmlPath: string): Promise<{
  base: string;
  close: () => Promise<void>;
}>;

export declare function proveAtViewport(
  browser: import('playwright').Browser,
  base: string,
  vp: { width: number; height: number }
): Promise<{ ok: boolean; reason?: string; nearestY?: number; width: number }>;

export declare function runResultInViewport(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra: (m?: string) => never;
  },
  opts?: { url?: string | null; fixture?: string | null }
): Promise<void>;
