/**
 * Classify a headless `claude -p --output-format json` result.
 *
 * Ported from `n8n-prototype/loki/overnight.mjs` `classifyClaude`. Not imported
 * from that file: the night script is a different runtime, and this copy is
 * the one the independent judge calls. Fields are the real envelope:
 * `is_error`, `api_error_status`, `permission_denials`, `total_cost_usd`,
 * `subtype`.
 */

/** What a spawn of `claude` handed back. */
export interface ClaudeSpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Whether that spawn was a usable review, a rate limit, or a hard failure. */
export interface ClaudeClassification {
  ok: boolean;
  rateLimited: boolean;
  costUsd: number;
  detail: string;
}

/**
 * Classify an agent invocation from its structured envelope.
 *
 * 429 and 529 are "wait" (rate limit / overloaded), not a review that failed.
 * With no envelope, the text fallback is broad on purpose: missing a rate
 * limit costs the iteration, a false positive fails one call closed.
 *
 * @param res - Spawn result. `status` null means the process never exited.
 * @returns Whether the call succeeded, whether it was rate-limited, and cost.
 */
export function classifyClaude(res: ClaudeSpawnResult): ClaudeClassification {
  const combined = `${res.stdout}\n${res.stderr}`;
  let envelope: {
    is_error?: unknown;
    api_error_status?: unknown;
    permission_denials?: unknown;
    total_cost_usd?: unknown;
    subtype?: unknown;
  } | null = null;
  try {
    envelope = JSON.parse(res.stdout) as {
      is_error?: unknown;
      api_error_status?: unknown;
      permission_denials?: unknown;
      total_cost_usd?: unknown;
      subtype?: unknown;
    };
  } catch {
    // Not JSON: the process died before it could emit an envelope at all.
  }

  if (envelope) {
    const apiStatus = envelope.api_error_status;
    // 429 is the rate limit; 529 is overloaded. Both mean "wait", not "fail".
    const rateLimited = apiStatus === 429 || apiStatus === 529;
    const denials = Array.isArray(envelope.permission_denials)
      ? envelope.permission_denials.length
      : 0;
    return {
      ok: envelope.is_error !== true,
      rateLimited,
      costUsd: Number(envelope.total_cost_usd ?? 0),
      detail: `subtype=${String(envelope.subtype)} api_error_status=${apiStatus ?? 'none'} permission_denials=${denials}`
    };
  }

  const rateLimited = /rate.?limit|usage limit|429|too many requests|quota|overloaded/i.test(
    combined
  );
  return {
    ok: res.status === 0,
    rateLimited,
    costUsd: 0,
    detail: `no json envelope; exit ${res.status}`
  };
}

/**
 * True when Claude did not produce a review.
 *
 * Unavailable (no process, timeout, missing binary), a rate limit, and an
 * `is_error` envelope all count. The caller fails closed on true (UNVERIFIED);
 * there is no second engine to try. A completed Claude answer that is merely
 * unparseable is NOT this: that is a bad review, handled by the parser.
 *
 * FAIL INPUT: `{status: 0, stdout: '{"is_error":true,"result":"{}"}'}` must
 * return true, or a clean-looking body inside an error envelope passes.
 *
 * @param res - Spawn result, plus the caller's unavailable flag.
 * @returns Whether Claude failed to produce a review.
 */
export function claudeDidNotReview(res: ClaudeSpawnResult & { unavailable?: boolean }): boolean {
  if (res.unavailable === true) return true;
  if (res.status === null) return true;
  // An error envelope (is_error: true -- an auth failure, an API error) is not
  // a review. Parsing its text as judge output could read a clean JSON result
  // inside it as a pass.
  return classifyClaude(res).rateLimited || isErrorEnvelope(res.stdout);
}

/**
 * True when stdout is Claude's JSON envelope with `is_error: true`.
 *
 * @param stdout - Raw stdout of `claude -p --output-format json`.
 * @returns Whether the envelope reports an error.
 */
export function isErrorEnvelope(stdout: string): boolean {
  try {
    const parsed: unknown = JSON.parse(stdout.trim());
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      (parsed as { is_error?: unknown }).is_error === true
    );
  } catch {
    return false;
  }
}
