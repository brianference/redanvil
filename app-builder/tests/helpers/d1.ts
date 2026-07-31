import { expect } from 'vitest';
import type { D1PreparedStatement, Env } from '../../functions/lib/env';

/** Options for {@link mockEnv}. */
export interface MockD1Options {
  /**
   * When true, both `run` and `all` reject with a D1 outage error.
   * @default false
   */
  fail?: boolean;
  /**
   * Rows returned by `all` when not failing.
   * @default []
   */
  results?: unknown[];
}

/**
 * Minimal in-memory D1 Env mock for Pages Function unit tests.
 *
 * @param options - Failure mode and rows for `all`.
 * @returns Env with a DB.prepare that returns a chainable prepared statement.
 */
export function mockEnv(options: MockD1Options = {}): Env {
  const fail = options.fail === true;
  const results = options.results ?? [];
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    run: () =>
      fail ? Promise.reject(new Error('D1 unavailable')) : Promise.resolve({}),
    all: () =>
      fail
        ? Promise.reject(new Error('D1 unavailable'))
        : Promise.resolve({ results })
  };
  return { DB: { prepare: () => stmt } };
}

/** Options for {@link expectSecureHeaders}. */
export interface ExpectSecureHeadersOptions {
  /**
   * Value expected for `access-control-allow-methods`.
   * @default 'GET'
   */
  methods?: string;
  /**
   * When set, assert `access-control-allow-headers` equals this value.
   */
  allowHeaders?: string;
}

/**
 * Assert secure headers produced by the shared jsonResponse helper.
 *
 * @param response - Fetch Response under test.
 * @param requestUrl - Request URL used to derive the expected CORS origin.
 * @param methodsOrOptions - CORS allow-methods string, or a full options object.
 */
export function expectSecureHeaders(
  response: Response,
  requestUrl: string,
  methodsOrOptions: string | ExpectSecureHeadersOptions = 'GET'
): void {
  const options: ExpectSecureHeadersOptions =
    typeof methodsOrOptions === 'string'
      ? { methods: methodsOrOptions }
      : methodsOrOptions;
  const methods = options.methods ?? 'GET';
  const origin = new URL(requestUrl).origin;
  expect(response.headers.get('content-type')).toBe('application/json');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  expect(response.headers.get('access-control-allow-origin')).not.toBe('*');
  expect(response.headers.get('access-control-allow-methods')).toBe(methods);
  if (options.allowHeaders !== undefined) {
    expect(response.headers.get('access-control-allow-headers')).toBe(
      options.allowHeaders
    );
  }
}
