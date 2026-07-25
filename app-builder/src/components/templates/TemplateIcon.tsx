import type { ReactNode } from 'react';

/**
 * Simple line-icon glyph for a template archetype (inline SVG, theme via currentColor).
 *
 * @param props - Archetype id used to pick the path set.
 */
export function TemplateIcon({ id }: { id: string }): JSX.Element {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    'aria-hidden': true as const
  };
  let path: ReactNode;
  switch (id) {
    case 'saas':
      path = (
        <>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M8 20h8M12 18v2" />
        </>
      );
      break;
    case 'marketplace':
      path = (
        <>
          <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case 'internal':
      path = (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      );
      break;
    case 'mobile':
      path = (
        <>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </>
      );
      break;
    case 'api':
      path = (
        <>
          <path d="M4 8h6v8H4zM14 4h6v16h-6z" />
          <path d="M10 12h4" />
        </>
      );
      break;
    default:
      path = <circle cx="12" cy="12" r="8" />;
  }
  return <svg {...common}>{path}</svg>;
}
