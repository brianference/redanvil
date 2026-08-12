/**
 * Unit coverage for the React-free shared modules under `design-system/`.
 *
 * These moved out of three apps on 2026-08-10 and arrived with no unit tests of
 * their own: the only thing exercising them was each app's acceptance suite,
 * which needs a browser and a running server. An independent review flagged the
 * new shared surface as untested, which was fair — a bug in `askAssistantForOutcome`
 * now reaches every generated app at once.
 *
 * The hook that consumes this (`useAssistantPanel`) needs a DOM and is covered by
 * sushi-finder's acceptance suite in a real browser; what is pinned here is the
 * decision logic underneath it, which is where the product rules actually live.
 */
import { describe, expect, it } from 'vitest';
import { askAssistantForOutcome } from '../../design-system/assistant';
import { queryString } from '../../design-system/http';
import { blankToUndefined } from '../../design-system/text';

describe('askAssistantForOutcome', () => {
  const items = [{ id: 'a', title: 'A' }];

  it('returns the trimmed answer and the selected rows', async () => {
    const outcome = await askAssistantForOutcome({
      ask: async () => ({ answer: '  grounded  ', items }),
      selectItems: (r) => r.items,
      errorMessage: 'fallback'
    });
    expect(outcome).toEqual({ status: 'answer', answer: 'grounded', items });
  });

  // The rule pack forbids rendering a failed model call as an empty success.
  // This is the single place that rule is enforced for every app.
  it('treats a blank answer as failure, never an empty success', async () => {
    for (const answer of ['', '   ', undefined, null, 42]) {
      const outcome = await askAssistantForOutcome({
        ask: async () => ({ answer }),
        selectItems: () => [],
        errorMessage: 'fallback'
      });
      expect(outcome, `answer=${JSON.stringify(answer)}`).toEqual({
        status: 'error',
        message: 'fallback'
      });
    }
  });

  it('surfaces the thrown error message, which is what the API said went wrong', async () => {
    const outcome = await askAssistantForOutcome({
      ask: async () => {
        throw new Error('message is required');
      },
      selectItems: () => [],
      errorMessage: 'fallback'
    });
    expect(outcome).toEqual({ status: 'error', message: 'message is required' });
  });

  it('falls back when the thrown error carries no message', async () => {
    const outcome = await askAssistantForOutcome({
      ask: async () => {
        throw new Error('');
      },
      selectItems: () => [],
      errorMessage: 'fallback'
    });
    expect(outcome).toEqual({ status: 'error', message: 'fallback' });
  });

  it('does not throw when the ask rejects with a non-Error', async () => {
    const outcome = await askAssistantForOutcome({
      ask: async () => Promise.reject('a string'),
      selectItems: () => [],
      errorMessage: 'fallback'
    });
    expect(outcome).toEqual({ status: 'error', message: 'fallback' });
  });
});

describe('queryString', () => {
  it('omits undefined and empty values rather than sending blanks', () => {
    expect(queryString({ q: undefined, city: '', zone: 'az' })).toBe('?zone=az');
  });

  it('returns an empty string when nothing survives, so no bare ? is appended', () => {
    expect(queryString({ q: undefined, city: '' })).toBe('');
  });

  it('encodes values and keeps zero, which is a real filter value', () => {
    expect(queryString({ q: 'a b&c', n: 0 })).toBe('?q=a+b%26c&n=0');
  });
});

describe('blankToUndefined', () => {
  it('trims a real value', () => {
    expect(blankToUndefined('  sushi  ')).toBe('sushi');
  });

  it('maps absent and whitespace-only to undefined alike', () => {
    expect(blankToUndefined(undefined)).toBeUndefined();
    expect(blankToUndefined('')).toBeUndefined();
    expect(blankToUndefined('   ')).toBeUndefined();
  });
});
