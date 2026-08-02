export declare const MIN_HEIGHT_1280: number;
export declare const MIN_HEIGHT_375: number;
export declare function evaluateMarkHeights(m: {
  height1280: number | null;
  height375: number | null;
  found: boolean;
}): { ok: boolean; failures: string[] };
export declare function serveFixture(htmlPath: string): Promise<{
  base: string;
  close: () => Promise<void>;
}>;
export declare function runBrandMarkSize(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra: (m?: string) => never;
  },
  opts?: { url?: string | null; fixture?: string | null }
): Promise<void>;
