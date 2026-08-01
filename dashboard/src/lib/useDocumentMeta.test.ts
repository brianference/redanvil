import { describe, it, expect } from 'vitest';
import { useDocumentMeta } from './useDocumentMeta';

/**
 * The dashboard wrapper only rebinds the shared helper to this app's origin.
 * Asserting the export is a real function keeps the re-export from going dead
 * without needing a React render harness for document side effects (those are
 * covered by acceptance tests on title/heading per route).
 */
describe('useDocumentMeta', () => {
  it('exports a callable hook bound for this app', () => {
    expect(typeof useDocumentMeta).toBe('function');
    expect(useDocumentMeta.length).toBe(1);
  });
});
