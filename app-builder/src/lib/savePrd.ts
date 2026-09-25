import { z } from 'zod';
import type { Prd } from './prd';
import { failureMessage, fetchJson, type FailureMessages, type FetchJsonFailure } from './fetchJson';

/** Successful save response from POST /api/prds. */
const saveResultSchema = z.object({ id: z.string(), url: z.string() });

/** Successful save response from POST /api/prds. */
export type SavePrdResult = z.infer<typeof saveResultSchema>;

/**
 * Typed error thrown when saving a PRD fails (network, timeout, or non-200).
 */
export class SavePrdError extends Error {
  readonly status: number | undefined;

  /**
   * @param message - Human-readable failure reason
   * @param status - HTTP status when the server responded, else undefined
   */
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SavePrdError';
    this.status = status;
  }
}

/**
 * Narrow an unknown JSON body to a SavePrdResult, or null if shape is wrong.
 *
 * @param payload - JSON from POST /api/prds.
 * @returns The saved id and url, or null.
 */
function parseSaveResult(payload: unknown): SavePrdResult | null {
  const parsed = saveResultSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** How a failed save is worded. */
const SAVE_FAILURE_MESSAGES: FailureMessages = {
  invalidJson: 'Invalid response from server',
  invalidPayload: 'Invalid save payload from server',
  timeout: 'Request timed out',
  network: 'Network error saving PRD',
  http: (httpStatus) => `Save failed (${httpStatus})`
};

/**
 * The error a failed save surfaces, carrying the HTTP status when the server answered.
 *
 * @param failure - Why the request produced no result.
 * @returns The error to throw.
 */
function saveError(failure: FetchJsonFailure): SavePrdError {
  const httpStatus = 'httpStatus' in failure ? failure.httpStatus : undefined;
  return new SavePrdError(failureMessage(failure, SAVE_FAILURE_MESSAGES), httpStatus);
}

/**
 * POST a generated PRD to /api/prds with the shared request timeout.
 * Returns { id, url } on 200; throws SavePrdError otherwise (fail closed).
 *
 * @param prd - The generated PRD.
 * @returns The saved id and url.
 * @throws SavePrdError on any failure.
 */
export async function savePrd(prd: Prd): Promise<SavePrdResult> {
  const result = await fetchJson('/api/prds', parseSaveResult, {
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: prd.slug,
        title: prd.title,
        prompt: prd.prompt,
        markdown: prd.markdown
      })
    }
  });
  if (result.ok) return result.data;
  throw saveError(result);
}
