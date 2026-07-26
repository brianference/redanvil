/**
 * Thin wrapper: supplies dashboard shell chrome and subcomponents to the
 * shared Page orchestrator.
 */
import type { ReactNode } from 'react';
import { Page as SharedPage, type PageProps as SharedPageProps } from '../../../design-system/Page';
import { theme } from '../theme';
import { Breadcrumbs } from './Breadcrumbs';
import { Footer } from './shell/Footer';
import { Header } from './shell/Header';
import { MobileDrawer } from './shell/MobileDrawer';
import { shellContainer, shellCss, shellStyle } from './shell/styles';

export interface PageProps {
  /** Page title, rendered as the single h1. */
  title: string;
  /** Optional hero subtitle under the h1. */
  subtitle?: string;
  /** Optional breadcrumb current-page label (inner pages only). */
  breadcrumb?: string;
  /** Page body. */
  children: ReactNode;
}

/**
 * Shared page shell: sticky header with primary nav, aligned main/footer, drawer.
 */
export function Page({ title, subtitle, breadcrumb, children }: PageProps): JSX.Element {
  const chrome: SharedPageProps['chrome'] = {
    spaceXl: theme.space.xl,
    spaceLg: theme.space.lg,
    spaceSm: theme.space.sm,
    h1Size: theme.type.scale[5] ?? 32,
    subtitleSize: theme.type.scale[3] ?? 18,
    muted: theme.color.muted
  };

  return (
    <SharedPage
      title={title}
      subtitle={subtitle}
      breadcrumb={breadcrumb}
      shellStyle={shellStyle}
      shellContainer={shellContainer}
      shellCss={shellCss}
      chrome={chrome}
      Header={Header}
      MobileDrawer={MobileDrawer}
      Footer={Footer}
      Breadcrumbs={Breadcrumbs}
    >
      {children}
    </SharedPage>
  );
}
