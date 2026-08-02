export declare function readBuildScript(appDir: string): string | null;
export declare function runNpmBuild(appDir: string): {
  ok: boolean;
  status: number | null;
  output: string;
};
export declare function runBuildSucceeds(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  deps?: { runBuild?: typeof runNpmBuild }
): void;
