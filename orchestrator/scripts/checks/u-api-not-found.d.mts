export declare const BOGUS_ID: string;
export declare function discoverDetailRoutes(appDir: string): string[];
export declare function hasApiSurface(appDir: string): boolean;
export declare function fillBogus(route: string): string;
export declare function evaluateNotFoundStatus(status: number | null): string | null;
export declare function evaluateAbsentApiNotFound(
  status: number | null,
  body: string
): string | null;
export declare function looksLikeSpaShell(body: string): boolean;
export declare function runApiNotFound(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra?: (m?: string) => never;
  },
  deps?: {
    boot?: () => Promise<{ baseUrl: string; cleanup: () => void; error: string | null }>;
    request?: (baseUrl: string, path: string) => Promise<number | null>;
    requestBody?: (
      baseUrl: string,
      path: string
    ) => Promise<{ status: number | null; body: string }>;
    path?: string;
  }
): Promise<void>;
