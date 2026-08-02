export declare function looksLikeSpaShell(body: string): boolean;
export declare function evaluateSpaMask(status: number | null, body: string): string | null;
export declare function runApiNoSpaMask(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra?: (m?: string) => never;
  },
  deps?: {
    boot?: () => Promise<{ baseUrl: string; cleanup: () => void; error: string | null }>;
    request?: (
      baseUrl: string,
      path: string
    ) => Promise<{ status: number | null; body: string }>;
    path?: string;
  }
): Promise<void>;
