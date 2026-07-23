import type { CSSProperties, ReactNode } from 'react';
import { theme } from '../theme';

const URL_RE = /(https?:\/\/[^\s]+)/g;

const linkStyle: CSSProperties = {
  color: theme.color.accent,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  wordBreak: 'break-word'
};

/**
 * Split plain text on http(s) URLs and return React nodes with real anchors.
 * Used so contact/about copy that embeds URLs is actually clickable.
 *
 * @param text - Source copy that may contain bare URLs.
 * @returns Array of strings and anchor elements.
 */
export function linkifyText(text: string): ReactNode[] {
  const parts = text.split(URL_RE);
  return parts.map((part, index) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const href = part.replace(/[.,;:)]+$/, '');
      const trailing = part.slice(href.length);
      return (
        <span key={`u-${index}`}>
          <a href={href} target="_blank" rel="noreferrer" style={linkStyle}>
            {href}
          </a>
          {trailing}
        </span>
      );
    }
    return part;
  });
}
