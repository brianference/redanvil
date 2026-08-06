/**
 * Shared with every RedAnvil app.
 *
 * Contact/about copy embeds bare URLs that need to be real anchors. The only
 * app-specific value is the link colour, so that arrives as a parameter rather
 * than pulling either app's theme into design-system.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import { safeHttpUrl } from './safeHttpUrl';

const URL_RE = /(https?:\/\/[^\s]+)/g;

/**
 * Split plain text on http(s) URLs and return React nodes with real anchors.
 * Used so contact/about copy that embeds URLs is actually clickable.
 *
 * @param text - Source copy that may contain bare URLs.
 * @param linkColor - Accent colour for the anchors (theme token).
 * @returns Array of strings and anchor elements.
 */
export function linkifyText(text: string, linkColor: string): ReactNode[] {
  const linkStyle: CSSProperties = {
    color: linkColor,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    // Bare URLs once pushed a 375 viewport past the width budget; break anywhere.
    overflowWrap: 'anywhere',
    wordBreak: 'break-word'
  };

  const parts = text.split(URL_RE);
  return parts.map((part, index) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const candidate = part.replace(/[.,;:)]+$/, '');
      const trailing = part.slice(candidate.length);
      const href = safeHttpUrl(candidate);
      if (href === null) {
        return part;
      }
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
