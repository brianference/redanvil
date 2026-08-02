export declare function collectHeadCorpus(appDir: string): string;
export declare function extractJsonLdBlocks(corpus: string): string[];
export declare function validateJsonLdBlock(raw: string): {
  ok: boolean;
  why?: string;
  type?: string;
};
export declare function extractCanonicalHrefs(corpus: string): string[];
export declare function isAbsoluteHttpUrl(href: string): boolean;
export declare function evaluateStructuredData(corpus: string): {
  ok: boolean;
  failures: string[];
  jsonLdType?: string;
  canonical?: string;
};
export declare function runStructuredData(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never },
  opts?: { fixture?: string | null }
): void;
