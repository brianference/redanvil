export declare const META_REL: string;
export declare const BROWSER_DRIVEN_RULES: readonly string[];
export declare const RULES_REQUIRING_KNOWN_BAD: readonly string[];
export declare const AXE_REQUIRED_RULES: readonly string[];
export declare function metaPath(appDir: string): string;
export declare function readMeasurementMeta(appDir: string): Record<string, object>;
export declare function writeMeasurementMetaEntry(
  appDir: string,
  ruleId: string,
  entry: object
): Record<string, object>;
export declare function isNotApplicableMeta(entry: object | undefined | null): boolean;
export declare function notApplicableMetaFields(opts: {
  tool: string;
  engine?: string | null;
  reason: string;
  knownBad?: { input: string; failed: boolean; recordedAt?: string };
}): object;
export declare function writeNotApplicableMeta(
  appDir: string,
  ruleId: string,
  opts: {
    tool: string;
    engine?: string | null;
    reason: string;
    knownBad?: { input: string; failed: boolean; recordedAt?: string };
  }
): Record<string, object>;
export declare function runsAgree(runs: ReadonlyArray<{ ok?: boolean }> | undefined): boolean;
export declare function runsAreDuplicate(runs: ReadonlyArray<unknown> | undefined): boolean;
export declare function fileMtimeMs(file: string): number | null;
export declare function nowIso(): string;
