import { describe, expect, it } from 'vitest';
import { interpolate } from './interpolate';

describe('interpolate', () => {
  it('replaces known tokens and leaves unknown ones', () => {
    expect(interpolate('Wait {seconds} seconds', { seconds: 12 })).toBe('Wait 12 seconds');
    expect(interpolate('Save {title}', { title: 'Avery Chen' })).toBe('Save Avery Chen');
    expect(interpolate('Keep {missing}', {})).toBe('Keep {missing}');
  });
});
