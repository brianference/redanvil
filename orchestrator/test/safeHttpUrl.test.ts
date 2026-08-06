/**
 * Unit tests for the shared scheme gate (design-system/safeHttpUrl.ts).
 * Lives under orchestrator/test so the monorepo vitest include picks it up.
 */
import { describe, it, expect } from 'vitest';
import {
  safeHttpUrl,
  safeHref,
  safeUrl
} from '../../design-system/safeHttpUrl';

describe('safeHttpUrl', () => {
  it('accepts absolute http and https', () => {
    expect(safeHttpUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com');
  });

  it('rejects javascript: including whitespace, case, and tab/newline tricks', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl(' javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeHttpUrl('java\tscript:alert(1)')).toBeNull();
    expect(safeHttpUrl('java\nscript:alert(1)')).toBeNull();
  });

  it('rejects protocol-relative, data:, and junk', () => {
    expect(safeHttpUrl('//evil.example')).toBeNull();
    expect(safeHttpUrl('data:text/html,hi')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
  });

  it('safeUrl is an alias of safeHttpUrl', () => {
    expect(safeUrl('https://ok.example/x')).toBe(safeHttpUrl('https://ok.example/x'));
    expect(safeUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('safeHref', () => {
  it('allows same-origin relative paths and hashes', () => {
    expect(safeHref('/prd/abc')).toBe('/prd/abc');
    expect(safeHref('#section')).toBe('#section');
  });

  it('rejects protocol-relative while allowing absolute http(s)', () => {
    expect(safeHref('//evil.example')).toBeNull();
    expect(safeHref('https://ok.example')).toBe('https://ok.example');
    expect(safeHref('javascript:alert(1)')).toBeNull();
  });
});
