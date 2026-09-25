import type { CSSProperties } from 'react';
import { en } from '../../i18n/en';
import type { Example } from '../../lib/examples';
import { theme } from '../../theme';
import { ExampleCard } from './ExampleCard';

/**
 * The filtered catalog: one card per example, or a status line when the
 * active filter matches none.
 *
 * @param props.examples - Examples that pass the active filter.
 */
export function ExampleGrid({ examples }: { examples: readonly Example[] }): JSX.Element {
  if (examples.length === 0) {
    return (
      <p role="status" style={emptyStyle}>
        {en.pages.examples.filterEmpty}
      </p>
    );
  }
  return (
    <div className="ex-catalog__grid">
      {examples.map((example) => (
        <ExampleCard key={example.slug} example={example} />
      ))}
    </div>
  );
}

const emptyStyle: CSSProperties = { color: theme.color.muted };
