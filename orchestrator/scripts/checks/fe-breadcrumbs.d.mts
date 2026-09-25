export declare function discoverRoutes(appDir: string): string[];
export declare function isHomeRoute(path: string): boolean;
export declare function innerRoutes(routes: string[]): string[];
export declare function evaluateBreadcrumbHtml(html: string): {
  ok: boolean;
  reason?: string;
};
export declare function firstRealIdFromHtml(html: string, collection: string): string | null;
export declare function resolveRealDetailId(
  base: string,
  route: string,
  opts?: {
    fetchImpl?: typeof fetch;
    browser?: { newPage: (o?: object) => Promise<unknown> } | null;
  }
): Promise<string | null>;
export declare function materialiseRoute(route: string): string;
export declare function serveFixtureDir(dir: string): Promise<{
  base: string;
  routes: string[];
  close: () => Promise<void>;
}>;
export declare function runBreadcrumbs(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra: (m?: string) => never;
  },
  opts?: { url?: string | null; fixtureDir?: string | null }
): Promise<void>;
export declare function resolveRealDetailId(
  base: string,
  route: string,
  opts?: { fetchImpl?: typeof fetch }
): Promise<string | null>;
