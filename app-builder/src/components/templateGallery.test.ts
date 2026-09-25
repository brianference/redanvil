import { describe, it, expect } from 'vitest';
import { en } from '../i18n/en';
import { resolveTemplateSelection } from './TemplateGallery';
import { EMPTY_WIZARD_ANSWERS, isAppTypeReady, isPromptReady } from '../lib/job';

describe('template gallery variants', () => {
  it('gives every archetype 3–4 starter variants with label, prompt, and appType', () => {
    expect(en.templates.items.length).toBeGreaterThanOrEqual(5);
    for (const item of en.templates.items) {
      expect(item.variants.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.variants.length, item.id).toBeLessThanOrEqual(4);
      const ids = item.variants.map((variant) => variant.id);
      expect(new Set(ids).size, `${item.id} variant ids are unique`).toBe(ids.length);
      for (const variant of item.variants) {
        // A starter must be usable as-is: long enough to pass the wizard's
        // prompt gate, with an app type the Scope step accepts.
        const answers = { ...EMPTY_WIZARD_ANSWERS, prompt: variant.prompt, appType: variant.appType };
        expect(isPromptReady(answers), `${variant.id} prompt`).toBe(true);
        expect(isAppTypeReady(answers), `${variant.id} appType`).toBe(true);
      }
    }
  });

  it('exposes variant group copy for the second-row chips', () => {
    expect(en.templates.orDescribe.toLowerCase()).toContain('describe');
  });

  it('resolveTemplateSelection prefers a variant prompt and appType when set', () => {
    const saas = en.templates.items.find((i) => i.id === 'saas');
    expect(saas).toBeDefined();
    const variant = saas!.variants[0]!;
    const selection = resolveTemplateSelection('saas', variant.id, '');
    expect(selection.id).toBe(`saas:${variant.id}`);
    expect(selection.prompt).toBe(variant.prompt);
    expect(selection.appType).toBe(variant.appType);
  });

  it('resolveTemplateSelection falls back to the archetype default without a variant', () => {
    const mobile = en.templates.items.find((i) => i.id === 'mobile');
    expect(mobile).toBeDefined();
    const selection = resolveTemplateSelection('mobile', null, '');
    expect(selection.id).toBe('mobile');
    expect(selection.prompt).toBe(mobile!.prompt);
    expect(selection.appType).toBe(mobile!.appType);
  });

  it('resolveTemplateSelection returns custom free-text when no archetype is selected', () => {
    const selection = resolveTemplateSelection(null, null, '  A custom dog walking club app  ');
    expect(selection).toEqual({
      id: 'custom',
      appType: '',
      prompt: 'A custom dog walking club app'
    });
  });
});
