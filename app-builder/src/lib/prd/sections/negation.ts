/**
 * Clause-scoped negation, ported from `n8n-prototype/roles/prd.mjs`.
 *
 * A match inside a negated clause is not evidence. The heading form
 * "What this is NOT:" negates that sentence's remaining clauses too.
 */

/** One clause of a prompt, with its span in the lowercased text. */
export interface PromptClause {
  /** Clause text, already lowercased. */
  text: string;
  /** True when the clause supplies no positive evidence. */
  negated: boolean;
  /** Index of `text` in the lowercased prompt. */
  start: number;
  /** Exclusive end index in the lowercased prompt. */
  end: number;
}

/**
 * Whether a clause is under negation scope.
 *
 * Matches any `not`, the n't contractions, `never`, `no`, `rather than`,
 * `instead of`, `without` and `optional` ("works without a login", "login not
 * required" and "sign-in is optional" must not switch sign-in on), plus the "What this is NOT:"
 * heading form (the heading itself and every remaining clause of that
 * sentence, via `headingActive`).
 *
 * @param clause - One clause, already lowercased.
 * @param headingActive - True when this sentence opened with the NOT heading.
 * @returns True when the clause is negated.
 */
export function clauseIsNegated(clause: string, headingActive = false): boolean {
  if (headingActive) return true;
  return /(?:\bnot\b|\b(?:isn't|aren't|wasn't|weren't|don't|doesn't|didn't|never)\b|\brather than\b|\binstead of\b|\bno\b|\bwithout\b|\boptional\b)/.test(
    clause
  );
}

/**
 * Clauses of a prompt with negation flags and source offsets.
 *
 * A sentence containing `what this is not:` has every clause in that sentence
 * marked negated. Other sentences are flagged per clause.
 *
 * @param prompt - Raw prompt.
 * @returns One entry per clause, in order.
 */
export function clausesWithNegation(prompt: string): PromptClause[] {
  const lower = String(prompt).toLowerCase();
  const out: PromptClause[] = [];
  const sentenceRe = /[^.!?]+(?:[.!?]+|$)/g;
  for (const sentenceMatch of lower.matchAll(sentenceRe)) {
    const sentence = sentenceMatch[0] ?? '';
    const sentenceStart = sentenceMatch.index ?? 0;
    const trimmed = sentence.trim();
    if (trimmed.length === 0) continue;
    const headingActive = /what this is not\s*:/.test(trimmed);
    const partRe = /[^,;]+/g;
    for (const part of sentence.matchAll(partRe)) {
      const raw = part[0] ?? '';
      const text = raw.trim();
      if (text.length === 0) continue;
      const lead = raw.indexOf(text);
      const start = sentenceStart + (part.index ?? 0) + Math.max(0, lead);
      out.push({
        text,
        negated: clauseIsNegated(text, headingActive),
        start,
        end: start + text.length
      });
    }
  }
  return out;
}
