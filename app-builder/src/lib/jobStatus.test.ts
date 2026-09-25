import { describe, it, expect, afterEach } from 'vitest';
import { en } from '../i18n/en';
import {
  JOB_STATUS_POLL_INTERVAL_MS,
  LAST_JOB_ID_STORAGE_KEY,
  clearLastJobId,
  formatBuildStepLine,
  isTerminalJobStatus,
  jobStatusUrl,
  parsePublicJobStatus,
  parseSubmittedJobId,
  readLastJobId,
  shortJobId,
  shouldShowDeployLink,
  writeLastJobId
} from './jobStatus';

const JOB_ID = '11111111-1111-4111-8111-111111111111';

/** Process-map order. A reorder or a duplicate must fail this list. */
const PROCESS_STEP_IDS = [
  'prd',
  'product',
  'brainstorm',
  'inspo',
  'reuse',
  'logo',
  'palette',
  'layout',
  'decide',
  'integration',
  'testwriter',
  'build',
  'content',
  'runners',
  'visual',
  'ui-live',
  'qa-runtime',
  'judge',
  'qa-data',
  'user-refuse',
  'pm',
  'debugger',
  'reverify',
  'ship'
] as const;

/**
 * Install a tiny localStorage stand-in, or one that throws.
 *
 * @param mode - Map to back the store, or `'throw'` to fail every call.
 */
function installStorage(mode: Map<string, string> | 'throw'): void {
  const storage = {
    getItem(key: string): string | null {
      if (mode === 'throw') throw new Error('blocked');
      return mode.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      if (mode === 'throw') throw new Error('blocked');
      mode.set(key, value);
    },
    removeItem(key: string): void {
      if (mode === 'throw') throw new Error('blocked');
      mode.delete(key);
    }
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true
  });
}

describe('job status helpers', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('polls every 15 seconds', () => {
    expect(JOB_STATUS_POLL_INTERVAL_MS).toBe(15_000);
  });

  it('treats done, failed, and rejected as terminal and nothing else', () => {
    expect(isTerminalJobStatus('done')).toBe(true);
    expect(isTerminalJobStatus('failed')).toBe(true);
    expect(isTerminalJobStatus('rejected')).toBe(true);
    expect(isTerminalJobStatus('queued')).toBe(false);
    expect(isTerminalJobStatus('claimed')).toBe(false);
    expect(isTerminalJobStatus('awaiting_owner')).toBe(false);
    expect(isTerminalJobStatus('approved')).toBe(false);
    expect(isTerminalJobStatus('building')).toBe(false);
  });

  it('parses the public shape and drops a prompt if one is present', () => {
    const parsed = parsePublicJobStatus({
      id: JOB_ID,
      status: 'building',
      step: 'install-deps',
      detail: 'Installing packages',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deployUrl: 'https://recipe-box.pages.dev',
      prompt: 'super-secret-prompt-do-not-leak'
    });
    expect(parsed).toEqual({
      id: JOB_ID,
      status: 'building',
      step: 'install-deps',
      detail: 'Installing packages',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deployUrl: 'https://recipe-box.pages.dev'
    });
    expect(parsed).not.toHaveProperty('prompt');
  });

  it('fails closed on a missing, malformed or mistyped field', () => {
    const valid = { id: JOB_ID, status: 'building' };
    expect(parsePublicJobStatus(valid)).toEqual({
      ...valid,
      step: null,
      detail: null,
      updatedAt: null,
      deployUrl: null
    });
    expect(parsePublicJobStatus({ ...valid, step: '' })?.step).toBeNull();
    expect(parsePublicJobStatus({ ...valid, id: 'job-1' })).toBeNull();
    expect(parsePublicJobStatus({ ...valid, status: '' })).toBeNull();
    expect(parsePublicJobStatus({ ...valid, step: 3 })).toBeNull();
    expect(parsePublicJobStatus({ id: JOB_ID })).toBeNull();
    expect(parsePublicJobStatus(null)).toBeNull();
  });

  it('keeps http and https deploy URLs and drops every other scheme', () => {
    const base = { id: JOB_ID, status: 'done' };
    expect(
      parsePublicJobStatus({ ...base, deployUrl: 'https://recipe-box.pages.dev' })?.deployUrl
    ).toBe('https://recipe-box.pages.dev');
    expect(
      parsePublicJobStatus({ ...base, deployUrl: 'http://recipe-box.pages.dev' })?.deployUrl
    ).toBe('http://recipe-box.pages.dev');
    expect(
      parsePublicJobStatus({ ...base, deployUrl: '  https://recipe-box.pages.dev  ' })?.deployUrl
    ).toBe('https://recipe-box.pages.dev');

    const prefix = 'https://example.com/';
    const exact = prefix + 'a'.repeat(200 - prefix.length);
    expect(exact.length).toBe(200);
    expect(parsePublicJobStatus({ ...base, deployUrl: exact })?.deployUrl).toBe(exact);

    const tooLong = prefix + 'a'.repeat(201 - prefix.length);
    expect(tooLong.length).toBe(201);
    const rejected = [
      'javascript:alert(1)',
      'data:text/html,hi',
      'ftp://recipe-box.pages.dev',
      '//recipe-box.pages.dev',
      'not a url',
      '',
      tooLong
    ];
    for (const deployUrl of rejected) {
      expect(parsePublicJobStatus({ ...base, deployUrl })?.deployUrl).toBeNull();
    }
  });

  it('offers the deploy link only for a done job with an http(s) URL', () => {
    expect(shouldShowDeployLink('done', 'https://recipe-box.pages.dev')).toBe(true);
    expect(shouldShowDeployLink('done', 'http://recipe-box.pages.dev')).toBe(true);
    expect(shouldShowDeployLink('done', 'javascript:alert(1)')).toBe(false);
    expect(shouldShowDeployLink('done', 'data:text/html,hi')).toBe(false);
    expect(shouldShowDeployLink('building', 'https://recipe-box.pages.dev')).toBe(false);
    expect(shouldShowDeployLink('failed', 'https://recipe-box.pages.dev')).toBe(false);
    expect(shouldShowDeployLink('done', null)).toBe(false);
  });

  it('returns null for a payload without an id', () => {
    expect(parsePublicJobStatus({ status: 'queued' })).toBeNull();
    expect(parseSubmittedJobId({ status: 'queued' })).toBeNull();
    expect(parseSubmittedJobId({ id: JOB_ID })).toBe(JOB_ID);
  });

  it('builds the public status path', () => {
    expect(jobStatusUrl(JOB_ID)).toBe(`/api/jobs/${JOB_ID}/status`);
  });

  it('round-trips the last job id and ignores a blocked store', () => {
    const store = new Map<string, string>();
    installStorage(store);
    expect(readLastJobId()).toBeNull();
    writeLastJobId(JOB_ID);
    expect(store.get(LAST_JOB_ID_STORAGE_KEY)).toBe(JOB_ID);
    expect(readLastJobId()).toBe(JOB_ID);

    store.set(LAST_JOB_ID_STORAGE_KEY, '../not-an-id');
    expect(readLastJobId()).toBeNull();

    installStorage('throw');
    expect(readLastJobId()).toBeNull();
    expect(() => {
      writeLastJobId(JOB_ID);
    }).not.toThrow();
  });

  it('treats done, failed and rejected as terminal, and every other status as still moving', () => {
    expect(isTerminalJobStatus('done')).toBe(true);
    expect(isTerminalJobStatus('failed')).toBe(true);
    expect(isTerminalJobStatus('rejected')).toBe(true);
    expect(isTerminalJobStatus('building')).toBe(false);
    expect(isTerminalJobStatus('queued')).toBe(false);
  });

  it('shows the first 8 characters of a job id', () => {
    expect(shortJobId(JOB_ID)).toBe('11111111');
    expect(JOB_ID.startsWith(shortJobId(JOB_ID))).toBe(true);
    expect(shortJobId(JOB_ID)).not.toBe(JOB_ID);
  });

  it('lists 24 unique build step ids in process order', () => {
    const ids = en.jobStatus.steps.map((step) => step.id);
    expect(ids).toEqual([...PROCESS_STEP_IDS]);
    expect(ids).toHaveLength(24);
    expect(new Set(ids).size).toBe(24);
    for (const step of en.jobStatus.steps) {
      expect(step.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('numbers a known step and leaves an unknown id unnumbered', () => {
    expect(en.jobStatus.stepProgress(6, 24, 'Brand marks')).toBe('Step 6 of 24 · Brand marks');

    const logo = formatBuildStepLine('logo', en.jobStatus.steps, en.jobStatus.stepProgress);
    expect(logo).toEqual({
      line: 'Step 6 of 24 · Brand marks',
      index: 6,
      total: 24,
      percent: 25
    });

    const first = formatBuildStepLine('prd', en.jobStatus.steps, en.jobStatus.stepProgress);
    expect(first.index).toBe(1);
    expect(first.total).toBe(24);
    expect(first.line.startsWith('Step 1 of 24 · ')).toBe(true);

    const last = formatBuildStepLine('ship', en.jobStatus.steps, en.jobStatus.stepProgress);
    expect(last.index).toBe(24);
    expect(last.percent).toBe(100);
    expect(last.line.startsWith('Step 24 of 24 · ')).toBe(true);

    const unknown = formatBuildStepLine(
      'install-deps',
      en.jobStatus.steps,
      en.jobStatus.stepProgress
    );
    expect(unknown).toEqual({
      line: 'install-deps',
      index: null,
      total: null,
      percent: null
    });
    expect(unknown.line).not.toMatch(/^Step \d+ of \d+/);

    const numberedRaw = formatBuildStepLine(
      'step-99',
      en.jobStatus.steps,
      en.jobStatus.stepProgress
    );
    expect(numberedRaw.line).toBe('step-99');
    expect(numberedRaw.index).toBeNull();
    expect(() => {
      formatBuildStepLine('', en.jobStatus.steps, en.jobStatus.stepProgress);
    }).not.toThrow();
  });

  it('gives every tracked status an icon and a headline that is not the raw code', () => {
    const required = [
      'queued',
      'awaiting_owner',
      'approved',
      'building',
      'done',
      'failed',
      'rejected'
    ] as const;
    for (const status of required) {
      const presentation = en.jobStatus.statusPresentation(status);
      expect(presentation.icon.length).toBeGreaterThan(0);
      expect(presentation.badge.length).toBeGreaterThan(0);
      expect(presentation.headline.length).toBeGreaterThan(0);
      expect(presentation.badge).not.toBe(status);
    }
    expect(en.jobStatus.statusPresentation('not-a-status')).toEqual({
      icon: '?',
      badge: 'not-a-status',
      headline: 'Status: not-a-status'
    });
  });

  it('clearing the stored job id works, and never throws when storage throws or is absent', () => {
    const store = new Map<string, string>();
    installStorage(store);
    writeLastJobId(JOB_ID);
    clearLastJobId();
    expect(store.has(LAST_JOB_ID_STORAGE_KEY)).toBe(false);
    expect(readLastJobId()).toBeNull();

    installStorage('throw');
    expect(() => {
      clearLastJobId();
    }).not.toThrow();

    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(() => {
      clearLastJobId();
    }).not.toThrow();
  });
});
