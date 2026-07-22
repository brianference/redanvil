import type { Prd } from './prd';

/** Successful save response from POST /api/prds. */
export interface SavePrdResult {
  id: string;
  url: string;
}

const SAVE_TIMEOUT_MS = 10_000;

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
 */
function parseSaveResult(payload: unknown): SavePrdResult | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    'url' in payload &&
    typeof (payload as { id: unknown }).id === 'string' &&
    typeof (payload as { url: unknown }).url === 'string'
  ) {
    return {
      id: (payload as { id: string }).id,
      url: (payload as { url: string }).url
    };
  }
  return null;
}

/**
 * POST a generated PRD to /api/prds with a ~10s AbortController timeout.
 * Returns { id, url } on 200; throws SavePrdError otherwise (fail closed).
 */
export async function savePrd(prd: Prd): Promise<SavePrdResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, SAVE_TIMEOUT_MS);

  try {
    const response = await fetch('/api/prds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: prd.slug,
        title: prd.title,
        prompt: prd.prompt,
        markdown: prd.markdown
      }),
      signal: controller.signal
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SavePrdError('Invalid response from server', response.status);
    }

    if (!response.ok) {
      const message =
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof (payload as { error: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `Save failed (${response.status})`;
      throw new SavePrdError(message, response.status);
    }

    const result = parseSaveResult(payload);
    if (result === null) {
      throw new SavePrdError('Invalid save payload from server', response.status);
    }

    return result;
  } catch (error: unknown) {
    if (error instanceof SavePrdError) {
      throw error;
    }
    const timedOut =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError');
    throw new SavePrdError(timedOut ? 'Request timed out' : 'Network error saving PRD');
  } finally {
    clearTimeout(timeoutId);
  }
}
