export interface ClaimTopic {
  id: string;
  label: string;
  denyRes: RegExp[];
  discloseRes: RegExp[];
  codeRes: RegExp[];
}
export declare const TOPICS: ClaimTopic[];
export declare function compareTopic(
  topic: ClaimTopic,
  legalText: string,
  codeFiles: Array<{ path: string; text: string }>
): string | null;
export declare function runLegalClaimsTrue(
  appDir: string,
  io: { pass: () => never; fail: (m?: string) => never; notApplicable: (w?: string) => never }
): void;
