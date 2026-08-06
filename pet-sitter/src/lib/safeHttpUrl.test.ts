import { describe, it, expect } from 'vitest';
import { safeHttpUrl, safeHref } from './safeHttpUrl';

describe('safeHttpUrl', () => {
  it('accepts http and https absolute URLs', () => {
    expect(safeHttpUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com');
  });

  it('rejects javascript, data, and protocol-relative schemes', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,hi')).toBeNull();
    expect(safeHttpUrl('//evil.example')).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});

describe('safeHref', () => {
  it('allows same-origin paths and hashes', () => {
    expect(safeHref('/sitters/1')).toBe('/sitters/1');
    expect(safeHref('#main')).toBe('#main');
  });

  it('rejects protocol-relative and unsafe schemes', () => {
    expect(safeHref('//evil.example')).toBeNull();
    expect(safeHref('javascript:void(0)')).toBeNull();
  });
});
