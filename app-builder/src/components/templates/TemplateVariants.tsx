import { en } from '../../i18n/en';
import { chipStyle, hintStyle } from '../ui';
import {
  variantsBlockStyle,
  variantsHeadingStyle,
  variantsRowStyle
} from './styles';

/** One starter variant under an archetype (from the locale bundle). */
type TemplateVariant = (typeof en.templates.items)[number]['variants'][number];

export interface TemplateVariantsProps {
  /** Variants for the currently selected archetype. */
  variants: readonly TemplateVariant[];
  /** Selected variant id, or null. */
  selectedVariantId: string | null;
  /** Select a starter variant. */
  onSelectVariant: (variantId: string) => void;
}

/**
 * Starter-variant chips under the selected archetype.
 *
 * @param props - Variant list, selection, and select handler.
 */
export function TemplateVariants({
  variants,
  selectedVariantId,
  onSelectVariant
}: TemplateVariantsProps): JSX.Element {
  const copy = en.templates;
  return (
    <div style={variantsBlockStyle}>
      <p id="template-variants-label" style={variantsHeadingStyle}>
        {copy.variantsLabel}
      </p>
      <p style={hintStyle()}>{copy.variantsHint}</p>
      <div
        style={variantsRowStyle}
        role="group"
        aria-labelledby="template-variants-label"
      >
        {variants.map((variant) => {
          const isSelected = selectedVariantId === variant.id;
          return (
            <button
              key={variant.id}
              type="button"
              style={chipStyle(isSelected)}
              aria-pressed={isSelected}
              onClick={() => {
                onSelectVariant(variant.id);
              }}
            >
              {variant.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
