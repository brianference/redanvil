import { describe, it, expect } from 'vitest';
import { onRequestPost } from './claim';
import { expectSecureHeaders } from '../../../tests/helpers/d1';
import { createQueueEnv, type QueueJobSeed } from '../../../tests/helpers/jobQueueDb';

/** Fake runner secret. Injected in-process; not a real credential. */
const TOKEN = 'runner-test-token';

/**
 * A queued job seed.
 *
 * @param id - Job id.
 * @param createdAt - ISO timestamp. Older sorts first.
 * @param prompt - Prompt text the claim response is allowed to return.
 * @returns Seed row.
 */
function queued(id: string, createdAt: string, prompt: string): QueueJobSeed {
  return {
    id,
    slug: id,
    prompt,
    created_at: createdAt,
    entities: 'Recipe, User',
    status: 'queued'
  };
}

/**
 * POST /api/jobs/claim.
 *
 * @param body - JSON body.
 * @param token - Bearer token, or null to omit Authorization.
 * @returns The request.
 */
function claimRequest(body: unknown, token: string | null): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (token !== null) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return new Request('https://example.com/api/jobs/claim', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

describe('POST /api/jobs/claim auth', () => {
  it('returns 503 when RUNNER_TOKEN is unset', async () => {
    const request = claimRequest({ runner: 'loop' }, TOKEN);
    const response = await onRequestPost({
      request,
      env: createQueueEnv({ jobs: [queued('job-a', '2026-01-01T00:00:00.000Z', 'secret')] })
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'runner not configured' });
  });

  it('returns 401 when the bearer token is missing', async () => {
    const request = claimRequest({ runner: 'loop' }, null);
    const response = await onRequestPost({
      request,
      env: createQueueEnv({
        runnerToken: TOKEN,
        jobs: [queued('job-a', '2026-01-01T00:00:00.000Z', 'secret')]
      })
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expectSecureHeaders(response, request.url, 'POST');
  });

  it('returns 401 when the bearer token is wrong', async () => {
    const request = claimRequest({ runner: 'loop' }, 'not-the-token');
    const response = await onRequestPost({
      request,
      env: createQueueEnv({
        runnerToken: TOKEN,
        jobs: [queued('job-a', '2026-01-01T00:00:00.000Z', 'secret')]
      })
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns the oldest queued job when the bearer token matches', async () => {
    const request = claimRequest({ runner: 'loop' }, TOKEN);
    const response = await onRequestPost({
      request,
      env: createQueueEnv({
        runnerToken: TOKEN,
        jobs: [
          queued('job-newer', '2026-01-02T00:00:00.000Z', 'newer prompt'),
          queued('job-older', '2026-01-01T00:00:00.000Z', 'older prompt')
        ]
      })
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      job: {
        id: 'job-older',
        slug: 'job-older',
        prompt: 'older prompt',
        entities: 'Recipe, User',
        target_type: 'fullstack-web',
        threshold: 90,
        created_at: '2026-01-01T00:00:00.000Z'
      }
    });
    expectSecureHeaders(response, request.url, 'POST');
  });
});

describe('POST /api/jobs/claim queue', () => {
  it('returns 204 when nothing is queued', async () => {
    const request = claimRequest({ runner: 'loop' }, TOKEN);
    const response = await onRequestPost({
      request,
      env: createQueueEnv({ runnerToken: TOKEN, jobs: [] })
    });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('returns an empty entities string when the row has none', async () => {
    const request = claimRequest({ runner: 'loop' }, TOKEN);
    const response = await onRequestPost({
      request,
      env: createQueueEnv({
        runnerToken: TOKEN,
        jobs: [
          {
            id: 'job-a',
            slug: 'job-a',
            prompt: 'Build a recipe box for home cooks',
            created_at: '2026-01-01T00:00:00.000Z',
            entities: ''
          }
        ]
      })
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { job: { entities: string } };
    expect(body.job.entities).toBe('');
  });

  it('two concurrent claims never return the same job', async () => {
    const env = createQueueEnv({
      runnerToken: TOKEN,
      jobs: [
        queued('job-a', '2026-01-01T00:00:00.000Z', 'prompt a'),
        queued('job-b', '2026-01-01T00:00:01.000Z', 'prompt b')
      ]
    });
    const [first, second] = await Promise.all([
      onRequestPost({ request: claimRequest({ runner: 'runner-1' }, TOKEN), env }),
      onRequestPost({ request: claimRequest({ runner: 'runner-2' }, TOKEN), env })
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const bodyA = (await first.json()) as { job: { id: string } };
    const bodyB = (await second.json()) as { job: { id: string } };
    expect(bodyA.job.id).not.toBe(bodyB.job.id);
    expect(new Set([bodyA.job.id, bodyB.job.id])).toEqual(new Set(['job-a', 'job-b']));
  });

  it('a second claim gets 204 once the only queued job is taken', async () => {
    const env = createQueueEnv({
      runnerToken: TOKEN,
      jobs: [queued('job-a', '2026-01-01T00:00:00.000Z', 'prompt a')]
    });
    const first = await onRequestPost({
      request: claimRequest({ runner: 'runner-1' }, TOKEN),
      env
    });
    const second = await onRequestPost({
      request: claimRequest({ runner: 'runner-2' }, TOKEN),
      env
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(204);
  });

  it('rejects a claim body without a runner name', async () => {
    const request = claimRequest({}, TOKEN);
    const response = await onRequestPost({
      request,
      env: createQueueEnv({ runnerToken: TOKEN })
    });
    expect(response.status).toBe(400);
  });
});
