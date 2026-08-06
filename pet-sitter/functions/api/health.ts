import { json, optionsResponse } from '../lib/http';

/** Health endpoint — proves the Worker runtime boots. */
export function onRequestGet(context: { request: Request }): Response {
  return json(context.request, { status: 'ok' });
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
