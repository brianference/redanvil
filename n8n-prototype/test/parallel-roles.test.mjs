/**
 * runTogether must overlap real processes, not just look parallel in the
 * workflow graph: n8n 2.22.6 with executionOrder v1 walks branches one at a
 * time, so this launcher is the only place the design roles can overlap.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { runTogether } from '../roles/parallel-roles.mjs';

/** How long each fake role sleeps. */
const ROLE_MS = 1500;

test('four real child processes overlap instead of running one after another', async () => {
  const jobs = ['brainstorm', 'logo', 'palette', 'layout'].map((id) => ({
    id,
    cmd: 'unused',
    artifacts: 'unused'
  }));
  // A real process per job, so this measures OS-level overlap, not a mock.
  const spawnJob = () =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', `setTimeout(() => {}, ${ROLE_MS})`], {
        shell: false
      });
      child.on('error', reject);
      child.on('close', (status) => resolve({ status, stdout: '', stderr: '' }));
    });
  const started = Date.now();
  const result = await runTogether(jobs, process.cwd(), { spawnJob });
  const elapsed = Date.now() - started;
  assert.equal(result.status, 0);
  const latestStart = Math.max(...result.roles.map((r) => Date.parse(r.startedAt)));
  const earliestEnd = Math.min(...result.roles.map((r) => Date.parse(r.endedAt)));
  assert.ok(latestStart < earliestEnd, 'every role started before any role finished');
  // Serial would take at least 4 x ROLE_MS.
  assert.ok(elapsed < 2 * ROLE_MS + 1000, `took ${elapsed}ms; serial would be >= ${4 * ROLE_MS}ms`);
});

test('one failing role fails the batch without cancelling the others', async () => {
  let calls = 0;
  const spawnJob = async () => {
    calls += 1;
    return { status: calls === 1 ? 1 : 0, stdout: '', stderr: '' };
  };
  const result = await runTogether(
    [{ id: 'a', cmd: 'x', artifacts: 'x' }, { id: 'b', cmd: 'x', artifacts: 'x' }],
    process.cwd(),
    { spawnJob }
  );
  assert.equal(calls, 2);
  assert.equal(result.status, 1);
});
