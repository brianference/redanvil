import { z } from 'zod';
import type { Prd } from './prd';
import { messageFromPayload } from './apiError';
import { fetchJson, type FetchJsonFailure } from './fetchJson';

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

/**
 * The error a failed save surfaces. savePrd passes no abort signal of its own,
 * so an abort can only be the timeout.
 *
 * @param failure - Why the request produced no result.
 * @returns The error to throw.
 */
function saveError(failure: FetchJsonFailure): SavePrdError {
  switch (failure.kind) {
    case 'http':
      return new SavePrdError(
        messageFromPayload(failure.payload, `Save failed (${failure.httpStatus})`),
        failure.httpStatus
      );
    case 'invalid-json':
      return new SavePrdError('Invalid response from server', failure.httpStatus);
    case 'invalid-payload':
      return new SavePrdError('Invalid save payload from server', failure.httpStatus);
    case 'timeout':
    case 'aborted':
      return new SavePrdError('Request timed out');
    case 'network':
      return new SavePrdError('Network error saving PRD');
  }
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
