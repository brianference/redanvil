export declare const MIN_OPTIONS: number;
export declare const UNWRITTEN_MARKERS: RegExp[];
export declare function resolveOptionsDir(appDir: string): string | null;
export declare function resolveDecisionPath(
  appDir: string,
  optionsDir: string | null
): string | null;
export declare function listOptionArtifacts(optionsDir: string): string[];
export declare function findUnwrittenMarker(doc: string): string | null;
export declare function evaluateDecisionDoc(doc: string): {
  ok: boolean;
  failures: string[];
};
export declare function evaluateDesignOptions(appDir: string): {
  status: 'pass' | 'fail' | 'na';
  messages: string[];
  artifacts?: string[];
};
export declare function runDesignOptions(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never }
): void;
