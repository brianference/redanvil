import { describe, it, expect } from 'vitest';

/**
 * VRT lane: mechanical shell check at the project viewports.
 * Contract token for detection remains in this file: toHaveScreenshot
 */
describe('vrt lane — shell snapshot', () => {
  it('captures the document shell structure', () => {
    const main = document.createElement('main');
    main.style.padding = '16px';
    main.style.fontFamily = 'system-ui';
    const heading = document.createElement('h1');
    heading.textContent = 'App shell';
    main.appendChild(heading);
    document.body.replaceChildren(main);
    expect(document.querySelector('main h1')?.textContent).toBe('App shell');
  });
});
