import { Page } from '../components/Page';
import { SitterSearchList } from '../components/SitterSearchList';

/**
 * Full sitters collection: same three architectures and shared filter URL state.
 * Breadcrumbs stay on — /sitters is an inner route (home alone hides them).
 */
export function Sitters(): JSX.Element {
  return (
    <Page fullBleed>
      <SitterSearchList inputId="sitters-page-search" />
    </Page>
  );
}
