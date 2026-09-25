import { describe, it, expect } from 'vitest';
import { CLAIM_LEASE_MS, onRequestPost } from './claim';
import type { D1PreparedStatement, Env } from '../../lib/env';
import { expectSecureHeaders } from '../../../tests/helpers/d1';
import {
  createQueueEnv,
  readQueueJobs,
  type QueueJobSeed
} from '../../../tests/helpers/jobQueueDb';

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

/** Margin either side of the lease edge, so the cases do not race the clock. */
const LEASE_MARGIN_MS = 60_000;

/**
 * A job a runner claimed at `claimedAt` and never moved past `claimed`.
 *
 * @param id - Job id.
 * @param createdAt - ISO creation time.
 * @param claimedAt - ISO claim time.
 * @param status - Row status; defaults to `claimed`.
 * @returns Seed row.
 */
function claimedAt(
  id: string,
  createdAt: string,
  claimedAt: string,
  status = 'claimed'
): QueueJobSeed {
  return {
    id,
    slug: id,
    prompt: `prompt ${id}`,
    created_at: createdAt,
    status,
    claimed_at: claimedAt,
    claimed_by: 'crashed-runner'
  };
}

/**
 * ISO time `offsetMs` before now.
 *
 * @param offsetMs - Milliseconds in the past.
 * @returns ISO timestamp.
 */
function agoIso(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

/**
 * Wrap an env so every claim's pick SELECT waits until `parties` picks have
 * been issued. Both claimers then read the same candidate before either
 * UPDATEs it, which is the race the compare-and-set exists for. Without the
 * barrier the first claim finishes before the second picks, and a claim
 * UPDATE with no guard at all would still pass.
 *
 * @param env - Env from createQueueEnv; its DB does the real work.
 * @param parties - Picks to hold back until all have arrived.
 * @returns Env whose DB holds the pick SELECTs at the barrier.
 */
function withPickBarrier(env: Env, parties: number): Env {
  let arrived = 0;
  let release: () => void = () => undefined;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    ...env,
    DB: {
      prepare(query: string): D1PreparedStatement {
        const inner = env.DB.prepare(query);
        if (!query.startsWith('SELECT id FROM jobs')) return inner;
        const held: D1PreparedStatement = {
          bind(...values: unknown[]): D1PreparedStatement {
            inner.bind(...values);
            return held;
          },
          run: () => inner.run(),
          async all() {
            arrived += 1;
            if (arrived >= parties) release();
            await barrier;
            return inner.all();
          }
        };
        return held;
      }
    }
  };
}

describe('POST /api/jobs/claim lease', () => {
  it('is well above the poller claim-to-awaiting_owner window and several poll cycles', () => {
    // Two 20 s poller HTTP timeouts and six 5 min poll cycles, both from job-poller.mjs.
    expect(CLAIM_LEASE_MS).toBeGreaterThanOrEqual(6 * 5 * 60_000);
  });

  it('re-issues a job whose claim is older than the lease', async () => {
    const env = createQueueEnv({
      runnerToken: TOKEN,
      jobs: [
        claimedAt('job-stuck', '2026-01-01T00:00:00.000Z', agoIso(CLAIM_LEASE_MS + LEASE_MARGIN_MS))
      ]
    });
    const before = Date.now();
    const response = await onRequestPost({
      request: claimRequest({ runner: 'runner-2' }, TOKEN),
      env
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { job: { id: string; prompt: string } };
    expect(body.job.id).toBe('job-stuck');
    expect(body.job.prompt).toBe('prompt job-stuck');
    const row = readQueueJobs(env)[0];
    expect(row?.status).toBe('claimed');
    expect(row?.claimed_by).toBe('runner-2');
    expect(Date.parse(row?.claimed_at ?? '')).toBeGreaterThanOrEqual(before);
  });

  it('does not re-issue a claim that is still inside the lease', async () => {
    const env = createQueueEnv({
      runnerToken: TOKEN,
      jobs: [
        claimedAt('job-live', '2026-01-01T00:00:00.000Z', agoIso(CLAIM_LEASE_MS - LEASE_MARGIN_MS))
      ]
    });
    const response = await onRequestPost({
      request: claimRequest({ runner: 'runner-2' }, TOKEN),
      env
    });
    expect(response.status).toBe(204);
    expect(readQueueJobs(env)[0]?.claimed_by).toBe('crashed-runner');
  });

  it('never re-issues a job that moved past claimed, however old its claim', async () => {
    const old = agoIso(CLAIM_LEASE_MS * 10);
    const env = createQueueEnv({
      runnerToken: TOKEN,
      jobs: [
        claimedAt('job-awaiting', '2026-01-01T00:00:00.000Z', old, 'awaiting_owner'),
        claimedAt('job-building', '2026-01-01T00:00:01.000Z', old, 'building'),
        claimedAt('job-done', '2026-01-01T00:00:02.000Z', old, 'done')
      ]
    });
    const response = await onRequestPost({
      request: claimRequest({ runner: 'runner-2' }, TOKEN),
      env
    });
    expect(response.status).toBe(204);
  });

  it('hands an expired claim to exactly one of two claimers that both picked it', async () => {
    const env = createQueueEnv({
      runnerToken: TOKEN,
      jobs: [
        claimedAt('job-stuck', '2026-01-01T00:00:00.000Z', agoIso(CLAIM_LEASE_MS + LEASE_MARGIN_MS))
      ]
    });
    const racing = withPickBarrier(env, 2);
    const [first, second] = await Promise.all([
      onRequestPost({ request: claimRequest({ runner: 'runner-1' }, TOKEN), env: racing }),
      onRequestPost({ request: claimRequest({ runner: 'runner-2' }, TOKEN), env: racing })
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 204]);
  });

  it('takes the older of a queued job and an expired claim first', async () => {
    const env = createQueueEnv({
      runnerToken: TOKEN,
      jobs: [
        queued('job-queued', '2026-01-02T00:00:00.000Z', 'queued prompt'),
        claimedAt('job-stuck', '2026-01-01T00:00:00.000Z', agoIso(CLAIM_LEASE_MS + LEASE_MARGIN_MS))
      ]
    });
    const first = await onRequestPost({
      request: claimRequest({ runner: 'runner-2' }, TOKEN),
      env
    });
    const second = await onRequestPost({
      request: claimRequest({ runner: 'runner-2' }, TOKEN),
      env
    });
    expect(((await first.json()) as { job: { id: string } }).job.id).toBe('job-stuck');
    expect(((await second.json()) as { job: { id: string } }).job.id).toBe('job-queued');
  });
});
