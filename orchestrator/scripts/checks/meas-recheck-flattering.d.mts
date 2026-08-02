export declare function evaluateFlattering(
  meta: Record<string, object>,
  prevRules: Array<{ ruleId: string; passed: boolean }> | null
): string[];
export declare function runMeasRecheckFlattering(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  deps?: { prevRules?: Array<{ ruleId: string; passed: boolean }> | null }
): void;
