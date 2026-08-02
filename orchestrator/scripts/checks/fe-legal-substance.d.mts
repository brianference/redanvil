export declare const MIN_WORDS: number;
export declare const MIN_H2: number;
export declare const TERMS_TOPICS: ReadonlyArray<readonly [string, RegExp[]]>;
export declare const PRIVACY_TOPICS: ReadonlyArray<readonly [string, RegExp[]]>;
export declare function stripToText(html: string): string;
export declare function countWords(text: string): number;
export declare function countH2(html: string): number;
export declare function corpusForTopics(html: string): string;
export declare function missingTopics(
  corpus: string,
  topics: ReadonlyArray<readonly [string, RegExp[]]>
): string[];
export declare function evaluateLegalPage(
  html: string,
  kind: 'terms' | 'privacy'
): {
  ok: boolean;
  words: number;
  h2: number;
  missing: string[];
  failures: string[];
};
export declare function findLegalSources(appDir: string): {
  terms: string | null;
  privacy: string | null;
  termsPath?: string;
  privacyPath?: string;
};
export declare function loadFixtureDir(dir: string): {
  terms: string | null;
  privacy: string | null;
};
export declare function evaluateLegalSubstance(pages: {
  terms: string | null;
  privacy: string | null;
}): { ok: boolean; failures: string[]; summary: string };
export declare function runLegalSubstance(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra?: (m?: string) => never;
  },
  opts?: { fixtureDir?: string | null; url?: string | null }
): Promise<void>;
export declare function serveStatic(root: string): Promise<{
  base: string;
  close: () => Promise<void>;
}>;
export declare function measureRenderedLegalPage(
  page: import('playwright').Page,
  base: string,
  kind: 'terms' | 'privacy'
): Promise<{
  ok: boolean;
  words: number;
  h2: number;
  missing: string[];
  failures: string[];
}>;
