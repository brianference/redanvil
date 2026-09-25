import { jsonResponse } from '../lib/http';

/** Health endpoint — proves the Worker runtime boots (lg-runtime-parity). */
export function onRequest(context: { request: Request }): Response {
  return jsonResponse(context.request, { status: 'ok' }, 200, 'GET', {
    'referrer-policy': 'same-origin'
  });
}
