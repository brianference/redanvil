export declare function evaluateStandardTool(
  meta: Record<string, object>,
  axeRules?: string[]
): string[];
export declare function runMeasStandardTool(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  deps?: { axeRules?: string[] }
): void;
