/**
 * Re-export of the shared document-meta helper, bound to this app's origin.
 *
 * Implementation lives in design-system/hooks so the two apps cannot drift and
 * the duplication budget stops counting identical lines twice. Kept at this
 * path so existing imports and call sites are unchanged.
 */
import {
  useDocumentMeta as useDocumentMetaShared,
  type DocumentMeta
} from '../../../design-system/hooks/useDocumentMeta';

export type { DocumentMeta };

const SITE_ORIGIN = 'https://redanvil-dashboard.pages.dev';

/**
 * Set per-route document title, description, OG tags, and canonical URL.
 *
 * @param meta - Title, description, and path for the current route.
 */
export function useDocumentMeta(meta: DocumentMeta): void {
  useDocumentMetaShared(meta, SITE_ORIGIN);
}
