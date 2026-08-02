/** Types for pure helpers and runner in `fe-resource-links.mjs`. */

export declare const BROWSER_UA: string;
export declare const LINK_TIMEOUT_MS: number;

export declare function normalisePath(p: string): string;
export declare function isItemDetailPath(path: string): boolean;
export declare function discoverItemDetailRoutes(appDir: string): string[];
export declare function materialiseRoute(route: string): string;
export declare function extractExternalHrefs(html: string, pageHost: string): string[];

export declare function probeExternalLink(
  url: string,
  cache: Map<string, { ok: boolean; status: number | null; error?: string }>
): Promise<{ ok: boolean; status: number | null; error?: string }>;

export declare function evaluatePageLinks(
  pagePath: string,
  hrefs: string[],
  probeResults: Map<string, { ok: boolean; status: number | null; error?: string }>
): { ok: boolean; failures: string[] };

export declare function serveFixtureDir(dir: string): Promise<{
  base: string;
  routes: string[];
  close: () => Promise<void>;
}>;

export declare function runResourceLinks(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra: (m?: string) => never;
  },
  opts?: { url?: string | null; fixtureDir?: string | null }
): Promise<void>;
