export declare function evaluateEngineNamed(
  meta: Record<string, object>,
  browserRules?: string[]
): string[];
export declare function runMeasEngineNamed(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  deps?: { browserRules?: string[] }
): void;
