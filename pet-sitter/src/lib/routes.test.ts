import { describe, it, expect } from 'vitest';
import { ROUTES, pathForPage } from './routes';

describe('ROUTES', () => {
  it('exposes shell and marketplace paths', () => {
    expect(ROUTES.map((r) => r.path)).toEqual([
      '/',
      '/sitters',
      '/about',
      '/terms',
      '/privacy',
      '/contact',
      '/login'
    ]);
  });

  it('maps page names to their paths', () => {
    expect(pathForPage('Home')).toBe('/');
    expect(pathForPage('Sitters')).toBe('/sitters');
    expect(pathForPage('About')).toBe('/about');
    expect(pathForPage('Contact')).toBe('/contact');
    expect(pathForPage('Missing')).toBeUndefined();
  });
});
