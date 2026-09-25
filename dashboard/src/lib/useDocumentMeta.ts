import {
  useDocumentMeta as useDocumentMetaShared,
  type DocumentMeta
} from '../../../design-system/hooks/useDocumentMeta';
import { DASHBOARD_URL } from '../components/shell/constants';

export type { DocumentMeta };

/**
 * Set per-route document title, description, OG tags, and canonical URL,
 * canonicalised against the dashboard's production origin.
 *
 * @param meta - Title, description, and path for the current route.
 */
export function useDocumentMeta(meta: DocumentMeta): void {
  useDocumentMetaShared(meta, DASHBOARD_URL);
}
