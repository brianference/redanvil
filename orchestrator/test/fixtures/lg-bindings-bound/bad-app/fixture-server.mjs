#!/usr/bin/env node
/**
 * fixture-server.mjs — real local HTTP server for the lg-bindings-bound
 * known-bad fixture.
 *
 * The check (lg-bindings-bound.mjs) probes a live URL with `fetch` and
 * classifies the response. A canned string swapped in for the network call
 * would not prove the check can fail against a REAL response — this starts
 * an actual TCP listener that answers every request with the same 503 body
 * a Cloudflare Pages Function emits when its `AI` binding is unconfigured,
 * so the check's own detectMissingBinding() logic runs against genuine
 * request/response bytes.
 *
 * The check's CLI entry (see lg-bindings-bound.mjs) looks for this file next
 * to the app directory it is given and, when found and no --url was passed,
 * imports it, calls start(), and probes the returned URL. No real app ever
 * carries a fixture-server.mjs, so this never activates outside a known-bad
 * rerun.
 */
import { createServer } from 'node:http';

/**
 * Start the fixture server on an ephemeral localhost port.
 *
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function start() {
  const server = createServer((_req, res) => {
    res.writeHead(503, { 'content-type': 'text/plain' });
    res.end('AI binding unavailable');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}
