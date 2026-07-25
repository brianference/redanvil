import { useState } from 'react';
import { en } from '../i18n/en';
import { MIN_PROMPT_LENGTH } from '../lib/job';
import { TemplateComposer } from './templates/TemplateComposer';
import { TemplateFooter } from './templates/TemplateFooter';
import { TemplateGrid } from './templates/TemplateGrid';
import { TemplateVariants } from './templates/TemplateVariants';
import { subStyle } from './templates/styles';

export interface TemplateSelection {
  /** Template id, or "custom" when free-form. Variant ids use "archetype:variant". */
  id: string;
  /** Suggested app type for the wizard. */
  appType: string;
  /** Prompt text to seed the wizard. */
  prompt: string;
}

export interface TemplateGalleryProps {
  /** Seed prompt shown in the custom composer. */
  initialPrompt?: string;
  /** Called when the user continues with a selection. */
  onContinue: (selection: TemplateSelection) => void;
  /** Return to the chat home. */
  onBack: () => void;
}

/** One starter variant under an archetype (from the locale bundle). */
type TemplateVariant = (typeof en.templates.items)[number]['variants'][number];

/**
 * Resolve the effective selection from archetype + optional variant.
 *
 * @param archetypeId - Selected template archetype id, or null.
 * @param variantId - Selected variant id under that archetype, or null.
 * @param customPrompt - Free-text composer value.
 * @returns Selection fields used by Continue.
 */
export function resolveTemplateSelection(
  archetypeId: string | null,
  variantId: string | null,
  customPrompt: string
): TemplateSelection {
  const items = en.templates.items;
  const archetype =
    archetypeId !== null ? items.find((item) => item.id === archetypeId) : undefined;
  if (archetype !== undefined) {
    const variant: TemplateVariant | undefined =
      variantId !== null ? archetype.variants.find((v) => v.id === variantId) : undefined;
    if (variant !== undefined) {
      return {
        id: `${archetype.id}:${variant.id}`,
        appType: variant.appType,
        prompt: variant.prompt
      };
    }
    return {
      id: archetype.id,
      appType: archetype.appType,
      prompt: archetype.prompt
    };
  }
  return {
    id: 'custom',
    appType: '',
    prompt: customPrompt.trim()
  };
}

/**
 * Template gallery: card grid of app archetypes, variant chips under the
 * selected archetype, plus an “or describe your own” path (Grok v3).
 *
 * @param props - Initial prompt, continue, and back handlers.
 */
export function TemplateGallery({
  initialPrompt = '',
  onContinue,
  onBack
}: TemplateGalleryProps): JSX.Element {
  const copy = en.templates;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState(initialPrompt);
  const [error, setError] = useState<string | null>(null);

  const selected = copy.items.find((item) => item.id === selectedId) ?? null;
  const effectivePrompt = (
    selectedVariantId !== null && selected !== null
      ? (selected.variants.find((v) => v.id === selectedVariantId)?.prompt ?? selected.prompt)
      : (selected?.prompt ?? customPrompt)
  ).trim();
  const canContinue = effectivePrompt.length >= MIN_PROMPT_LENGTH;

  /**
   * Select a template archetype and seed the composer with its default prompt.
   * Clears any previous variant so the user can pick a starter under this type.
   */
  function selectTemplate(id: string): void {
    const item = copy.items.find((t) => t.id === id);
    if (item === undefined) return;
    setSelectedId(id);
    setSelectedVariantId(null);
    setCustomPrompt(item.prompt);
    setError(null);
  }

  /**
   * Select a starter variant under the current archetype; fills prompt + appType.
   */
  function selectVariant(variantId: string): void {
    if (selected === null) return;
    const variant = selected.variants.find((v) => v.id === variantId);
    if (variant === undefined) return;
    setSelectedVariantId(variantId);
    setCustomPrompt(variant.prompt);
    setError(null);
  }

  /**
   * Continue into the wizard when a valid prompt is present.
   */
  function handleContinue(): void {
    if (!canContinue) {
      setError(copy.emptyHint);
      return;
    }
    const selection = resolveTemplateSelection(selectedId, selectedVariantId, customPrompt);
    // Prefer the live composer text when the user edited after picking a template.
    if (customPrompt.trim().length >= MIN_PROMPT_LENGTH && selection.id !== 'custom') {
      onContinue({
        ...selection,
        prompt: customPrompt.trim()
      });
      return;
    }
    onContinue(selection);
  }

  return (
    <div className="ra-content-col">
      <p style={subStyle}>{copy.subtitle}</p>

      <TemplateGrid selectedId={selectedId} onSelect={selectTemplate} />

      {selected !== null && (
        <TemplateVariants
          variants={selected.variants}
          selectedVariantId={selectedVariantId}
          onSelectVariant={selectVariant}
        />
      )}

      <TemplateComposer
        customPrompt={customPrompt}
        onCustomPromptChange={(value) => {
          setCustomPrompt(value);
          setSelectedId(null);
          setSelectedVariantId(null);
          setError(null);
        }}
        onExampleSelect={(prompt) => {
          setCustomPrompt(prompt);
          setSelectedId(null);
          setSelectedVariantId(null);
          setError(null);
        }}
      />

      <TemplateFooter
        canContinue={canContinue}
        error={error}
        onBack={onBack}
        onContinue={handleContinue}
      />
    </div>
  );
}
