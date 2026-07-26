import { Link } from 'react-router-dom';
import { en } from '../../i18n/en';
import { formatRelativeTime, type SavedPrdListItem } from '../../lib/savedList';
import {
  badgeStyle,
  buildActionsStyle,
  buildBodyStyle,
  buildCardStyle,
  buildIconStyle,
  buildMetaStyle,
  buildTimeStyle,
  buildTitleLinkStyle,
  listStyle,
  metaEllipsisStyle,
  rowActionStyle,
  sectionHeadStyle,
  sectionMetaStyle,
  sectionTitleStyle,
  sourceBadgeStyle
} from './styles';

export interface SavedCardListProps {
  /** Saved PRD rows to render. */
  items: SavedPrdListItem[];
}

/**
 * Recent-builds section head plus the card list for the Saved page.
 *
 * @param props - List items from /api/prds.
 */
export function SavedCardList({ items }: SavedCardListProps): JSX.Element {
  const copy = en.pages.saved;
  return (
    <>
      <div className="ra-saved-col" style={sectionHeadStyle}>
        <h2 style={sectionTitleStyle}>{copy.sectionRecent}</h2>
        <span style={sectionMetaStyle}>{copy.countMeta(items.length)}</span>
      </div>

      <ul className="ra-saved-col ra-saved-list" style={listStyle} aria-label={copy.listLabel}>
        {items.map((item) => (
          <li key={item.id}>
            <div style={buildCardStyle}>
              <span style={buildIconStyle} aria-hidden="true">
                ✓
              </span>
              <div style={buildBodyStyle}>
                <Link to={`/prd/${item.id}`} style={buildTitleLinkStyle}>
                  {item.title}
                </Link>
                <div style={buildMetaStyle}>
                  <span style={badgeStyle}>
                    <span aria-hidden="true">● </span>
                    {copy.statusReady}
                  </span>
                  <span style={sourceBadgeStyle}>{copy.sourcePublic}</span>
                  <span style={metaEllipsisStyle}>{copy.itemMeta(item.slug)}</span>
                </div>
              </div>
              <div style={buildActionsStyle}>
                <span style={buildTimeStyle}>{formatRelativeTime(item.created_at)}</span>
                <Link
                  to={`/prd/${item.id}`}
                  style={rowActionStyle}
                  aria-label={copy.openAria(item.title)}
                >
                  {copy.openAction}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
