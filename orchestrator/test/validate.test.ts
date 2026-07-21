import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateFile } from '../src/commands/validate';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'redanvil-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('validateFile', () => {
  it('returns ok for a valid job file', async () => {
    const p = join(dir, 'job.json');
    await writeFile(
      p,
      JSON.stringify({
        kind: 'job',
        slug: 'demo',
        prompt: 'Build something real',
        targetType: 'fullstack-web',
        threshold: 90,
        createdAt: '2026-07-20T00:00:00.000Z'
      })
    );
    const r = await validateFile(p);
    expect(r).toEqual({ ok: true, kind: 'job' });
  });

  it('returns issues for a malformed file', async () => {
    const p = join(dir, 'bad.json');
    await writeFile(p, JSON.stringify({ kind: 'job', slug: 'x' }));
    const r = await validateFile(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.length).toBeGreaterThan(0);
  });
});
