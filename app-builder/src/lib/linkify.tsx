/**
 * Re-export of the shared linkify helper, bound to this app's accent colour.
 *
 * Implementation lives in design-system/ so the two apps cannot drift.
 * Kept at this path so existing imports are unchanged.
 */
import type { ReactNode } from 'react';
import { linkifyText as linkifyTextShared } from '../../../design-system/linkify';
import { theme } from '../theme';

/**
 * Split plain text on http(s) URLs and return React nodes with real anchors.
 *
 * @param text - Source copy that may contain bare URLs.
 * @returns Array of strings and anchor elements.
 */
export function linkifyText(text: string): ReactNode[] {
  return linkifyTextShared(text, theme.color.accent);
}
