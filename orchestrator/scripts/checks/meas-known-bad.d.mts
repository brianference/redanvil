export declare function evaluateKnownBad(
  meta: Record<string, object>,
  requiredRuleIds: string[],
  implMtimeMs: (id: string) => number | null,
  rerun?: (id: string, resolvedInput: string) => number,
  resolveInput?: (input: string) => string | null
): string[];
export declare function resolveKnownBadInput(appDir: string, input: string): string | null;
export declare function runMeasKnownBad(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  deps?: { required?: string[]; rerun?: boolean }
): void;
