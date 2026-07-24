import { describe, it, expect } from 'vitest';
import { en } from '../i18n/en';
import { resolveTemplateSelection } from './TemplateGallery';

describe('template gallery variants', () => {
  it('gives every archetype 3–4 starter variants with label, prompt, and appType', () => {
    expect(en.templates.items.length).toBeGreaterThanOrEqual(5);
    for (const item of en.templates.items) {
      expect(item.variants.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.variants.length, item.id).toBeLessThanOrEqual(4);
      for (const variant of item.variants) {
        expect(variant.id.length, variant.id).toBeGreaterThan(2);
        expect(variant.label.length, variant.id).toBeGreaterThan(2);
        expect(variant.appType.length, variant.id).toBeGreaterThan(2);
        expect(variant.prompt.length, variant.id).toBeGreaterThan(20);
      }
    }
  });

  it('exposes variant group copy for the second-row chips', () => {
    expect(en.templates.variantsLabel.length).toBeGreaterThan(2);
    expect(en.templates.variantsHint.length).toBeGreaterThan(10);
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
