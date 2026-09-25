import { FETCH_TIMEOUT_MS, isAbortError } from './abortableEffect';
import { messageFromPayload } from './apiError';

/**
 * Why a JSON request did not produce a parsed value. Each caller words these
 * for its own screen, so the kinds stay distinct instead of collapsing into
 * one message here.
 */
export type FetchJsonFailure =
  /** The request outlived its timeout. */
  | { kind: 'timeout' }
  /** The caller's own signal aborted it (a superseded effect). Never user-visible. */
  | { kind: 'aborted' }
  /** No response at all. */
  | { kind: 'network' }
  /** A response whose body is not JSON. */
  | { kind: 'invalid-json'; httpStatus: number }
  /** A non-2xx response; `payload` may carry the server's `error` text. */
  | { kind: 'http'; httpStatus: number; payload: unknown }
  /** A 2xx response whose JSON is not the expected shape. */
  | { kind: 'invalid-payload'; httpStatus: number };

/** A parsed value, or the reason there is none. */
export type FetchJsonResult<T> = { ok: true; data: T } | ({ ok: false } & FetchJsonFailure);

export interface FetchJsonOptions {
  /** Method, headers and body. */
  init?: Omit<RequestInit, 'signal'>;
  /** The caller's abort signal, for effect cleanup. */
  signal?: AbortSignal;
  /** Milliseconds before the request is abandoned as a timeout. */
  timeoutMs?: number;
}

/**
 * One JSON request with a timeout, failing closed at every step: no response,
 * a non-JSON body, a non-2xx status and a payload `parse` rejects all come back
 * as a typed failure, never as data.
 *
 * @param url - Request URL.
 * @param parse - Fail-closed mapper; null means the payload is the wrong shape.
 * @param options - Request init, caller signal and timeout.
 * @returns The parsed value, or why there is none.
 */
export async function fetchJson<T>(
  url: string,
  parse: (payload: unknown) => T | null,
  options: FetchJsonOptions = {}
): Promise<FetchJsonResult<T>> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? FETCH_TIMEOUT_MS);
  const abortFromCaller = (): void => {
    controller.abort();
  };
  options.signal?.addEventListener('abort', abortFromCaller);
  if (options.signal?.aborted === true) controller.abort();

  try {
    const response = await fetch(url, { ...options.init, signal: controller.signal });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error: unknown) {
      if (isAbortError(error)) throw error;
      return { ok: false, kind: 'invalid-json', httpStatus: response.status };
    }
    if (!response.ok) {
      return { ok: false, kind: 'http', httpStatus: response.status, payload };
    }
    const data = parse(payload);
    if (data === null) return { ok: false, kind: 'invalid-payload', httpStatus: response.status };
    return { ok: true, data };
  } catch (error: unknown) {
    if (!isAbortError(error)) return { ok: false, kind: 'network' };
    return { ok: false, kind: timedOut ? 'timeout' : 'aborted' };
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

/** A screen's wording for each way a request can fail. */
export interface FailureMessages {
  /** The body was not JSON. */
  invalidJson: string;
  /** The JSON was not the expected shape. */
  invalidPayload: string;
  /** The request timed out. */
  timeout: string;
  /** No response, or the request was cut off. */
  network: string;
  /** Fallback for a non-2xx whose body carries no `error` text. */
  http: (httpStatus: number) => string;
}

/**
 * The user-facing message for a failed request: the server's own `error`
 * text for a non-2xx when it sent one, otherwise the screen's wording.
 *
 * @param failure - How the request failed.
 * @param messages - The screen's wording.
 * @returns Message to show.
 */
export function failureMessage(failure: FetchJsonFailure, messages: FailureMessages): string {
  switch (failure.kind) {
    case 'http':
      return messageFromPayload(failure.payload, messages.http(failure.httpStatus));
    case 'invalid-json':
      return messages.invalidJson;
    case 'invalid-payload':
      return messages.invalidPayload;
    case 'timeout':
      return messages.timeout;
    case 'aborted':
    case 'network':
      return messages.network;
  }
}
