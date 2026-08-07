import { Page } from '../components/Page';
import { SitterSearchList } from '../components/SitterSearchList';

/**
 * Full sitters collection: same three architectures and shared filter URL state.
 */
export function Sitters(): JSX.Element {
  return (
    <Page fullBleed hideBreadcrumbs>
      <SitterSearchList inputId="sitters-page-search" />
    </Page>
  );
}
