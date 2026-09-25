/**
 * Types for the PRD role in `prd.mjs`.
 *
 * The role is plain `.mjs` with JSDoc, like every other runner here. The
 * orchestrator's tsconfig sets `noImplicitAny`, so a vitest lane importing it
 * fails typecheck with TS7016 unless a declaration sits beside it -- the same
 * reason `.github/scripts/apps.d.mts` and `meets_the_bar.d.mts` exist. Only the
 * symbols the tests import are declared; this is a companion to the
 * implementation, not a second source of truth for it.
 */

/** One wizard group as read from the live DOM. */
export interface WizardGroup {
  /** The group's visible label, matched against `ANSWER_RULES`. */
  label: string;
  /** Every option the group offers, as rendered. */
  options: string[];
}

/** An answer, as intended and as the control actually holds it. */
export interface RecordedAnswer {
  /** The group's label. */
  group: string;
  /** What the role meant to select. */
  intended: string;
  /** What was read back from the DOM; empty when nothing is selected. */
  actual: string;
}

/**
 * Thrown when the value read back off the control is not the one intended.
 * Recording an intended answer while the document reflects something else is
 * how a Marketplace PRD shipped for an app that is not a marketplace.
 */
export declare class AnswerDidNotTakeError extends Error {
  constructor(group: string, intended: string, actual: string);
  /** The group whose answer did not take. */
  group: string;
  /** The value the role meant to select. */
  intended: string;
  /** The value the control actually holds. */
  actual: string;
}

/**
 * Split a prompt into clauses on sentence boundaries and on `,` / `;`.
 * @param prompt - The app description.
 * @returns Lowercased clauses, empty strings dropped.
 */
export declare function splitClauses(prompt: string): string[];

/**
 * Whether a clause sits under negation scope.
 * @param clause - One clause, already lowercased.
 * @param headingActive - True inside a "what this is NOT:" sentence.
 * @returns True when the clause supplies no positive evidence.
 */
export declare function clauseIsNegated(clause: string, headingActive?: boolean): boolean;

/**
 * Clauses of a prompt with their negation flags.
 * @param prompt - The app description.
 * @returns One entry per clause.
 */
export declare function clausesWithNegation(
  prompt: string
): Array<{ text: string; negated: boolean }>;

/**
 * Whether a rule matches the prompt in a clause that is not negated.
 * @param prompt - The app description.
 * @param test - The rule's pattern.
 * @returns True on a match outside negation scope.
 */
export declare function ruleMatchesPrompt(prompt: string, test: RegExp): boolean;

/**
 * Derive which option(s) a wizard group should take from the prompt.
 * @param group - One wizard group as read from the DOM.
 * @param prompt - The app description.
 * @returns Picks to click, possibly empty.
 */
export declare function derivePicks(group: WizardGroup, prompt: string): string[];

/**
 * Fail closed when the intended answer is not what the control holds.
 * @param group - The group's label.
 * @param intended - The value the role meant to select.
 * @param actual - The value read back from the DOM.
 * @throws AnswerDidNotTakeError when the two differ.
 */
export declare function assertAnswerTook(group: string, intended: string, actual: string): void;

/** Intent block stored beside the PRD so a later step can see what was asked. */
export interface PrdIntentMeta {
  /** Normalised intent fields. */
  intent: Record<string, unknown>;
  /** `claude` or `regex-fallback`. Never `grok`: PRD intent runs on Claude only. */
  intentSource: 'claude' | 'regex-fallback';
  /** Milliseconds spent in the claude attempts. */
  intentDurationMs: number;
  /** Why the regex fallback was used, when it was. */
  fallbackReason?: string;
}

/**
 * Write `PRD.md`, `prd-provenance.json`, and `intent.json` when `meta` is set.
 * Refuses a stub and an answer that did not take.
 * @param docsDir - The app's `docs` directory.
 * @param markdown - The generated PRD body.
 * @param prompt - The app description the PRD derives from.
 * @param answers - Recorded answers, intended and actual.
 * @param source - The builder URL the document came from.
 * @param meta - Intent record. Absent when the caller is not the role.
 */
export declare function writePrdArtifacts(
  docsDir: string,
  markdown: string,
  prompt: string,
  answers: RecordedAnswer[],
  source: string,
  meta?: PrdIntentMeta
): void;

/**
 * Picks for one wizard group taken from a typed intent.
 * @param group - One wizard group as read from the DOM.
 * @param intent - Extracted intent.
 * @returns Picks to click, possibly empty.
 */
export declare function picksFromIntent(
  group: WizardGroup,
  intent: {
    appType?: string;
    hasAuth?: boolean;
    dataStorage?: string;
    hasRealtime?: boolean;
    integrations?: string[];
  }
): string[];

/**
 * Intent first, regex only when the page does not offer the intent's option.
 * @param group - One wizard group.
 * @param prompt - The app description.
 * @param intent - Extracted intent, or null to use the regex only.
 * @returns Picks to click.
 */
export declare function picksForGroup(
  group: WizardGroup,
  prompt: string,
  intent?: {
    appType?: string;
    hasAuth?: boolean;
    dataStorage?: string;
    hasRealtime?: boolean;
    integrations?: string[];
  } | null
): string[];

/**
 * `fidelity` from a yaml fence or a `---` frontmatter block.
 * @param markdown - Generated PRD body.
 * @returns Whether the key is present, its value, and the unmatched list.
 */
export declare function readFidelity(markdown: string): {
  present: boolean;
  fidelity: string;
  unmatched: string[];
};

/**
 * The `json claims` fence, verbatim, or absent / invalid.
 * @param markdown - Generated PRD body.
 */
export declare function extractClaimsBlock(markdown: string):
  | { status: 'absent' }
  | { status: 'invalid'; reason: string; verbatim: string }
  | { status: 'ok'; verbatim: string; parsed: Record<string, unknown> };

/**
 * Refuse `fidelity: fail`, copy a valid claims block, warn when either is missing.
 * @param markdown - Generated PRD body.
 * @param opts - Where to write the alert and the claims file.
 * @returns Process exit code. Non-zero refuses the build.
 */
export declare function settleGeneratedPrd(
  markdown: string,
  opts: { repoRoot: string; slug: string; warn?: (message: string) => void; appDir?: string }
): { exitCode: number; warnings: string[]; message: string };

/**
 * Decode a base64 prompt. Base64 crosses two shells byte-for-byte, which plain
 * argv does not.
 * @param value - The base64 payload.
 * @returns The decoded prompt.
 */
export declare function decodePromptB64(value: string): string;

/**
 * Parse `--key=value` arguments.
 * @param argv - Raw process arguments.
 * @returns Parsed flags.
 */
export declare function parseArgs(argv: string[]): Record<string, string>;

/** The per-group answer rules, most specific signal first. */
export declare const ANSWER_RULES: Array<{
  group: RegExp;
  rules: Array<{ option: string; test: RegExp }>;
  fallback: string;
}>;

/** Integration chips, each picked only when the prompt names it. */
export declare const INTEGRATION_RULES: Array<{ option: string; test: RegExp }>;

/**
 * Normalise a caller-supplied entity list: trims, dedupes case-insensitively,
 * caps the count, and REJECTS pronoun-headed phrases and anything carrying
 * characters a shell would treat as syntax.
 * @param raw - Comma-separated entity names.
 * @returns The cleaned list, or an empty string when nothing survives.
 */
export declare function sanitiseEntities(raw: string): string;
