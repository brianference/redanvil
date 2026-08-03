export declare function resolveEvidenceFile(appDir: string, name: string): string | null;
export declare function qaVisualOk(appDir: string, slug: string): boolean;
export declare function userRefuseOk(appDir: string, slug: string): boolean;
export declare function independentReviewOk(appDir: string, slug: string): boolean;
export declare function coveragePct(appDir: string, slug: string): number | null;
export declare function coverageHighWater(appDir: string): number | undefined;
export declare function loadProductJudgement(
  appDir: string,
  slug: string
): {
  qaVisualOk: boolean;
  userRefuseOk: boolean;
  independentReviewOk: boolean;
  coveragePct: number | null;
  coverageHighWater?: number;
};
