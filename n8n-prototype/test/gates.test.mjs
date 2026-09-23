/**
 * Design gates, the dispatch CLI, and the orphan sweep.
 *
 * The redo-edge assertion is the one that fails on the pre-change generator:
 * that generator connects the Wait node straight to the next step and never
 * points a redo branch at `layout params`.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';
import { GALLERY_MAX_BYTES } from '../dispatch/constants.mjs';
import { approvalNode, DEFAULT_GATE_WAIT } from '../build-workflow.mjs';
import { buildLiveGateWorkflow } from './live-gate-workflow.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PROTO = join(HERE, '..');
const BUILD = join(PROTO, 'build-workflow.mjs');
const WORKFLOW = join(PROTO, 'workflows', 'redanvil-full-build.json');
const ERRORS = join(PROTO, 'workflows', 'redanvil-errors.json');
const DISPATCH = join(PROTO, 'dispatch', 'dispatch.mjs');
const REGISTER = join(PROTO, 'dispatch', 'register-gate.mjs');
const SWEEP = join(PROTO, 'dispatch', 'sweep-orphans.mjs');
const WRITE_ALERT = join(PROTO, 'dispatch', 'write-alert.mjs');
const NODE = process.execPath;

/** @type {string[]} */
const scratchDirs = [];

after(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * @returns {string} a temp directory removed after the suite
 */
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-gates-'));
  scratchDirs.push(dir);
  return dir;
}

/**
 * @param {string} root directory
 * @param {string} rel relative path
 * @param {string | Buffer} body contents
 */
function put(root, rel, body) {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
}

/**
 * Async spawn. Tests that also host an HTTP server cannot use spawnSync:
 * the sync spawn blocks the event loop, so the server never answers.
 * @param {string[]} args argv after node
 * @param {{ env?: NodeJS.ProcessEnv, cwd?: string }} [options]
 * @returns {Promise<{ status: number | null, stdout: string, stderr: string }>}
 */
function spawnAsync(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(NODE, args, {
      env: options.env ?? process.env,
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    /** @type {Buffer[]} */
    const out = [];
    /** @type {Buffer[]} */
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (status) => {
      resolve({
        status,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8')
      });
    });
  });
}

/**
 * Run the generator. Restores both workflow files afterwards.
 * @param {Record<string, string | undefined>} flags env overrides. undefined deletes the key
 * @returns {ReturnType<typeof spawnSync>}
 */
function generate(flags) {
  const env = { ...process.env };
  delete env.REDANVIL_AUTO_GATES;
  delete env.REDANVIL_TELEGRAM;
  for (const [key, value] of Object.entries(flags)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return spawnSync(NODE, [BUILD], { encoding: 'utf8', env, cwd: ROOT });
}

/**
 * @returns {{ build: Buffer, errors: Buffer }} bytes to restore
 */
function snapshotWorkflows() {
  return {
    build: readFileSync(WORKFLOW),
    errors: existsSync(ERRORS) ? readFileSync(ERRORS) : Buffer.alloc(0)
  };
}

/**
 * @param {{ build: Buffer, errors: Buffer }} snap snapshot from snapshotWorkflows
 */
function restoreWorkflows(snap) {
  writeFileSync(WORKFLOW, snap.build);
  if (snap.errors.length) writeFileSync(ERRORS, snap.errors);
}

/**
 * @param {import('node:fs').PathOrFileDescriptor extends never ? never : object} workflow parsed workflow
 * @param {string} name node name
 * @param {number} [outputIndex] which output
 * @returns {string[]}
 */
function targets(workflow, name, outputIndex = 0) {
  const main = workflow.connections[name]?.main ?? [];
  return (main[outputIndex] ?? []).map((edge) => edge.node);
}

/**
 * @param {string} contentType multipart content-type header
 * @param {Buffer} body raw body
 * @returns {Record<string, string>}
 */
function parseMultipart(contentType, body) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType));
  assert.ok(match, `no multipart boundary in ${contentType}`);
  const boundary = match[1] || match[2];
  const text = body.toString('utf8');
  /** @type {Record<string, string>} */
  const fields = {};
  for (const part of text.split(`--${boundary}`).slice(1)) {
    if (part.startsWith('--')) continue;
    const splitAt = part.indexOf('\r\n\r\n');
    if (splitAt < 0) continue;
    const headers = part.slice(0, splitAt);
    let value = part.slice(splitAt + 4);
    if (value.endsWith('\r\n')) value = value.slice(0, -2);
    const name = /name="([^"]*)"/.exec(headers)?.[1];
    if (name) fields[name] = value;
  }
  return fields;
}

/**
 * @param {import('node:http').RequestListener} handler request handler
 * @returns {Promise<{ server: import('node:http').Server, url: string }>}
 */
function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

describe('wait limit parameter', () => {
  test('production default stays 2 hours and a caller can ask for 1 minute', () => {
    const step = { id: 'logo', summary: 'Five real generated brand marks, a gallery, and an OPEN decision' };
    const production = approvalNode(step, 0);
    assert.equal(production.parameters.resumeAmount, DEFAULT_GATE_WAIT.amount);
    assert.equal(production.parameters.resumeUnit, DEFAULT_GATE_WAIT.unit);
    assert.equal(production.parameters.resumeAmount, 2);
    assert.equal(production.parameters.resumeUnit, 'hours');
    const proof = approvalNode(step, 0, { amount: 1, unit: 'minutes' });
    assert.equal(proof.parameters.resumeAmount, 1);
    assert.equal(proof.parameters.resumeUnit, 'minutes');
    assert.equal(proof.parameters.resume, 'form');
    assert.equal(proof.parameters.limitWaitTime, true);
  });

  test('the live proof workflow is one logo gate with markers instead of a role loop', () => {
    const workflow = buildLiveGateWorkflow();
    assert.equal(workflow.settings.errorWorkflow, 'redanvilErrors001');
    const wait = workflow.nodes.find((node) => node.name === 'Owner approves: logo');
    assert.equal(wait.type, 'n8n-nodes-base.wait');
    assert.equal(wait.parameters.resumeAmount, 1);
    assert.equal(wait.parameters.resumeUnit, 'minutes');
    assert.deepEqual(targets(workflow, 'Register gate: logo'), ['Owner approves: logo']);
    assert.deepEqual(targets(workflow, 'Owner approves: logo'), ['If: logo form submitted']);
    assert.deepEqual(targets(workflow, 'If: logo form submitted', 0), ['If: logo approved']);
    assert.deepEqual(targets(workflow, 'If: logo form submitted', 1), ['Prepare timeout: logo']);
    assert.deepEqual(targets(workflow, 'If: logo approved', 0), ['Prepare marker A']);
    assert.deepEqual(targets(workflow, 'Prepare marker A'), ['Write marker A']);
    assert.deepEqual(targets(workflow, 'If: logo approved', 1), ['Count cycles: logo']);
    assert.deepEqual(targets(workflow, 'Count cycles: logo'), ['Prepare marker R']);
    assert.deepEqual(targets(workflow, 'Prepare marker R'), ['Write marker R']);
    assert.deepEqual(targets(workflow, 'Prepare timeout: logo'), ['Resolve timeout: logo']);
    assert.deepEqual(targets(workflow, 'Resolve timeout: logo'), ['Prepare marker T']);
    assert.deepEqual(targets(workflow, 'Prepare marker T'), ['Write marker T']);
    assert.deepEqual(targets(workflow, 'Fail via webhook'), ['Stop: forced failure']);
    const names = new Set(workflow.nodes.map((node) => node.name));
    assert.equal(names.has('logo params'), false);
    assert.equal(names.has('layout params'), false);
    const register = workflow.nodes.find((node) => node.name === 'Prepare gate: logo');
    assert.match(register.parameters.jsCode, /register-gate\.mjs/);
    assert.match(register.parameters.jsCode, /\$execution\.resumeFormUrl/);
    const timeout = workflow.nodes.find((node) => node.name === 'Prepare timeout: logo');
    assert.match(timeout.parameters.jsCode, /resolve-timeout\.mjs/);
    const cycle = workflow.nodes.find((node) => node.name === 'Count cycles: logo');
    assert.match(cycle.parameters.jsCode, /\$execution\.customData/);
  });
});

describe('generator gates', () => {
  test('each gate is Register, Wait of 2h, then an If with approve, redo, and timeout', () => {
    const snap = snapshotWorkflows();
    try {
      const run = generate({});
      assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
      const workflow = JSON.parse(readFileSync(WORKFLOW, 'utf8'));
      const errors = JSON.parse(readFileSync(ERRORS, 'utf8'));
      assert.equal(workflow.settings.errorWorkflow, 'redanvilErrors001');
      assert.equal(errors.id, 'redanvilErrors001');
      assert.ok(errors.nodes.some((node) => node.type === 'n8n-nodes-base.errorTrigger'));
      assert.ok(errors.nodes.some((node) => node.type === 'n8n-nodes-base.executeCommand'));
      assert.equal(workflow.nodes.some((node) => node.type === 'n8n-nodes-base.telegram'), false);

      const next = { logo: 'palette params', palette: 'layout params', layout: 'decide params', decide: 'integration params' };
      for (const id of ['logo', 'palette', 'layout', 'decide']) {
        assert.deepEqual(targets(workflow, `Register gate: ${id}`), [`Owner approves: ${id}`]);
        const wait = workflow.nodes.find((node) => node.name === `Owner approves: ${id}`);
        assert.equal(wait.type, 'n8n-nodes-base.wait');
        assert.equal(wait.parameters.resume, 'form');
        assert.equal(wait.parameters.limitWaitTime, true);
        assert.equal(wait.parameters.limitType, 'afterTimeInterval');
        assert.equal(wait.parameters.resumeAmount, 2);
        assert.equal(wait.parameters.resumeUnit, 'hours');
        assert.deepEqual(targets(workflow, `Owner approves: ${id}`), [`If: ${id} form submitted`]);
        const formIf = workflow.nodes.find((node) => node.name === `If: ${id} form submitted`);
        assert.equal(formIf.type, 'n8n-nodes-base.if');
        assert.equal(formIf.parameters.conditions.conditions.length, 1);
        assert.deepEqual(targets(workflow, `If: ${id} form submitted`, 0), [`If: ${id} approved`]);
        assert.deepEqual(targets(workflow, `If: ${id} form submitted`, 1), [`Prepare timeout: ${id}`]);
        assert.deepEqual(targets(workflow, `If: ${id} approved`, 0), [next[id]]);
        assert.deepEqual(targets(workflow, `If: ${id} approved`, 1), [`Count cycles: ${id}`]);
      }
    } finally {
      restoreWorkflows(snap);
    }
  });

  test('redo edge points at the reworkTo step params node, and the cycle guard can stop the loop', () => {
    const snap = snapshotWorkflows();
    try {
      const run = generate({});
      assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
      const workflow = JSON.parse(readFileSync(WORKFLOW, 'utf8'));
      // decide.reworkTo is layout. A generator that ignores redo never emits this edge.
      assert.deepEqual(targets(workflow, 'If: decide cycles exceeded', 1), ['layout params']);
      assert.deepEqual(targets(workflow, 'If: decide cycles exceeded', 0), ['Stop: decide max cycles']);
      // No reworkTo: the gate loops to its own producing step.
      assert.deepEqual(targets(workflow, 'If: logo cycles exceeded', 1), ['logo params']);
      const stop = workflow.nodes.find((node) => node.name === 'Stop: decide max cycles');
      assert.equal(stop.type, 'n8n-nodes-base.stopAndError');
      assert.match(stop.parameters.errorMessage, /maxCycles \(5\)/);
      const cycle = workflow.nodes.find((node) => node.name === 'Count cycles: decide');
      assert.match(cycle.parameters.jsCode, /\$execution\.customData/);
      assert.match(cycle.parameters.jsCode, /const max = 5/);
      assert.match(cycle.parameters.jsCode, /gateExceeded: used > max/);
      const logoCycle = workflow.nodes.find((node) => node.name === 'Count cycles: logo');
      assert.match(logoCycle.parameters.jsCode, /const max = 3/);
    } finally {
      restoreWorkflows(snap);
    }
  });

  test('telegram is absent by default and present when REDANVIL_TELEGRAM=1', () => {
    const snap = snapshotWorkflows();
    try {
      const off = generate({});
      assert.equal(off.status, 0, off.stderr);
      const plain = JSON.parse(readFileSync(WORKFLOW, 'utf8'));
      assert.equal(plain.nodes.some((node) => node.type === 'n8n-nodes-base.telegram'), false);

      const on = generate({ REDANVIL_TELEGRAM: '1' });
      assert.equal(on.status, 0, on.stderr);
      const flagged = JSON.parse(readFileSync(WORKFLOW, 'utf8'));
      const notify = flagged.nodes.find((node) => node.name === 'Notify: logo needs approval');
      assert.equal(notify.type, 'n8n-nodes-base.telegram');
      assert.equal(notify.onError, 'continueRegularOutput');
      assert.match(notify.parameters.text, /needs a decision/i);
    } finally {
      restoreWorkflows(snap);
    }
  });

  test('REDANVIL_AUTO_GATES=1 still skips the Wait and emits auto-decide', () => {
    const snap = snapshotWorkflows();
    try {
      const run = generate({ REDANVIL_AUTO_GATES: '1' });
      assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
      assert.match(run.stdout, /auto gates:\s*on/i);
      const workflow = JSON.parse(readFileSync(WORKFLOW, 'utf8'));
      const names = workflow.nodes.map((node) => node.name);
      assert.ok(names.includes('auto-logo params'));
      assert.ok(names.includes('Role: auto-logo'));
      assert.equal(workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.wait').length, 0);
      assert.equal(names.includes('Register gate: logo'), false);
      assert.equal(names.includes('Owner approves: logo'), false);
    } finally {
      restoreWorkflows(snap);
    }
  });
});

describe('register-gate', () => {
  test('writes a contract-valid pending gate and ignores non-option files', () => {
    const repo = scratch();
    put(repo, 'pet-sitter/design-refs/logos/mark-01.png', Buffer.from('png-bytes'));
    put(repo, 'pet-sitter/design-refs/logos/gallery.html', '<p>gallery</p>');
    put(repo, 'pet-sitter/design-refs/logos/DECISION.md', 'not an option');
    put(repo, 'pet-sitter/design-refs/logos/raw/scratch.png', Buffer.from('nope'));
    const payload = Buffer.from(
      JSON.stringify({
        slug: 'pet-sitter',
        step: 'logo',
        title: 'Approve logo',
        summary: 'Five real generated brand marks',
        resumeUrl: 'http://127.0.0.1:5678/form-waiting/9?signature=abc',
        executionId: '9'
      })
    ).toString('base64');
    const run = spawnSync(NODE, [REGISTER, `--payloadB64=${payload}`, `--repoRoot=${repo}`], {
      encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    const record = JSON.parse(readFileSync(join(repo, '.redanvil/dispatch/pending/pet-sitter-logo-9.json'), 'utf8'));
    assert.equal(record.id, 'pet-sitter-logo-9');
    assert.equal(record.kind, 'gate');
    assert.equal(record.slug, 'pet-sitter');
    assert.equal(record.onTimeout, 'auto-decide');
    assert.equal(record.resume.type, 'n8n-form');
    assert.equal(record.resume.url, 'http://127.0.0.1:5678/form-waiting/9?signature=abc');
    assert.equal(new Date(record.expiresAt).getTime() - new Date(record.createdAt).getTime(), 2 * 60 * 60 * 1000);
    assert.match(record.id, /^[a-z0-9-]+$/);
    const paths = record.options.map((option) => option.path).sort();
    assert.deepEqual(paths, [
      'pet-sitter/design-refs/logos/gallery.html',
      'pet-sitter/design-refs/logos/mark-01.png'
    ]);
  });

  test('a payload with no resume URL exits non-zero and writes nothing', () => {
    const repo = scratch();
    const payload = Buffer.from(
      JSON.stringify({
        slug: 'pet-sitter',
        step: 'logo',
        title: 'Approve logo',
        summary: 'x',
        executionId: '1'
      })
    ).toString('base64');
    const run = spawnSync(NODE, [REGISTER, `--payloadB64=${payload}`, `--repoRoot=${repo}`], {
      encoding: 'utf8'
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /resumeUrl/);
    assert.equal(existsSync(join(repo, '.redanvil')), false);
  });
});

describe('dispatch resolve and gallery', () => {
  test('resolve posts field-0 and field-1 and keeps notes byte-identical', async () => {
    const notes = '"; & | %';
    /** @type {{ method: string, url: string, type: string, fields: Record<string, string> }[]} */
    const hits = [];
    const { server, url } = await listen(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const type = String(req.headers['content-type'] ?? '');
      hits.push({
        method: req.method ?? '',
        url: req.url ?? '',
        type,
        fields: parseMultipart(type, body)
      });
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('ok');
    });
    try {
      const repo = scratch();
      const id = 'pet-sitter-logo-4';
      const resumeUrl = `${url}/form-waiting/4?signature=tok%2Ben`;
      put(
        repo,
        `.redanvil/dispatch/pending/${id}.json`,
        JSON.stringify({
          id,
          kind: 'gate',
          createdAt: '2026-09-23T00:00:00.000Z',
          expiresAt: '2026-09-23T02:00:00.000Z',
          slug: 'pet-sitter',
          title: 'Approve logo',
          summary: 'pick a mark',
          options: [],
          resume: { type: 'n8n-form', url: resumeUrl },
          onTimeout: 'auto-decide'
        })
      );
      const result = await spawnAsync([
        DISPATCH,
        'resolve',
        id,
        'approve',
        '--notes',
        notes,
        `--repoRoot=${repo}`
      ]);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.equal(hits.length, 1);
      assert.equal(hits[0].method, 'POST');
      assert.equal(hits[0].url, '/form-waiting/4?signature=tok%2Ben');
      assert.match(hits[0].type, /^multipart\/form-data/i);
      assert.equal(hits[0].fields['field-0'], 'approve');
      assert.equal(hits[0].fields['field-1'], notes);
      assert.equal(existsSync(join(repo, `.redanvil/dispatch/pending/${id}.json`)), false);
      const resolved = JSON.parse(readFileSync(join(repo, `.redanvil/dispatch/resolved/${id}.json`), 'utf8'));
      assert.equal(resolved.decision, 'approve');
      assert.equal(resolved.notes, notes);
      assert.equal(resolved.resolvedBy, 'owner');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('reject is not valid for a gate and does not post or resolve', async () => {
    /** @type {string[]} */
    const methods = [];
    const { server, url } = await listen((req, res) => {
      methods.push(req.method ?? '');
      res.writeHead(200);
      res.end('no');
    });
    try {
      const repo = scratch();
      const id = 'pet-sitter-logo-5';
      const pending = {
        id,
        kind: 'gate',
        createdAt: '2026-09-23T00:00:00.000Z',
        expiresAt: '2026-09-23T02:00:00.000Z',
        slug: 'pet-sitter',
        title: 'Approve logo',
        summary: 'pick',
        options: [],
        resume: { type: 'n8n-form', url: `${url}/form-waiting/5?signature=z` },
        onTimeout: 'auto-decide'
      };
      put(repo, `.redanvil/dispatch/pending/${id}.json`, JSON.stringify(pending));
      const result = await spawnAsync([DISPATCH, 'resolve', id, 'reject', `--repoRoot=${repo}`]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /reject/);
      assert.equal(methods.length, 0);
      assert.equal(existsSync(join(repo, `.redanvil/dispatch/resolved/${id}.json`)), false);
      assert.equal(existsSync(join(repo, `.redanvil/dispatch/pending/${id}.json`)), true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('a failed form post leaves the pending record in place', async () => {
    const { server, url } = await listen((_req, res) => {
      res.writeHead(500);
      res.end('no');
    });
    try {
      const repo = scratch();
      const id = 'pet-sitter-logo-6';
      put(
        repo,
        `.redanvil/dispatch/pending/${id}.json`,
        JSON.stringify({
          id,
          kind: 'gate',
          createdAt: '2026-09-23T00:00:00.000Z',
          expiresAt: null,
          slug: 'pet-sitter',
          title: 'Approve logo',
          summary: 'pick',
          options: [],
          resume: { type: 'n8n-form', url: `${url}/form-waiting/6?signature=z` },
          onTimeout: 'auto-decide'
        })
      );
      const result = await spawnAsync([DISPATCH, 'resolve', id, 'redo', `--repoRoot=${repo}`]);
      assert.notEqual(result.status, 0);
      assert.equal(existsSync(join(repo, `.redanvil/dispatch/pending/${id}.json`)), true);
      assert.equal(existsSync(join(repo, `.redanvil/dispatch/resolved/${id}.json`)), false);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('job-approval resolve writes the record and does not call n8n', async () => {
    /** @type {number} */
    let hits = 0;
    const { server } = await listen((_req, res) => {
      hits += 1;
      res.writeHead(200);
      res.end('no');
    });
    try {
      const repo = scratch();
      const id = 'job-12';
      put(
        repo,
        `.redanvil/dispatch/pending/${id}.json`,
        JSON.stringify({
          id,
          kind: 'job-approval',
          createdAt: '2026-09-23T00:00:00.000Z',
          expiresAt: null,
          slug: 'pet-sitter',
          title: 'Build pet-sitter',
          summary: 'queued job',
          options: [],
          resume: { type: 'job', jobId: '12' },
          onTimeout: null
        })
      );
      const result = await spawnAsync([DISPATCH, 'resolve', id, 'approve', `--repoRoot=${repo}`]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(hits, 0);
      const resolved = JSON.parse(readFileSync(join(repo, `.redanvil/dispatch/resolved/${id}.json`), 'utf8'));
      assert.equal(resolved.decision, 'approve');
      assert.equal(resolved.resolvedBy, 'owner');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('gallery embeds an image and refuses a page over 15MB', () => {
    const repo = scratch();
    const id = 'pet-sitter-logo-7';
    put(repo, 'pet-sitter/design-refs/logos/mark-01.png', Buffer.from('tiny-png'));
    put(
      repo,
      `.redanvil/dispatch/pending/${id}.json`,
      JSON.stringify({
        id,
        kind: 'gate',
        createdAt: '2026-09-23T00:00:00.000Z',
        expiresAt: '2026-09-23T02:00:00.000Z',
        slug: 'pet-sitter',
        title: 'Approve logo',
        summary: 'pick a mark',
        options: [{ label: 'logos/mark-01', path: 'pet-sitter/design-refs/logos/mark-01.png' }],
        resume: { type: 'n8n-form', url: 'http://127.0.0.1/form-waiting/7?signature=z' },
        onTimeout: 'auto-decide'
      })
    );
    const smallOut = join(repo, 'small.html');
    const small = spawnSync(NODE, [DISPATCH, 'gallery', id, '--out', smallOut, `--repoRoot=${repo}`], {
      encoding: 'utf8'
    });
    assert.equal(small.status, 0, small.stderr);
    const html = readFileSync(smallOut, 'utf8');
    assert.match(html, /background:\s*#121212/);
    assert.match(html, /1\.\s*logos\/mark-01/);
    assert.match(html, /data:image\/png;base64,/);

    const huge = Buffer.alloc(12 * 1024 * 1024, 7);
    put(repo, 'pet-sitter/design-refs/logos/mark-huge.png', huge);
    const hugeId = 'pet-sitter-logo-8';
    put(
      repo,
      `.redanvil/dispatch/pending/${hugeId}.json`,
      JSON.stringify({
        id: hugeId,
        kind: 'gate',
        createdAt: '2026-09-23T00:00:00.000Z',
        expiresAt: '2026-09-23T02:00:00.000Z',
        slug: 'pet-sitter',
        title: 'Approve logo',
        summary: 'too big',
        options: [{ label: 'logos/mark-huge', path: 'pet-sitter/design-refs/logos/mark-huge.png' }],
        resume: { type: 'n8n-form', url: 'http://127.0.0.1/form-waiting/8?signature=z' },
        onTimeout: 'auto-decide'
      })
    );
    const hugeOut = join(repo, 'huge.html');
    const refused = spawnSync(
      NODE,
      [DISPATCH, 'gallery', hugeId, '--out', hugeOut, `--repoRoot=${repo}`],
      { encoding: 'utf8' }
    );
    assert.notEqual(refused.status, 0);
    assert.ok(refused.stderr.includes(String(GALLERY_MAX_BYTES)), refused.stderr);
    assert.equal(existsSync(hugeOut), false);
  });

  test('ack moves an alert and list --json reports pending, alerts, and in-flight jobs', () => {
    const repo = scratch();
    put(
      repo,
      '.redanvil/dispatch/pending/pet-sitter-logo-1.json',
      JSON.stringify({ id: 'pet-sitter-logo-1', kind: 'gate', title: 'Approve logo' })
    );
    put(
      repo,
      '.redanvil/dispatch/alerts/alert-3.json',
      JSON.stringify({ id: 'alert-3', at: '2026-09-23T00:00:00.000Z', source: 'n8n:redanvilFull001', message: 'boom', ref: null })
    );
    put(repo, '.redanvil/dispatch/jobs/job-1.json', JSON.stringify({ id: 'job-1', status: 'building' }));
    put(repo, '.redanvil/dispatch/jobs/job-2.json', JSON.stringify({ id: 'job-2', status: 'done' }));
    const listed = spawnSync(NODE, [DISPATCH, 'list', '--json', `--repoRoot=${repo}`], { encoding: 'utf8' });
    assert.equal(listed.status, 0, listed.stderr);
    const body = JSON.parse(listed.stdout);
    assert.equal(body.pending.length, 1);
    assert.equal(body.alerts.length, 1);
    assert.deepEqual(body.jobs.map((job) => job.id), ['job-1']);
    const acked = spawnSync(NODE, [DISPATCH, 'ack', 'alert-3', `--repoRoot=${repo}`], { encoding: 'utf8' });
    assert.equal(acked.status, 0, acked.stderr);
    assert.equal(existsSync(join(repo, '.redanvil/dispatch/alerts/alert-3.json')), false);
    assert.equal(existsSync(join(repo, '.redanvil/dispatch/acked/alert-3.json')), true);
  });
});

describe('write-alert', () => {
  test('writes an alert and refuses a payload with no message', () => {
    const repo = scratch();
    const payload = Buffer.from(
      JSON.stringify({
        executionId: '15',
        source: 'n8n:redanvilFull001',
        message: 'role logo did not count as run',
        ref: 'http://127.0.0.1:5678/workflow/redanvilFull001/executions/15'
      })
    ).toString('base64');
    const run = spawnSync(NODE, [WRITE_ALERT, `--payloadB64=${payload}`, `--repoRoot=${repo}`], {
      encoding: 'utf8'
    });
    assert.equal(run.status, 0, run.stderr);
    const alert = JSON.parse(readFileSync(join(repo, '.redanvil/dispatch/alerts/alert-15.json'), 'utf8'));
    assert.equal(alert.id, 'alert-15');
    assert.equal(alert.source, 'n8n:redanvilFull001');
    assert.equal(alert.message, 'role logo did not count as run');
    assert.equal(alert.ref, 'http://127.0.0.1:5678/workflow/redanvilFull001/executions/15');
    assert.equal(typeof alert.at, 'string');

    const bad = Buffer.from(JSON.stringify({ executionId: '16', source: 'n8n:x', ref: null })).toString('base64');
    const failed = spawnSync(NODE, [WRITE_ALERT, `--payloadB64=${bad}`, `--repoRoot=${repo}`], {
      encoding: 'utf8'
    });
    assert.notEqual(failed.status, 0);
    assert.equal(existsSync(join(repo, '.redanvil/dispatch/alerts/alert-16.json')), false);
  });
});

describe('sweep-orphans', () => {
  /**
   * @param {string} repo temp repo
   * @param {boolean} apply whether to pass --apply
   * @returns {Promise<{ status: number | null, stdout: string, stderr: string, posts: string[], pending: string }>}
   */
  async function runSweep(repo, apply) {
    const now = Date.now();
    const old = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now - 60 * 60 * 1000).toISOString();
    /** @type {string[]} */
    const posts = [];
    const rows = {
      waiting: [
        { id: '50', status: 'waiting', workflowId: 'redanvilFull001', startedAt: recent },
        { id: '49', status: 'waiting', workflowId: 'redanvilFull001', startedAt: recent }
      ],
      running: [{ id: '30', status: 'running', workflowId: 'redanvilFull001', startedAt: old }],
      new: [{ id: '31', status: 'new', workflowId: 'redanvilFull001', startedAt: recent }]
    };
    const { server, url } = await listen((req, res) => {
      const requestUrl = new URL(req.url ?? '/', url);
      if (req.method === 'POST' && requestUrl.pathname.endsWith('/stop')) {
        posts.push(requestUrl.pathname);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
        return;
      }
      const status = requestUrl.searchParams.get('status');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: rows[status] ?? [], nextCursor: null }));
    });
    const pendingPath = join(repo, '.redanvil/dispatch/pending/pet-sitter-logo-49.json');
    const pendingBody = JSON.stringify({
      id: 'pet-sitter-logo-49',
      kind: 'gate',
      resume: { type: 'n8n-form', url: `${url}/form-waiting/49?signature=keep` }
    });
    put(repo, '.redanvil/dispatch/pending/pet-sitter-logo-49.json', pendingBody);
    const args = [SWEEP, `--baseUrl=${url}`, `--repoRoot=${repo}`];
    if (apply) args.push('--apply');
    try {
      const result = await spawnAsync(args, {
        env: { ...process.env, N8N_API_KEY: 'test-key-not-printed' }
      });
      return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        posts,
        pending: readFileSync(pendingPath, 'utf8')
      };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  test('dry-run lists orphans and changes nothing', async () => {
    const repo = scratch();
    const result = await runSweep(repo, false);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(result.posts.length, 0);
    assert.match(result.stdout, /dry-run 50/);
    assert.match(result.stdout, /dry-run 30/);
    assert.doesNotMatch(result.stdout, /dry-run 49/);
    assert.doesNotMatch(result.stdout, /dry-run 31/);
    assert.doesNotMatch(result.stdout, /test-key-not-printed/);
    assert.match(result.pending, /signature=keep/);
  });

  test('--apply posts stop for the same orphans the dry-run only printed', async () => {
    const repo = scratch();
    const result = await runSweep(repo, true);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(result.posts.sort(), ['/api/v1/executions/30/stop', '/api/v1/executions/50/stop']);
    assert.match(result.pending, /signature=keep/);
  });
});

describe('dispatch notified tracking and notes file', () => {
  test('list marks a pending record notified only after mark-notified, and it survives a new process', () => {
    const repo = scratch();
    const id = 'sushi-finder-logo-9';
    put(
      repo,
      `.redanvil/dispatch/pending/${id}.json`,
      JSON.stringify({
        id,
        kind: 'gate',
        createdAt: '2026-09-23T00:00:00.000Z',
        expiresAt: '2026-09-23T02:00:00.000Z',
        slug: 'sushi-finder',
        title: 'Approve logo',
        summary: 'pick a mark',
        options: [],
        resume: { type: 'n8n-form', url: 'http://127.0.0.1:1/form-waiting/9' },
        onTimeout: 'auto-decide'
      })
    );
    const list = () =>
      JSON.parse(
        spawnSync(process.execPath, [DISPATCH, 'list', '--json', `--repoRoot=${repo}`], {
          encoding: 'utf8'
        }).stdout
      );
    assert.equal(list().pending[0].notified, false);
    const marked = spawnSync(process.execPath, [DISPATCH, 'mark-notified', id, `--repoRoot=${repo}`], {
      encoding: 'utf8'
    });
    assert.equal(marked.status, 0, marked.stderr);
    assert.equal(list().pending[0].notified, true);
  });

  test('resolve --notes-file posts the file bytes unchanged', async () => {
    const notes = 'logo 3 "the sharp one" & palette B -- 100% sure\nsecond line';
    /** @type {string[]} */
    const bodies = [];
    const { url, close } = await new Promise((resolveServer) => {
      const server = createServer((req, res) => {
        let raw = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
          raw += chunk;
        });
        req.on('end', () => {
          bodies.push(raw);
          res.writeHead(200);
          res.end('ok');
        });
      });
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        resolveServer({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
      });
    });
    try {
      const repo = scratch();
      const id = 'sushi-finder-logo-10';
      put(
        repo,
        `.redanvil/dispatch/pending/${id}.json`,
        JSON.stringify({
          id,
          kind: 'gate',
          createdAt: '2026-09-23T00:00:00.000Z',
          expiresAt: '2026-09-23T02:00:00.000Z',
          slug: 'sushi-finder',
          title: 'Approve logo',
          summary: 'pick a mark',
          options: [],
          resume: { type: 'n8n-form', url: `${url}/form-waiting/10?signature=x` },
          onTimeout: 'auto-decide'
        })
      );
      put(repo, 'notes.txt', notes);
      const result = await spawnAsync([
        DISPATCH,
        'resolve',
        id,
        'approve',
        '--notes-file',
        join(repo, 'notes.txt'),
        `--repoRoot=${repo}`
      ]);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      // multipart/form-data normalises line breaks to CRLF (HTML form encoding
      // rules), so the POSTed field is the file bytes with LF turned into CRLF;
      // the resolved record keeps the bytes exactly.
      const crlfNotes = notes.split('\n').join('\r\n');
      assert.ok(bodies[0].includes(crlfNotes), 'form body carries the notes file bytes');
      const resolved = JSON.parse(
        readFileSync(join(repo, '.redanvil/dispatch/resolved', `${id}.json`), 'utf8')
      );
      assert.equal(resolved.notes, notes);
    } finally {
      close();
    }
  });
});
