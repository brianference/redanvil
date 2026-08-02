export declare function evaluateKnownBad(
  meta: Record<string, object>,
  requiredRuleIds: string[],
  implMtimeMs: (id: string) => number | null,
  rerun?: (id: string, input: string) => number
): string[];
export declare function runMeasKnownBad(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  deps?: { required?: string[]; rerun?: boolean }
): void;
