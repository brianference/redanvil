import { describe, it, expect } from 'vitest';
import { buildArchitectureSection } from './sections/architecture';
import { stackReferencesFor } from './stackReferences';

describe('stackReferencesFor', () => {
  it('lists docs for every technology the generated architecture section names', () => {
    const markdown = buildArchitectureSection({
      hasAuth: true,
      dataStorage: 'relational',
      hasRealtime: false,
      integrations: ''
    });
    const names = stackReferencesFor(markdown).map((r) => r.name);
    expect(names).toEqual([
      'Cloudflare Pages',
      'Pages Functions',
      'Cloudflare D1',
      'Zod',
      'Web Crypto API',
      'Vite',
      'React'
    ]);
  });

  it('returns nothing for a PRD that names no stack, rather than padding the list', () => {
    expect(stackReferencesFor('# Demo PRD\n\nThis is a saved PRD with enough content.')).toEqual([]);
  });

  it('does not match a technology name inside another word', () => {
    expect(stackReferencesFor('Reactive viteness in a D10 grid')).toEqual([]);
  });

  it('points every reference at an https documentation URL', () => {
    const all = stackReferencesFor('Cloudflare Pages Pages Functions D1 Zod Web Crypto Vite React Playwright');
    expect(all).toHaveLength(8);
    for (const ref of all) expect(new URL(ref.url).protocol).toBe('https:');
  });
});
