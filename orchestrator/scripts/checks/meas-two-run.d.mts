export declare function evaluateTwoRun(
  meta: Record<string, object>,
  browserRules?: string[]
): string[];
export declare function runMeasTwoRun(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  deps?: { browserRules?: string[] }
): void;
