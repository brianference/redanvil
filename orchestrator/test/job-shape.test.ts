/**
 * Guards against app-builder BuildJob drifting from orchestrator JobSchema.
 * One source of truth is JobSchema; buildJob must emit a payload that parses.
 */
import { describe, it, expect } from 'vitest';
import { buildJob } from '../../app-builder/src/lib/job';
import { JobSchema } from '../src/schemas/job';

describe('BuildJob ↔ JobSchema alignment', () => {
  it('buildJob output is a valid orchestrator Job', () => {
    const job = buildJob(
      {
        prompt: 'Build a marketplace for local makers',
        appType: 'marketplace',
        hasAuth: true,
        entities: 'Listing, Seller'
      },
      new Date('2026-07-22T15:30:00.000Z')
    );
    const parsed = JobSchema.safeParse(job);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('job');
      expect(parsed.data.targetType).toBe('fullstack-web');
      expect(parsed.data.threshold).toBe(90);
      expect(parsed.data.createdAt).toBe('2026-07-22T15:30:00.000Z');
      expect(parsed.data.answers.appType).toBe('marketplace');
    }
  });

  it('rejects a legacy BuildJob missing createdAt and answers', () => {
    const legacy = {
      kind: 'job',
      slug: 'build-a-recipe-box',
      prompt: 'Build a recipe box for home cooks',
      targetType: 'fullstack-web',
      threshold: 90
    };
    const parsed = JobSchema.safeParse(legacy);
    expect(parsed.success).toBe(false);
  });
});
