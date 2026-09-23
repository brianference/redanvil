import { describe, it, expect, afterEach } from 'vitest';
import {
  JOB_STATUS_POLL_INTERVAL_MS,
  LAST_JOB_ID_STORAGE_KEY,
  isTerminalJobStatus,
  jobStatusUrl,
  parsePublicJobStatus,
  parseSubmittedJobId,
  readLastJobId,
  writeLastJobId
} from './jobStatus';

const JOB_ID = '11111111-1111-4111-8111-111111111111';

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

  it('rejects a non-https deploy URL instead of linking it', () => {
    const parsed = parsePublicJobStatus({
      id: JOB_ID,
      status: 'done',
      deployUrl: 'http://recipe-box.pages.dev'
    });
    expect(parsed?.deployUrl).toBeNull();
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
});
