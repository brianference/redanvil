import { Page } from '../components/Page';
import { SitterSearchList } from '../components/SitterSearchList';

/**
 * Home marketplace: three real layout architectures (Photos / Map / Dates).
 * Each view owns its fold — no shared marketing hero or shared search shell.
 */
export function Home(): JSX.Element {
  return (
    <Page fullBleed hideBreadcrumbs>
      <SitterSearchList formTestId="sitter-search" inputId="sitter-search-input" />
    </Page>
  );
}
