export declare function readDeployUrl(appDir: string): string | null;
export declare function readWranglerProjectName(appDir: string): string | null;
export declare function resolveProductionUrl(appDir: string): string | null;
export declare function isGitHubRemote(url: string): boolean;
export declare function resolveRepoRoot(appDir: string): string;
export declare function slugFromAppDir(appDir: string): string;
export declare function requireGateResultMeetsBar(
  appDir: string,
  io: { fail: (msg?: string) => void }
): void;
export declare function newestLocalIndexAsset(appDir: string): string | null;
export declare function extractDeployedIndexAsset(html: string): string | null;
export declare function runLgShipped(
  appDir: string,
  io: {
    pass: () => never;
    fail: (msg?: string) => never;
    notApplicable: (why?: string) => never;
    infra: (msg?: string) => never;
  }
): Promise<void>;
