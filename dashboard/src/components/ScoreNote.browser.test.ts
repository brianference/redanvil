import { page } from '@vitest/browser/context';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import '../theme.css';
import { ScoreNote } from './ScoreNote';

/**
 * Browser lane: the score note's reading measure is set by `.ra-score-note` in
 * theme.css, not inline, so only a browser that loads the sheet can say whether
 * the note actually stops at 60 characters on a wide screen.
 */

const DESKTOP_WIDTH = 1280;
const VIEWPORT_HEIGHT = 900;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  container?.remove();
  root = null;
  container = null;
});

describe('ScoreNote in a real browser', () => {
  it('stops at a 60ch measure instead of running the full width at 1280', async () => {
    await page.viewport(DESKTOP_WIDTH, VIEWPORT_HEIGHT);
    container = document.createElement('div');
    document.body.appendChild(container);
    const mountedRoot = createRoot(container);
    root = mountedRoot;
    flushSync(() => {
      mountedRoot.render(createElement(ScoreNote));
    });

    const note = container.querySelector('p');
    if (note === null) throw new Error('score note not rendered');
    expect(note.textContent).toBe(en.pages.home.scoreNote);

    // 60ch of the note's own font, measured with the same font.
    const probe = document.createElement('span');
    probe.textContent = '0'.repeat(60);
    probe.style.font = getComputedStyle(note).font;
    probe.style.whiteSpace = 'nowrap';
    document.body.appendChild(probe);
    const sixtyCh = probe.getBoundingClientRect().width;
    probe.remove();

    const noteWidth = note.getBoundingClientRect().width;
    expect(noteWidth).toBeLessThan(container.getBoundingClientRect().width);
    expect(noteWidth).toBeCloseTo(sixtyCh, 0);
  });
});
