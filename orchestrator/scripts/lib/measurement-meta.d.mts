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
export declare function runsAgree(runs: ReadonlyArray<{ ok?: boolean }> | undefined): boolean;
export declare function fileMtimeMs(file: string): number | null;
export declare function nowIso(): string;
