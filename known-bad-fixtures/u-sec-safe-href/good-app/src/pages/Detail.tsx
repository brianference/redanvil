/**
 * Known-good fixture for u-sec-safe-href: validated https URL only.
 * Renders no anchor when the scheme is not http(s).
 */
import { safeHttpUrl } from '../lib/safeHttpUrl';

export function Detail({ sourceUrl }: { sourceUrl: string }): JSX.Element {
  const href = safeHttpUrl(sourceUrl);
  return (
    <main>
      {href ? (
        <a href={href} rel="noopener noreferrer" target="_blank">
          Source
        </a>
      ) : null}
    </main>
  );
}
