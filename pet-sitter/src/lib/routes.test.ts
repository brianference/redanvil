import { describe, it, expect } from 'vitest';
import { ROUTES, pathForPage } from './routes';

describe('ROUTES', () => {
  it('exposes the five required shell paths', () => {
    expect(ROUTES.map((r) => r.path)).toEqual([
      '/',
      '/about',
      '/terms',
      '/privacy',
      '/contact'
    ]);
  });

  it('maps page names to their paths', () => {
    expect(pathForPage('Home')).toBe('/');
    expect(pathForPage('About')).toBe('/about');
    expect(pathForPage('Contact')).toBe('/contact');
    expect(pathForPage('Missing')).toBeUndefined();
  });
});
