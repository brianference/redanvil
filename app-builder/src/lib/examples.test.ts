import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { EXAMPLES } from './examples';

const publicDir = join(process.cwd(), 'public');

describe('shipped examples', () => {
  it('has at least one example', () => {
    expect(EXAMPLES.length).toBeGreaterThan(0);
  });

  // The whole point of the page is that every frame is a real screenshot of a
  // real deployment. An entry pointing at an image that was never captured
  // renders as a broken page, and a broken frame is indistinguishable from a
  // fabricated one to anyone reading the page.
  it('every referenced screenshot exists on disk', () => {
    const missing: string[] = [];
    for (const ex of EXAMPLES) {
      const paths = [
        ...(ex.reviewShot !== undefined ? [ex.reviewShot] : []),
        ex.logo,
        ...ex.screens.map((s) => s.src)
      ];
      for (const p of paths) {
        expect(p.startsWith('/'), `${p} must be an absolute public path`).toBe(true);
        if (!existsSync(join(publicDir, p.replace(/^\//, '')))) missing.push(p);
      }
    }
    expect(missing, `capture these with capture_example.mjs: ${missing.join(', ')}`).toEqual([]);
  });

  it('every screen declares intrinsic width and height', () => {
    for (const ex of EXAMPLES) {
      for (const s of ex.screens) {
        expect(s.width, `${ex.slug} ${s.src} width`).toBeGreaterThan(0);
        expect(s.height, `${ex.slug} ${s.src} height`).toBeGreaterThan(0);
      }
    }
  });

  it('includes the AZ Planting Calendar example with live URL and verified counts', () => {
    const az = EXAMPLES.find((e) => e.slug === 'az-planting-calendar');
    expect(az).toBeDefined();
    expect(az!.liveUrl).toBe('https://az-planting-calendar.pages.dev');
    const featureText = az!.features.flatMap((g) => g.items).join(' ');
    expect(featureText).toMatch(/45 crops/);
    expect(featureText).toMatch(/83 planting windows/);
    expect(featureText).toMatch(/8 Maricopa/);
    expect(az!.stats?.join(' ')).toMatch(/45 crops/);
    expect(az!.stats?.join(' ')).toMatch(/83 windows/);
    expect(az!.gate).toMatch(/101/);
    expect(az!.gate).toMatch(/56/);
  });

  it('every screen carries a caption and a real alt description', () => {
    for (const ex of EXAMPLES) {
      for (const s of ex.screens) {
        expect(s.caption.length).toBeGreaterThan(0);
        // An alt that just repeats the product name tells a screen reader nothing.
        expect(s.alt.length).toBeGreaterThan(ex.name.length + 10);
      }
    }
  });

  it('shows the prompt that was actually typed, not a summary', () => {
    for (const ex of EXAMPLES) {
      expect(ex.prompt.length).toBeGreaterThan(20);
      expect(ex.answers.length).toBeGreaterThan(0);
      expect(ex.liveUrl).toMatch(/^https:\/\//);
    }
  });
});
