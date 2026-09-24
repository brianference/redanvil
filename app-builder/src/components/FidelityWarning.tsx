import { readPrdFidelity } from '../lib/prd/sections/frontmatter';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { warningBannerStyle } from './ui';

/**
 * Visible warning when the PRD's own fidelity check failed.
 *
 * Sits above the document. The PRD stays on the page.
 *
 * @param props.markdown - Generated PRD markdown.
 * @returns The panel, or null when fidelity passed or is absent.
 */
export function FidelityWarning({ markdown }: { markdown: string }): JSX.Element | null {
  const fidelity = readPrdFidelity(markdown);
  if (fidelity.fidelity !== 'fail') return null;
  const copy = en.prdResult;
  return (
    <div
      role="alert"
      data-testid="fidelity-warning"
      style={{ ...warningBannerStyle(), marginBottom: theme.space.md }}
    >
      <span aria-hidden="true">!</span>
      <div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: theme.type.scale[2] }}>{copy.fidelityTitle}</p>
        <p style={{ margin: `${theme.space.xs}px 0 0`, fontSize: theme.type.scale[2] }}>{copy.fidelityBody}</p>
        {fidelity.unmatched.length > 0 && (
          <ul
            aria-label={copy.fidelityUnmatchedLabel}
            style={{
              margin: `${theme.space.sm}px 0 0`,
              paddingLeft: theme.space.lg,
              fontSize: theme.type.scale[2]
            }}
          >
            {fidelity.unmatched.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
