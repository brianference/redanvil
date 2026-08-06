/**
 * Known-bad fixture for u-sec-safe-href.
 *
 * Renders a data-driven href from an untrusted field with NO scheme validation.
 * A value of `javascript:alert(1)` (or whitespace/case/tab variants, or `//evil`)
 * becomes a click-to-execute sink. The gate must FAIL this file (exit 1).
 */
export function Detail({ sourceUrl }: { sourceUrl: string }): JSX.Element {
  return (
    <main>
      <a href={sourceUrl} rel="noopener noreferrer" target="_blank">
        Source
      </a>
    </main>
  );
}
