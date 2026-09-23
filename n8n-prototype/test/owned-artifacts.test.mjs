/**
 * A step is counted for the artifact it writes, and no two steps own the same path.
 *
 * The pre-fix map is a temp copy. The live process-map.mjs is not edited by
 * these tests. A check that cannot fail is not a check: the pre-fix copy must
 * report the shared DECISION.md paths, and a role-run that only rewrites an
 * input must not count.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { checkContract } from '../contract-check.mjs';
import { PROCESS, countedArtifactPath, sharedOwnedArtifactPaths } from '../process-map.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROLE_RUN = join(HERE, '..', 'role-run.mjs');
const DECIDE = join(HERE, '..', 'roles', 'decide.mjs');
const NODE = process.execPath;

/**
 * decide's contract before evidence/decisions.json existed. requires[0] is the
 * file the layout step writes, which is the path role-run hashed.
 * @type {import('../process-map.mjs').ArtifactContract[]}
 */
const PRE_FIX_DECIDE_REQUIRES = [
  {
    path: 'design-refs/design-options/DECISION.md',
    kind: 'file',
    minBytes: 600,
    mustContain: ['DECIDED'],
    why: 'the build must read a recorded choice, never infer one'
  },
  {
    path: 'design-refs/logos/DECISION.md',
    kind: 'file',
    minBytes: 300,
    mustContain: ['CHOSEN'],
    why: 'the chosen mark must be named in writing, or a later worktree ships whatever it finds'
  },
  {
    path: 'design-refs/palettes/DECISION.md',
    kind: 'file',
    minBytes: 400,
    mustContain: ['CHOSEN'],
    why: 'the palette must be a recorded owner choice, never a default carried over from whichever layout option happened to win'
  }
];

/**
 * Quote one argv token for cmd.exe. Paths under Program Files contain spaces.
 * @param {string} arg
 * @returns {string}
 */
function quote(arg) {
  if (!/[\s"]/.test(arg)) return arg;
  return `"${arg.replaceAll('"', '')}"`;
}

/**
 * Write a file, creating parents.
 * @param {string} root
 * @param {string} rel
 * @param {string} body
 */
function put(root, rel, body) {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
}

/**
 * A decision document large enough for its contract, with one real marker line.
 * @param {string} token CHOSEN or DECIDED, or a word that is neither
 * @param {number} minBytes
 * @returns {string}
 */
function decisionBody(token, minBytes) {
  let body = `${token}: option-a\n\nOwner recorded this choice.\n`;
  while (Buffer.byteLength(body) < minBytes) {
    body += 'The other candidates were reviewed and not picked.\n';
  }
  return body;
}

/**
 * Run role-run.mjs for the decide role. `artifacts` is whatever the workflow
 * would pass; the map's owned path is what has to be fingerprinted.
 * @param {string} repoRoot
 * @param {string} cmd
 * @param {string} artifacts
 * @returns {{status: number|null, stdout: string, stderr: string, verdict: {countedAsRun?: boolean, reasons?: string[], artifactDir?: string}|null}}
 */
function runRole(repoRoot, cmd, artifacts) {
  const r = spawnSync(
    NODE,
    [
      ROLE_RUN,
      '--role=user-picks',
      `--cmd=${cmd}`,
      `--artifacts=${artifacts}`,
      `--repoRoot=${repoRoot}`
    ],
    { encoding: 'utf8', timeout: 30_000 }
  );
  /** @type {{countedAsRun?: boolean, reasons?: string[], artifactDir?: string}|null} */
  let verdict = null;
  try {
    verdict = JSON.parse(String(r.stdout ?? ''));
  } catch {
    verdict = null;
  }
  return {
    status: r.status,
    stdout: String(r.stdout ?? ''),
    stderr: String(r.stderr ?? ''),
    verdict
  };
}

/**
 * Three decision files that satisfy decide's input contracts.
 * @param {string} app absolute app directory
 */
function writeValidInputs(app) {
  put(app, 'design-refs/design-options/DECISION.md', decisionBody('DECIDED', 600));
  put(app, 'design-refs/logos/DECISION.md', decisionBody('CHOSEN', 300));
  put(app, 'design-refs/palettes/DECISION.md', decisionBody('CHOSEN', 400));
}

describe('owned artifact paths', () => {
  test('the live map gives every owned path to one step, and decide counts decisions.json', () => {
    const shared = sharedOwnedArtifactPaths(PROCESS);
    assert.deepEqual(shared, []);
    const decide = PROCESS.find((s) => s.id === 'decide');
    assert.ok(decide);
    assert.equal(countedArtifactPath(decide), 'evidence/decisions.json');
    const inputs = decide.requires.filter((c) => c.input === true).map((c) => c.path);
    assert.deepEqual(inputs, [
      'design-refs/design-options/DECISION.md',
      'design-refs/logos/DECISION.md',
      'design-refs/palettes/DECISION.md'
    ]);
  });

  test('FAIL INPUT: the pre-fix decide contract shares DECISION.md with the steps that write them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pre-fix-map-'));
    try {
      const mutated = structuredClone(PROCESS);
      const decide = mutated.find((s) => s.id === 'decide');
      assert.ok(decide);
      decide.requires = PRE_FIX_DECIDE_REQUIRES;
      const copyPath = join(dir, 'pre-fix-steps.json');
      writeFileSync(copyPath, JSON.stringify(mutated));
      const loaded = JSON.parse(readFileSync(copyPath, 'utf8'));
      const shared = sharedOwnedArtifactPaths(loaded);
      const layout = shared.find((s) => s.path === 'design-refs/design-options/DECISION.md');
      assert.ok(layout, `expected the layout collision, got ${JSON.stringify(shared)}`);
      assert.deepEqual(layout.steps, ['layout', 'decide']);
      const logo = shared.find((s) => s.path === 'design-refs/logos/DECISION.md');
      assert.ok(logo);
      assert.deepEqual(logo.steps, ['logo', 'decide']);
      const palette = shared.find((s) => s.path === 'design-refs/palettes/DECISION.md');
      assert.ok(palette);
      assert.deepEqual(palette.steps, ['palette', 'decide']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('role-run counts decide for decisions.json', () => {
  test('FAIL INPUT: exit 0 and a changed decisions.json still fail when DECIDED is absent', () => {
    const repo = mkdtempSync(join(tmpdir(), 'decide-bad-input-'));
    const slug = 'app';
    const app = join(repo, slug);
    try {
      put(app, 'design-refs/design-options/DECISION.md', decisionBody('OPEN', 600));
      put(app, 'design-refs/logos/DECISION.md', decisionBody('CHOSEN', 300));
      put(app, 'design-refs/palettes/DECISION.md', decisionBody('CHOSEN', 400));
      const writer = join(repo, 'write-stub.mjs');
      const target = join(app, 'evidence', 'decisions.json');
      writeFileSync(
        writer,
        `import { mkdirSync, writeFileSync } from 'node:fs';\n` +
          `import { dirname } from 'node:path';\n` +
          `mkdirSync(dirname(${JSON.stringify(target)}), { recursive: true });\n` +
          `writeFileSync(${JSON.stringify(target)}, ${JSON.stringify('x'.repeat(800))});\n`
      );
      const r = runRole(
        repo,
        `${quote(NODE)} ${quote(writer)}`,
        `${slug}/design-refs/design-options/DECISION.md`
      );
      assert.ok(r.verdict, r.stdout + '\n' + r.stderr);
      assert.equal(r.verdict.countedAsRun, false, JSON.stringify(r.verdict));
      assert.ok(
        r.verdict.reasons?.some(
          (reason) => /design-options\/DECISION\.md/.test(reason) && /DECIDED/.test(reason)
        ),
        JSON.stringify(r.verdict.reasons)
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('FAIL INPUT: a changed file that is not a decision record does not count', () => {
    const repo = mkdtempSync(join(tmpdir(), 'decide-stub-json-'));
    const slug = 'app';
    const app = join(repo, slug);
    try {
      writeValidInputs(app);
      const writer = join(repo, 'write-stub.mjs');
      const target = join(app, 'evidence', 'decisions.json');
      writeFileSync(
        writer,
        `import { mkdirSync, writeFileSync } from 'node:fs';\n` +
          `import { dirname } from 'node:path';\n` +
          `mkdirSync(dirname(${JSON.stringify(target)}), { recursive: true });\n` +
          `writeFileSync(${JSON.stringify(target)}, ${JSON.stringify('x'.repeat(800))});\n`
      );
      const r = runRole(repo, `${quote(NODE)} ${quote(writer)}`, `${slug}/evidence/decisions.json`);
      assert.ok(r.verdict, r.stdout + '\n' + r.stderr);
      assert.equal(r.verdict.countedAsRun, false, JSON.stringify(r.verdict));
      assert.ok(
        r.verdict.reasons?.some(
          (reason) => /decisions\.json/.test(reason) && /recordedAt/.test(reason)
        ),
        JSON.stringify(r.verdict.reasons)
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('FAIL INPUT: rewriting layout DECISION.md does not count when decisions.json is unchanged', () => {
    const repo = mkdtempSync(join(tmpdir(), 'decide-touch-input-'));
    const slug = 'app';
    const app = join(repo, slug);
    try {
      writeValidInputs(app);
      const seed = spawnSync(NODE, [DECIDE, `--slug=${slug}`, `--repoRoot=${repo}`], {
        encoding: 'utf8',
        timeout: 20_000
      });
      assert.equal(seed.status, 0, seed.stderr || seed.stdout);
      const rewriter = join(repo, 'touch-decision.mjs');
      const decision = join(app, 'design-refs', 'design-options', 'DECISION.md');
      writeFileSync(
        rewriter,
        `import { appendFileSync } from 'node:fs';\n` +
          `appendFileSync(${JSON.stringify(decision)}, '\\nA later note that is not a new decision.\\n');\n`
      );
      const r = runRole(
        repo,
        `${quote(NODE)} ${quote(rewriter)}`,
        `${slug}/design-refs/design-options/DECISION.md`
      );
      assert.ok(r.verdict, r.stdout + '\n' + r.stderr);
      assert.equal(r.verdict.countedAsRun, false, JSON.stringify(r.verdict));
      assert.equal(r.verdict.artifactDir, `${slug}/evidence/decisions.json`);
      assert.ok(
        r.verdict.reasons?.some(
          (reason) => /evidence\/decisions\.json/.test(reason) && /did nothing/.test(reason)
        ),
        JSON.stringify(r.verdict.reasons)
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('decide.mjs writes decisions.json and that change counts as a run', () => {
    const repo = mkdtempSync(join(tmpdir(), 'decide-real-'));
    const slug = 'app';
    const app = join(repo, slug);
    try {
      writeValidInputs(app);
      const cmd = [quote(NODE), quote(DECIDE), `--slug=${slug}`, `--repoRoot=${quote(repo)}`].join(
        ' '
      );
      const r = runRole(repo, cmd, `${slug}/design-refs/design-options/DECISION.md`);
      assert.ok(r.verdict, r.stdout + '\n' + r.stderr);
      assert.equal(r.verdict.countedAsRun, true, JSON.stringify(r.verdict));
      assert.equal(r.status, 0, r.stdout);
      const file = join(app, 'evidence', 'decisions.json');
      const size = statSync(file).size;
      assert.ok(size >= 512, `decisions.json is ${size}B`);
      const decide = PROCESS.find((s) => s.id === 'decide');
      const owned = decide?.requires.find((c) => c.owned === true);
      assert.ok(owned);
      const checked = checkContract(app, owned);
      assert.equal(checked.ok, true, checked.reasons.join('; '));
      const body = readFileSync(file, 'utf8');
      assert.match(body, /"axis": "logo"/);
      assert.match(body, /"axis": "palette"/);
      assert.match(body, /"axis": "layout"/);
      assert.match(body, /"sha256": "[a-f0-9]{64}"/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
