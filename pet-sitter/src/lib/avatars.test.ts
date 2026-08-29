import { describe, expect, it } from 'vitest';
import { avatarUrl, initialsFromName } from './avatars';

describe('avatarUrl', () => {
  it('returns the public path for a seed sitter and empty for unknown ids', () => {
    expect(avatarUrl('sit-leslieville-01')).toBe('/avatars/avery-chen.jpg');
    expect(avatarUrl('no-such-sitter')).toBe('');
  });
});

describe('initialsFromName', () => {
  it('builds two-letter initials and falls back for empty names', () => {
    expect(initialsFromName('Avery Chen')).toBe('AC');
    expect(initialsFromName('Riley')).toBe('RI');
    expect(initialsFromName('   ')).toBe('?');
  });
});
