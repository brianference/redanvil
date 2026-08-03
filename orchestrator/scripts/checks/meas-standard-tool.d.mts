export declare function evaluateStandardTool(
  meta: Record<string, object>,
  axeRules?: string[],
  // Root that cited report paths resolve against. Tests pass a fixture root, so
  // omitting it here made every three-argument call a tsc error while the
  // implementation had accepted it since the parameter was added.
  repoRoot?: string
): string[];
export declare function runMeasStandardTool(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  deps?: { axeRules?: string[] }
): void;
