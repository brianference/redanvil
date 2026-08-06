import { Page } from '../components/Page';
import { SitterSearchList } from '../components/SitterSearchList';
import { en } from '../i18n/en';

/**
 * Full sitters collection with shared filters and three view modes.
 */
export function Sitters(): JSX.Element {
  return (
    <Page title={en.sitters.title}>
      <SitterSearchList intro={en.sitters.intro} inputId="sitters-page-search" />
    </Page>
  );
}
