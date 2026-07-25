import { en } from '../../i18n/en';
import { TemplateCard } from './TemplateCard';
import { gridStyle, sectionLabelStyle, sectionMetaStyle, sectionTitleStyle } from './styles';

export interface TemplateGridProps {
  /** Currently selected archetype id, or null. */
  selectedId: string | null;
  /** Select an archetype by id. */
  onSelect: (id: string) => void;
}

/**
 * Section head plus listbox grid of template archetype cards.
 *
 * @param props - Selection state and select handler.
 */
export function TemplateGrid({ selectedId, onSelect }: TemplateGridProps): JSX.Element {
  const copy = en.templates;
  return (
    <>
      <div style={sectionLabelStyle}>
        <h2 style={sectionTitleStyle}>{copy.sectionLabel}</h2>
        <span style={sectionMetaStyle}>{copy.sectionCount(copy.items.length)}</span>
      </div>

      <div className="ra-tpl-grid" style={gridStyle} role="listbox" aria-label={copy.gridLabel}>
        {copy.items.map((item, index) => {
          const isSelected = selectedId === item.id;
          const isWide = index === copy.items.length - 1 && copy.items.length % 2 === 1;
          return (
            <TemplateCard
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              selected={isSelected}
              wide={isWide}
              onSelect={() => {
                onSelect(item.id);
              }}
            />
          );
        })}
      </div>
    </>
  );
}
