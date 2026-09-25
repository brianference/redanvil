/**
 * Job poller. Each case names the input that must fail if the check is hollow.
 *
 * The exactly-once webhook case is also run against a temp copy that forgets
 * `webhookPosted`. That copy must double-fire, and a child process that asserts
 * "exactly once" against it must exit non-zero.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import {
  createSqliteExecutionReader,
  executionErrorMessage,
  latestFinishedStep,
  openReadOnlyDatabase,
  parseExecutionData
} from '../poller/execution-reader.mjs';
import { main, mapExecution, runCycle } from '../poller/job-poller.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const POLLER = join(HERE, '..', 'poller', 'job-poller.mjs');
const POLLER_DIR = join(HERE, '..', 'poller');
const NODE = process.execPath;

/** Real flatted payload produced by n8n's flatted.stringify of a one-step run. */
const FLATTED_RUN =
  '[{"resultData":"1","executionData":"2"},{"runData":"3","error":"4"},{"nodeExecutionStack":"5"},' +
  '{"Role: prd":"6"},{"message":"7"},[],["8"],"role exploded",' +
  '{"startTime":1000,"executionTime":50,"executionStatus":"9","data":"10"},"success",' +
  '{"main":"11"},["12"],["13"],{"json":"14"},{"step":"15","slug":"16"},"prd","pet-sitter"]';

const SAMPLE_JOB = {
  id: 'job-1',
  slug: 'taken-slug',
  prompt: 'A planting calendar for Phoenix yards',
  entities: 'tomato, basil',
  target_type: 'web',
  threshold: 90,
  created_at: '2026-09-23T00:00:00.000Z'
};

/**
 * Read an HTTP request body.
 * @param {import('node:http').IncomingMessage} req request
 * @returns {Promise<string>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * @param {import('node:http').ServerResponse} res response
 * @param {number} status status code
 * @param {object} body JSON body
 */
function sendJson(res, status, body) {
  const encoded = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(encoded);
}

/**
 * Listen on an ephemeral loopback port.
 * @param {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>} handler
 */
function listen(handler) {
  const server = createServer((req, res) => {
    handler(req, res).catch((err) => {
      res.writeHead(500);
      res.end(String(err));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('no port');
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          })
      });
    });
  });
}

/**
 * Fake site plus fake webhook, and a temp repo that is not this workspace.
 * @param {{job?: object|null, runCycleFn?: typeof runCycle, fetchImpl?: typeof fetch}} [options]
 */
async function createWorld(options = {}) {
  const runCycleFn = options.runCycleFn ?? runCycle;
  const repo = mkdtempSync(join(tmpdir(), 'poller-repo-'));
  const token = 'test-runner-token';
  /** @type {object[]} */
  const statuses = [];
  /** @type {object[]} */
  const webhooks = [];
  /** @type {object[]} */
  const queue = options.job ? [options.job] : [];
  const site = await listen(async (req, res) => {
    const raw = await readBody(req);
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${token}`) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'POST' && path === '/api/jobs/claim') {
      const next = queue.shift();
      if (!next) {
        res.writeHead(204);
        res.end();
        return;
      }
      sendJson(res, 200, { job: next });
      return;
    }
    const match = path.match(/^\/api\/jobs\/([^/]+)\/status$/);
    if (req.method === 'POST' && match) {
      statuses.push({ id: decodeURIComponent(match[1]), body: JSON.parse(raw || '{}') });
      sendJson(res, 200, { ok: true });
      return;
    }
    sendJson(res, 404, { error: 'not found' });
  });
  const hook = await listen(async (req, res) => {
    const raw = await readBody(req);
    webhooks.push(JSON.parse(raw || '{}'));
    sendJson(res, 200, { message: 'Workflow was started' });
  });

  return {
    repo,
    token,
    statuses,
    webhooks,
    /**
     * Make the fake site hand this job out again, as the real claim route does
     * once a job has sat in `claimed` past its lease.
     * @param {object} job claim response job
     */
    reissue(job) {
      queue.push(job);
    },
    /**
     * @param {object} [extra] runCycle overrides
     */
    cycle(extra = {}) {
      return runCycleFn({
        token,
        siteUrl: site.url,
        n8nUrl: hook.url,
        repoRoot: repo,
        fetchImpl: options.fetchImpl ?? globalThis.fetch,
        executionReader: { lookup: async () => null },
        log() {},
        ...extra
      });
    },
    async close() {
      await site.close();
      await hook.close();
      rmSync(repo, { recursive: true, force: true });
    }
  };
}

/**
 * Owner decision. Removes the pending file, which is what the contract does.
 * @param {string} repo repo root
 * @param {string} id dispatch id
 * @param {'approve'|'reject'} decision
 */
function decide(repo, id, decision) {
  const dir = join(repo, '.redanvil', 'dispatch', 'resolved');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${id}.json`),
    `${JSON.stringify(
      {
        id,
        decision,
        notes: decision === 'reject' ? 'not this one' : '',
        resolvedAt: '2026-09-23T01:00:00.000Z',
        resolvedBy: 'owner'
      },
      null,
      2
    )}\n`
  );
  rmSync(join(repo, '.redanvil', 'dispatch', 'pending', `${id}.json`), { force: true });
}

/**
 * @param {string} repo repo root
 * @param {string} id dispatch id
 * @returns {object}
 */
function readPending(repo, id) {
  return JSON.parse(
    readFileSync(join(repo, '.redanvil', 'dispatch', 'pending', `${id}.json`), 'utf8')
  );
}

describe('claim', () => {
  test('writes a job-approval pending record and sets awaiting_owner', async () => {
    const world = await createWorld({ job: SAMPLE_JOB });
    try {
      await world.cycle();
      const pending = readPending(world.repo, 'job-1');
      assert.equal(pending.kind, 'job-approval');
      assert.equal(pending.expiresAt, null);
      assert.equal(pending.onTimeout, null);
      assert.equal(pending.slug, 'taken-slug');
      assert.deepEqual(pending.resume, { type: 'job', jobId: 'job-1' });
      assert.equal(pending.options.length, 0);
      const awaiting = world.statuses.find((post) => post.body.status === 'awaiting_owner');
      assert.ok(awaiting);
      assert.equal(awaiting.body.detail, 'waiting for the owner to approve this build');
      assert.equal(world.webhooks.length, 0);
    } finally {
      await world.close();
    }
  });

  test('FAIL INPUT: a slug that is already a directory is suffixed', async () => {
    const world = await createWorld({ job: SAMPLE_JOB });
    try {
      mkdirSync(join(world.repo, 'taken-slug'));
      mkdirSync(join(world.repo, 'taken-slug-2'));
      await world.cycle();
      const pending = readPending(world.repo, 'job-1');
      assert.equal(pending.slug, 'taken-slug-3');
      const awaiting = world.statuses.find((post) => post.body.status === 'awaiting_owner');
      assert.match(awaiting.body.detail, /waiting for the owner to approve this build/);
      assert.match(awaiting.body.detail, /taken-slug-3/);
    } finally {
      await world.close();
    }
  });
});

describe('claim lease re-issue', () => {
  test('FAIL INPUT: a re-issued job is not tracked twice and its status is sent again', async () => {
    const world = await createWorld({ job: SAMPLE_JOB });
    try {
      await world.cycle();
      world.reissue(SAMPLE_JOB);
      const result = await world.cycle();
      assert.equal(result.claimed, false);
      const awaiting = world.statuses.filter(
        (post) => post.id === 'job-1' && post.body.status === 'awaiting_owner'
      );
      assert.equal(awaiting.length, 2);
      assert.equal(readPending(world.repo, 'job-1').slug, 'taken-slug');
      assert.equal(world.webhooks.length, 0);
    } finally {
      await world.close();
    }
  });

  test('a re-issued job that the owner already approved does not start a second build', async () => {
    const world = await createWorld({ job: SAMPLE_JOB });
    try {
      await world.cycle();
      decide(world.repo, 'job-1', 'approve');
      await world.cycle();
      assert.equal(world.webhooks.length, 1);
      world.reissue(SAMPLE_JOB);
      await world.cycle();
      await world.cycle();
      assert.equal(world.webhooks.length, 1);
      const last = world.statuses.filter((post) => post.id === 'job-1').at(-1);
      assert.equal(last.body.status, 'building');
    } finally {
      await world.close();
    }
  });
});

describe('owner decision', () => {
  test('approve calls the webhook exactly once across two further cycles', async () => {
    const world = await createWorld({ job: SAMPLE_JOB });
    try {
      await world.cycle();
      decide(world.repo, 'job-1', 'approve');
      await world.cycle();
      await world.cycle();
      assert.equal(world.webhooks.length, 1);
      assert.deepEqual(world.webhooks[0], {
        slug: 'taken-slug',
        prompt: SAMPLE_JOB.prompt,
        entities: SAMPLE_JOB.entities
      });
      assert.ok(world.statuses.some((post) => post.body.status === 'building'));
    } finally {
      await world.close();
    }
  });

  test('FAIL INPUT: a webhook that reached n8n but lost its response is not posted again', async () => {
    // The response is lost after delivery (abort, crash before writeJob). The
    // execution exists in n8n, so later cycles must find it instead of POSTing.
    const deliverThenThrow = async (url, init) => {
      const response = await globalThis.fetch(url, init);
      if (String(url).includes('/webhook/')) throw new Error('aborted after delivery');
      return response;
    };
    const world = await createWorld({ job: SAMPLE_JOB, fetchImpl: deliverThenThrow });
    try {
      await world.cycle();
      decide(world.repo, 'job-1', 'approve');
      const reader = {
        lookup: async () =>
          world.webhooks.length > 0
            ? { executionId: 'e-1', status: 'running', step: null, errorMessage: null }
            : null
      };
      await world.cycle({ executionReader: reader });
      await world.cycle({ executionReader: reader });
      await world.cycle({ executionReader: reader });
      assert.equal(world.webhooks.length, 1);
      assert.ok(world.statuses.some((post) => post.body.status === 'building'));
    } finally {
      await world.close();
    }
  });

  test('FAIL INPUT: reject never calls the webhook', async () => {
    const world = await createWorld({ job: SAMPLE_JOB });
    try {
      await world.cycle();
      decide(world.repo, 'job-1', 'reject');
      await world.cycle();
      await world.cycle();
      assert.equal(world.webhooks.length, 0);
      const rejected = world.statuses.filter((post) => post.body.status === 'rejected');
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].id, 'job-1');
    } finally {
      await world.close();
    }
  });

  test('FAIL INPUT: a temp copy that forgets webhookPosted double-fires, and the exactly-once assertion fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'poller-broken-'));
    const copyDir = join(dir, 'poller');
    cpSync(POLLER_DIR, copyDir, { recursive: true });
    const copy = join(copyDir, 'job-poller.mjs');
    const source = readFileSync(copy, 'utf8');
    // Remove BOTH idempotency guards: the posted flag and the attempt marker that
    // looks for an earlier execution before posting again.
    const needle = 'job.webhookPosted = true';
    const attempt = 'if (job.webhookAttemptedAt) {';
    assert.equal(source.split(needle).length - 1, 2);
    assert.equal(source.split(attempt).length - 1, 1);
    writeFileSync(copy, source.split(needle).join('job.webhookPosted = false').replace(attempt, 'if (false) {'));
    const broken = await import(pathToFileURL(copy).href);
    const world = await createWorld({ job: SAMPLE_JOB, runCycleFn: broken.runCycle });
    try {
      await world.cycle();
      decide(world.repo, 'job-1', 'approve');
      await world.cycle();
      await world.cycle();
      assert.equal(world.webhooks.length, 2);
    } finally {
      await world.close();
    }

    const proof = join(dir, 'exactly-once.mjs');
    writeFileSync(
      proof,
      `import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const { runCycle } = await import(pathToFileURL(${JSON.stringify(copy)}).href);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function listen(handler) {
  const server = createServer((req, res) => {
    handler(req, res).catch((err) => {
      res.writeHead(500);
      res.end(String(err));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        url: 'http://127.0.0.1:' + address.port,
        close: () => new Promise((done) => server.close(() => done()))
      });
    });
  });
}
const token = 'test-runner-token';
const job = ${JSON.stringify(SAMPLE_JOB)};
const webhooks = [];
const queue = [job];
const site = await listen(async (req, res) => {
  const path = (req.url || '').split('?')[0];
  if ((req.headers.authorization || '') !== 'Bearer ' + token) {
    res.writeHead(401);
    res.end();
    return;
  }
  if (req.method === 'POST' && path === '/api/jobs/claim') {
    await readBody(req);
    const next = queue.shift();
    if (!next) {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ job: next }));
    return;
  }
  await readBody(req);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});
const hook = await listen(async (req, res) => {
  webhooks.push(JSON.parse((await readBody(req)) || '{}'));
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ message: 'Workflow was started' }));
});
const repo = mkdtempSync(join(tmpdir(), 'poller-proof-'));
const opts = {
  token,
  siteUrl: site.url,
  n8nUrl: hook.url,
  repoRoot: repo,
  executionReader: { lookup: async () => null },
  log() {}
};
await runCycle(opts);
mkdirSync(join(repo, '.redanvil', 'dispatch', 'resolved'), { recursive: true });
writeFileSync(
  join(repo, '.redanvil', 'dispatch', 'resolved', 'job-1.json'),
  JSON.stringify({ id: 'job-1', decision: 'approve', notes: '', resolvedAt: '2026-09-23T01:00:00.000Z', resolvedBy: 'owner' })
);
rmSync(join(repo, '.redanvil', 'dispatch', 'pending', 'job-1.json'), { force: true });
await runCycle(opts);
await runCycle(opts);
assert.equal(webhooks.length, 1, 'webhook call count');
await site.close();
await hook.close();
rmSync(repo, { recursive: true, force: true });
`
    );
    const result = spawnSync(NODE, [proof], { encoding: 'utf8', timeout: 20_000 });
    process.stdout.write(
      `\nbroken-copy exactly-once exit ${result.status}\n${result.stderr ?? ''}\n`
    );
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}`, /AssertionError|webhook call count/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('building', () => {
  test('pushes the finished step, then maps success to done and error to failed', async () => {
    const world = await createWorld();
    try {
      seedJob(world.repo, buildingRecord('job-ok', '41', 'calendar-app'));
      seedJob(world.repo, buildingRecord('job-bad', '42', 'calendar-bad'));
      /** @type {Record<string, object>} */
      const views = {
        41: { executionId: '41', status: 'running', step: 'prd', errorMessage: null },
        42: {
          executionId: '42',
          status: 'error',
          step: 'qa-runtime',
          errorMessage: 'role command exited 3'
        }
      };
      await world.cycle({
        executionReader: {
          lookup: async ({ executionId }) => views[executionId] ?? null
        }
      });
      const stepPost = world.statuses.find((post) => post.id === 'job-ok');
      assert.equal(stepPost.body.status, 'building');
      assert.equal(stepPost.body.step, 'prd');
      const failed = world.statuses.find((post) => post.id === 'job-bad');
      assert.equal(failed.body.status, 'failed');
      // Public detail names the step only; the raw n8n message stays local.
      assert.equal(failed.body.detail, 'build error at step qa-runtime');
      assert.equal(failed.body.detail.includes('exited'), false);
      assert.equal(failed.body.step, 'qa-runtime');

      views['41'] = { executionId: '41', status: 'success', step: 'ship', errorMessage: null };
      await world.cycle({
        executionReader: {
          lookup: async ({ executionId }) => views[executionId] ?? null
        }
      });
      const done = world.statuses.filter((post) => post.id === 'job-ok').at(-1);
      assert.equal(done.body.status, 'done');
      assert.equal(done.body.step, 'ship');
      assert.equal(world.webhooks.length, 0);
    } finally {
      await world.close();
    }
  });
});

describe('site down', () => {
  test('FAIL INPUT: an unreachable site does not drop state or mark the job failed', async () => {
    const world = await createWorld();
    try {
      seedJob(world.repo, buildingRecord('job-ok', '41', 'calendar-app'));
      const path = join(world.repo, '.redanvil', 'dispatch', 'jobs', 'job-ok.json');
      const before = readFileSync(path, 'utf8');
      await world.cycle({
        fetchImpl: async () => {
          throw new Error('connect ECONNREFUSED');
        },
        executionReader: {
          lookup: async () => ({
            executionId: '41',
            status: 'crashed',
            step: 'prd',
            errorMessage: 'n8n crashed'
          })
        }
      });
      const after = readFileSync(path, 'utf8');
      assert.equal(after, before);
      assert.equal(JSON.parse(after).lastStatus, 'building');
      assert.notEqual(JSON.parse(after).lastStatus, 'failed');
    } finally {
      await world.close();
    }
  });
});

describe('cli', () => {
  test('FAIL INPUT: missing REDANVIL_RUNNER_TOKEN exits non-zero and does not invent one', () => {
    const env = { ...process.env, REDANVIL_SKIP_ENV_FILE: '1', REDANVIL_SITE_URL: 'http://127.0.0.1:9' };
    delete env.REDANVIL_RUNNER_TOKEN;
    const result = spawnSync(NODE, [POLLER, '--once'], { encoding: 'utf8', env, timeout: 15_000 });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}`, /REDANVIL_RUNNER_TOKEN is not set/);
  });

  test('a set token is not printed when the site is down', () => {
    const token = 'sentinel-do-not-print-9f3a';
    const repo = mkdtempSync(join(tmpdir(), 'poller-cli-'));
    try {
      const result = spawnSync(NODE, [POLLER, '--once'], {
        encoding: 'utf8',
        timeout: 15_000,
        env: {
          ...process.env,
          REDANVIL_SKIP_ENV_FILE: '1',
          REDANVIL_RUNNER_TOKEN: token,
          REDANVIL_SITE_URL: 'http://127.0.0.1:9',
          REDANVIL_N8N_URL: 'http://127.0.0.1:9',
          REDANVIL_REPO: repo
        }
      });
      assert.equal(result.status, 0);
      assert.equal(`${result.stdout}${result.stderr}`.includes(token), false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('FAIL INPUT: --interval-min 0 is rejected before the loop', async () => {
    const code = await main(['--interval-min', '0'], { REDANVIL_RUNNER_TOKEN: 'present' });
    assert.equal(code, 1);
  });
});

describe('execution reader', () => {
  test('decodes flatted run data and refuses a writable connection', () => {
    const data = parseExecutionData(FLATTED_RUN);
    assert.equal(latestFinishedStep(data), 'prd');
    assert.equal(executionErrorMessage(data), 'role exploded');
    assert.equal(
      mapExecution({ status: 'success', step: 'prd', errorMessage: null, executionId: '15' })
        .status,
      'done'
    );
    assert.equal(
      mapExecution({
        status: 'crashed',
        step: 'prd',
        errorMessage: 'role exploded',
        executionId: '15'
      }).status,
      'failed'
    );

    const dir = mkdtempSync(join(tmpdir(), 'poller-sqlite-'));
    const databasePath = join(dir, 'database.sqlite');
    const db = new DatabaseSync(databasePath);
    db.exec(`
      CREATE TABLE execution_entity (
        id varchar PRIMARY KEY,
        status varchar,
        workflowId varchar,
        startedAt datetime,
        deletedAt datetime
      );
      CREATE TABLE execution_data (
        executionId varchar PRIMARY KEY,
        data text
      );
    `);
    db.prepare(
      `INSERT INTO execution_entity (id, status, workflowId, startedAt, deletedAt)
       VALUES ('15', 'running', 'redanvilFull001', '2026-09-23 01:00:00.000', NULL)`
    ).run();
    db.prepare(`INSERT INTO execution_data (executionId, data) VALUES ('15', ?)`).run(FLATTED_RUN);
    db.close();

    const readonly = openReadOnlyDatabase(databasePath);
    assert.throws(() => {
      readonly.prepare(`INSERT INTO execution_entity (id, status) VALUES ('99', 'running')`).run();
    });
    readonly.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test('sqlite lookup finds the build by slug and the poller pushes that step', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'poller-sqlite-'));
    const databasePath = join(dir, 'database.sqlite');
    const db = new DatabaseSync(databasePath);
    db.exec(`
      CREATE TABLE execution_entity (
        id varchar PRIMARY KEY,
        status varchar,
        workflowId varchar,
        startedAt datetime,
        deletedAt datetime
      );
      CREATE TABLE execution_data (
        executionId varchar PRIMARY KEY,
        data text
      );
    `);
    db.prepare(
      `INSERT INTO execution_entity (id, status, workflowId, startedAt, deletedAt)
       VALUES ('15', 'running', 'redanvilFull001', '2026-09-23 01:00:00.000', NULL)`
    ).run();
    db.prepare(`INSERT INTO execution_data (executionId, data) VALUES ('15', ?)`).run(FLATTED_RUN);
    db.close();

    const reader = createSqliteExecutionReader({
      databasePath,
      workflowId: 'redanvilFull001'
    });
    const bySlug = await reader.lookup({ slug: 'pet-sitter' });
    assert.equal(bySlug.executionId, '15');
    assert.equal(bySlug.status, 'running');
    assert.equal(bySlug.step, 'prd');

    const world = await createWorld();
    try {
      const record = buildingRecord('job-live', null, 'pet-sitter');
      record.executionId = null;
      seedJob(world.repo, record);
      await world.cycle({ executionReader: reader });
      const posted = world.statuses.find((post) => post.id === 'job-live');
      assert.equal(posted.body.status, 'building');
      assert.equal(posted.body.step, 'prd');
      assert.equal(posted.body.executionId, '15');

      const writable = new DatabaseSync(databasePath);
      writable.prepare(`UPDATE execution_entity SET status = 'success' WHERE id = '15'`).run();
      writable.close();
      await world.cycle({ executionReader: reader });
      const done = world.statuses.filter((post) => post.id === 'job-live').at(-1);
      assert.equal(done.body.status, 'done');
    } finally {
      await world.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * A building job the poller already triggered.
 * @param {string} id job id
 * @param {string|null} executionId n8n id
 * @param {string} slug resolved slug
 * @returns {object}
 */
function buildingRecord(id, executionId, slug) {
  return {
    fileId: id,
    jobId: id,
    slug,
    requestedSlug: slug,
    prompt: 'A planting calendar for Phoenix yards',
    entities: '',
    executionId,
    lastStep: null,
    lastStatus: 'building',
    pendingId: id,
    webhookPosted: true,
    webhookPostedAt: '2026-09-23T00:00:00.000Z',
    remoteSynced: true,
    actedDecision: 'approve',
    detail: 'n8n build started'
  };
}

/**
 * @param {string} repo repo root
 * @param {object} record job record
 */
function seedJob(repo, record) {
  const dir = join(repo, '.redanvil', 'dispatch', 'jobs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${record.fileId}.json`), `${JSON.stringify(record, null, 2)}\n`);
}
