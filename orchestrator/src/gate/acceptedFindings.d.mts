export declare function isWildcardToken(value: unknown): boolean;
export declare function findingIdentity(finding: {
  title?: unknown;
  citation?: unknown;
}): string | null;
export declare function isBlanketAcceptedFinding(entry: Record<string, unknown>): boolean;

export interface AcceptedFinding {
  app: string;
  title: string;
  citation: string;
  commit: string;
  since: string;
  reason: string;
  fixedBy?: string;
}

export declare function loadAcceptedFindings(
  repoRoot: string,
  slug?: string
): AcceptedFinding[];

export declare function findingIsAccepted(
  finding: { title: string; citation: string; passed?: boolean },
  accepted: ReadonlyArray<AcceptedFinding>,
  app: string,
  reviewedCommit: string
): boolean;

export declare function allFailingFindingsAccepted(
  report: { findings?: unknown; commit?: unknown; slug?: unknown },
  accepted: ReadonlyArray<AcceptedFinding>,
  app: string
): boolean;

export declare function listAcceptedFailingFindings(
  report: { findings?: unknown; commit?: unknown },
  accepted: ReadonlyArray<AcceptedFinding>,
  app: string
): Array<{
  title: string;
  citation: string;
  reason: string;
  since?: string;
  fixedBy?: string;
}>;
