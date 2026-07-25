import { en } from '../../i18n/en';
import { TemplateIcon } from './TemplateIcon';
import {
  checkBadgeStyle,
  iconWellStyle,
  templateBodyStyle,
  templateCardStyle,
  templateDescStyle,
  templateTitleStyle
} from './styles';

export interface TemplateCardProps {
  /** Archetype id (matches locale item id). */
  id: string;
  /** Card title. */
  title: string;
  /** Short description under the title. */
  description: string;
  /** Whether this card is the active selection. */
  selected: boolean;
  /** Full-width layout for an odd last card. */
  wide: boolean;
  /** Select this archetype. */
  onSelect: () => void;
}

/**
 * One selectable template archetype card in the gallery grid.
 *
 * @param props - Identity, copy, selection, and click handler.
 */
export function TemplateCard({
  id,
  title,
  description,
  selected,
  wide,
  onSelect
}: TemplateCardProps): JSX.Element {
  const copy = en.templates;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      style={templateCardStyle(selected, wide)}
    >
      <span style={iconWellStyle(selected)} aria-hidden="true">
        <TemplateIcon id={id} />
      </span>
      <span style={templateBodyStyle}>
        <span style={templateTitleStyle}>{title}</span>
        <span style={templateDescStyle}>{description}</span>
      </span>
      {selected ? (
        <span style={checkBadgeStyle} aria-label={copy.selected}>
          ✓
        </span>
      ) : null}
    </button>
  );
}
