import { describe, it, expect } from 'vitest';
import { onRequestGet, onRequestPost } from './status';
import { expectSecureHeaders } from '../../../../tests/helpers/d1';
import { createQueueEnv, readQueueJobs } from '../../../../tests/helpers/jobQueueDb';

/** A job id in the UUID shape submit issues. */
const JOB_ID = '5b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

/** Well-formed, but no job has it. */
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

/** Fake runner secret. Injected in-process; not a real credential. */
const TOKEN = 'runner-test-token';

/** Prompt that must never appear on the public status response. */
const SECRET_PROMPT = 'super-secret-prompt-do-not-leak';

/**
 * Env with one building job whose prompt must stay off the public route.
 *
 * @param token - Runner token, or omit to leave RUNNER_TOKEN unset.
 * @param id - Stored job id. A malformed one proves validation runs before the query.
 * @returns Queue env.
 */
function envWithJob(token?: string, id = JOB_ID) {
  return createQueueEnv({
    ...(token !== undefined ? { runnerToken: token } : {}),
    jobs: [
      {
        id,
        slug: 'recipe-box',
        prompt: SECRET_PROMPT,
        created_at: '2026-01-01T00:00:00.000Z',
        status: 'building',
        step: 'install-deps',
        detail: 'Installing packages',
        deploy_url: null,
        updated_at: '2026-01-01T00:05:00.000Z',
        entities: 'Recipe'
      }
    ]
  });
}

/**
 * Request for /api/jobs/:id/status.
 *
 * @param method - HTTP method.
 * @param body - JSON body for POST. Ignored for GET.
 * @param token - Bearer token, or null to omit it.
 * @param id - Path id.
 * @returns The request.
 */
function statusRequest(
  method: 'GET' | 'POST',
  body: unknown,
  token: string | null,
  id = JOB_ID
): Request {
  const headers = new Headers();
  if (token !== null) headers.set('authorization', `Bearer ${token}`);
  if (method === 'POST') headers.set('content-type', 'application/json');
  return new Request(`https://example.com/api/jobs/${id}/status`, {
    method,
    headers,
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {})
  });
}

describe('GET /api/jobs/:id/status', () => {
  it('is public and does not return the prompt', async () => {
    const request = statusRequest('GET', null, null);
    const response = await onRequestGet({
      request,
      env: envWithJob(),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      id: JOB_ID,
      status: 'building',
      step: 'install-deps',
      detail: 'Installing packages',
      updatedAt: '2026-01-01T00:05:00.000Z',
      deployUrl: null
    });
    expect(body).not.toHaveProperty('prompt');
    expect(JSON.stringify(body)).not.toContain(SECRET_PROMPT);
    expectSecureHeaders(response, request.url, 'GET, POST');
  });

  it('returns 404 for an unknown id', async () => {
    const request = statusRequest('GET', null, null, MISSING_ID);
    const response = await onRequestGet({
      request,
      env: envWithJob(),
      params: { id: MISSING_ID }
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Job not found' });
  });
});

describe('POST /api/jobs/:id/status auth', () => {
  it('returns 503 when RUNNER_TOKEN is unset', async () => {
    const request = statusRequest('POST', { status: 'building' }, TOKEN);
    const response = await onRequestPost({
      request,
      env: envWithJob(),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'runner not configured' });
  });

  it('returns 401 when the bearer token is missing', async () => {
    const request = statusRequest('POST', { status: 'building' }, null);
    const response = await onRequestPost({
      request,
      env: envWithJob(TOKEN),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 when the bearer token is wrong', async () => {
    const request = statusRequest('POST', { status: 'building' }, 'wrong-token');
    const response = await onRequestPost({
      request,
      env: envWithJob(TOKEN),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it('updates the row when the bearer token matches', async () => {
    const env = envWithJob(TOKEN);
    const request = statusRequest(
      'POST',
      {
        status: 'done',
        step: 'deploy',
        detail: 'Published',
        executionId: 'exec-1',
        deployUrl: 'https://recipe-box.pages.dev'
      },
      TOKEN
    );
    const response = await onRequestPost({ request, env, params: { id: JOB_ID } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const row = readQueueJobs(env)[0];
    expect(row?.status).toBe('done');
    expect(row?.step).toBe('deploy');
    expect(row?.detail).toBe('Published');
    expect(row?.execution_id).toBe('exec-1');
    expect(row?.deploy_url).toBe('https://recipe-box.pages.dev');
    expect(row?.prompt).toBe(SECRET_PROMPT);
  });

  it('returns 404 for an unknown id', async () => {
    const request = statusRequest('POST', { status: 'failed' }, TOKEN);
    const response = await onRequestPost({
      request,
      env: envWithJob(TOKEN),
      params: { id: MISSING_ID }
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Job not found' });
  });

  it('keeps the previous step when the update omits it', async () => {
    const env = envWithJob(TOKEN);
    const request = statusRequest('POST', { status: 'awaiting_owner' }, TOKEN);
    const response = await onRequestPost({ request, env, params: { id: JOB_ID } });
    expect(response.status).toBe(200);
    expect(readQueueJobs(env)[0]?.step).toBe('install-deps');
  });
});

describe('POST /api/jobs/:id/status validation', () => {
  it('rejects status queued', async () => {
    const request = statusRequest('POST', { status: 'queued' }, TOKEN);
    const response = await onRequestPost({
      request,
      env: envWithJob(TOKEN),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(400);
  });

  it('rejects an unknown status', async () => {
    const request = statusRequest('POST', { status: 'shipped' }, TOKEN);
    const response = await onRequestPost({
      request,
      env: envWithJob(TOKEN),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(400);
  });

  it('rejects a step that is not a lowercase slug', async () => {
    const request = statusRequest('POST', { status: 'building', step: 'Install Deps' }, TOKEN);
    const response = await onRequestPost({
      request,
      env: envWithJob(TOKEN),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(400);
  });

  it('rejects a step longer than 64 characters', async () => {
    const request = statusRequest(
      'POST',
      { status: 'building', step: 'a'.repeat(65) },
      TOKEN
    );
    const response = await onRequestPost({
      request,
      env: envWithJob(TOKEN),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(400);
  });

  it('rejects a deployUrl that is not https and does not write', async () => {
    const env = envWithJob(TOKEN);
    const request = statusRequest(
      'POST',
      { status: 'done', deployUrl: 'http://recipe-box.pages.dev' },
      TOKEN
    );
    const response = await onRequestPost({
      request,
      env,
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(400);
    expect(readQueueJobs(env)[0]?.status).toBe('building');
    expect(readQueueJobs(env)[0]?.deploy_url).toBeNull();
  });

  it('rejects a deployUrl longer than 200 characters', async () => {
    const request = statusRequest(
      'POST',
      { status: 'done', deployUrl: `https://example.com/${'a'.repeat(190)}` },
      TOKEN
    );
    const response = await onRequestPost({
      request,
      env: envWithJob(TOKEN),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(400);
  });

  it('does not treat a bad body as success when the token is missing', async () => {
    const request = statusRequest('POST', { status: 'queued' }, null);
    const response = await onRequestPost({
      request,
      env: envWithJob(TOKEN),
      params: { id: JOB_ID }
    });
    expect(response.status).toBe(401);
  });
});

describe('job id validation at the boundary', () => {
  it.each([
    ['a slug instead of a UUID', 'job-1'],
    ['an uppercase UUID', '5B1C2D3E-4F50-4A6B-8C7D-9E0F1A2B3C4D'],
    ['an oversized value', `${JOB_ID}${'a'.repeat(500)}`],
    ['a blank id', '   '],
    ['SQL text', "1' OR '1'='1"]
  ])('GET answers %s with 404 before any query', async (_label, id) => {
    const request = statusRequest('GET', null, null, encodeURIComponent(id));
    const response = await onRequestGet({
      request,
      // The row exists under that exact id, so only validation can make this 404.
      env: envWithJob(undefined, id),
      params: { id }
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Job not found' });
    expectSecureHeaders(response, request.url, 'GET, POST');
  });

  it('POST with a valid token answers a malformed id with 404 and writes nothing', async () => {
    const env = envWithJob(TOKEN, 'job-1');
    const response = await onRequestPost({
      request: statusRequest('POST', { status: 'done' }, TOKEN, 'job-1'),
      env,
      params: { id: 'job-1' }
    });
    expect(response.status).toBe(404);
    expect(readQueueJobs(env)[0]?.status).toBe('building');
  });
});
