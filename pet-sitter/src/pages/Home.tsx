import { Page } from '../components/Page';
import { SitterSearchList } from '../components/SitterSearchList';
import { en } from '../i18n/en';

/**
 * Home: marketplace search over sitters with live narrowing.
 */
export function Home(): JSX.Element {
  return (
    <Page title={en.home.title}>
      <SitterSearchList
        intro={en.home.intro}
        showBrowseAll
        formTestId="sitter-search"
        inputId="sitter-search-input"
      />
    </Page>
  );
}
