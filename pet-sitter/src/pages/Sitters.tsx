import { Page } from '../components/Page';
import { SitterSearchList } from '../components/SitterSearchList';
import { en } from '../i18n/en';

/**
 * Full sitters collection with text search that narrows results.
 */
export function Sitters(): JSX.Element {
  return (
    <Page title={en.sitters.title}>
      <SitterSearchList intro={en.sitters.intro} inputId="sitters-page-search" />
    </Page>
  );
}
