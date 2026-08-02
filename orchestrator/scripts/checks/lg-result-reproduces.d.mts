export declare function sourceChangesBetween(
  appDir: string,
  from: string,
  to: string
): string[] | null;
export declare function evaluateReproduction(
  result: object,
  recomputed: { score: number; rubricIds: string[] },
  head: string | null,
  sourceDiff?: (from: string, to: string) => string[] | null
): string[];
export declare function runResultReproduces(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  deps?: {
    resultPath?: string;
    head?: string | null;
    recompute?: (
      outcomes: Array<{ ruleId: string; passed: boolean }>,
      na?: string[]
    ) => { score: number; blockers: string[]; rubricIds: string[] };
  }
): void;
