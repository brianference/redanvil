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

/**
 * Write `PRD.md` and `prd-provenance.json`, refusing a stub.
 * @param docsDir - The app's `docs` directory.
 * @param markdown - The generated PRD body.
 * @param prompt - The app description the PRD derives from.
 * @param answers - Recorded answers, intended and actual.
 * @param source - The builder URL the document came from.
 */
export declare function writePrdArtifacts(
  docsDir: string,
  markdown: string,
  prompt: string,
  answers: RecordedAnswer[],
  source: string
): void;

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
