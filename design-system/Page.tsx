/**
 * Shared with every RedAnvil app.
 *
 * Page shell orchestration (drawer state, a11y, main landmark, h1) was
 * byte-identical in app-builder and dashboard. Header, drawer, footer,
 * breadcrumbs, and chrome styles are injected so each app keeps its own
 * product shell without re-implementing the layout machine.
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from 'react';
import { useLocation } from 'react-router-dom';
import { useDrawerA11y } from './hooks/useDrawerA11y';

/** Props the injected Header must accept. */
export interface PageHeaderProps {
  menuOpen: boolean;
  headerRef: RefObject<HTMLElement>;
  menuBtnRef: RefObject<HTMLButtonElement>;
  onToggleMenu: () => void;
}

/** Props the injected MobileDrawer must accept. */
export interface PageDrawerProps {
  open: boolean;
  drawerRef: RefObject<HTMLElement>;
  closeBtnRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
}

/** Props the injected Breadcrumbs must accept. */
export interface PageBreadcrumbsProps {
  current: string;
}

/** Chrome tokens for main / title / subtitle spacing and colour. */
export interface PageChromeTokens {
  spaceXl: number;
  spaceLg: number;
  spaceSm: number;
  h1Size: number;
  subtitleSize: number;
  muted: string;
}

export interface PageProps {
  /** Page title, rendered as the single h1. */
  title: string;
  /** Optional hero subtitle under the h1. */
  subtitle?: string;
  /** Optional breadcrumb current-page label (inner pages only). */
  breadcrumb?: string;
  /** Page body. */
  children: ReactNode;
  /** Outer shell style. */
  shellStyle: CSSProperties;
  /** Content column style. */
  shellContainer: CSSProperties;
  /** Global shell CSS string. */
  shellCss: () => string;
  /** Main / title metrics. */
  chrome: PageChromeTokens;
  /** Sticky header. */
  Header: ComponentType<PageHeaderProps>;
  /** Mobile nav drawer. */
  MobileDrawer: ComponentType<PageDrawerProps>;
  /** Site footer. */
  Footer: ComponentType;
  /** Breadcrumb trail (only mounted when `breadcrumb` is set). */
  Breadcrumbs: ComponentType<PageBreadcrumbsProps>;
}

/**
 * Shared page shell: sticky header with primary nav, aligned main/footer, drawer.
 */
export function Page({
  title,
  subtitle,
  breadcrumb,
  children,
  shellStyle,
  shellContainer,
  shellCss,
  chrome,
  Header,
  MobileDrawer,
  Footer,
  Breadcrumbs
}: PageProps): JSX.Element {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  /**
   * Close the mobile nav drawer.
   */
  const closeMenu = useCallback((): void => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    // Client-side navigations keep the previous scroll offset (unlike a full
    // document load). Reset so a footer link never lands the reader mid-page
    // in a document they have not opened (R34).
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useDrawerA11y({
    open: menuOpen,
    drawerRef,
    triggerRef: menuBtnRef,
    initialFocusRef: closeBtnRef,
    backgroundRefs: [headerRef, bodyRef],
    onClose: closeMenu
  });

  return (
    <div className="ra-shell" style={shellStyle}>
      <style>{shellCss()}</style>

      <Header
        menuOpen={menuOpen}
        headerRef={headerRef}
        menuBtnRef={menuBtnRef}
        onToggleMenu={() => {
          setMenuOpen((open) => !open);
        }}
      />

      <MobileDrawer
        open={menuOpen}
        drawerRef={drawerRef}
        closeBtnRef={closeBtnRef}
        onClose={closeMenu}
      />

      <div ref={bodyRef} className="ra-body">
        <div className="ra-main-col">
          <main
            style={{
              ...shellContainer,
              flex: 1,
              padding: `${chrome.spaceXl}px ${chrome.spaceLg}px`
            }}
          >
            {breadcrumb !== undefined && <Breadcrumbs current={breadcrumb} />}
            <h1
              className="ra-h1"
              style={{ fontSize: chrome.h1Size, margin: 0, letterSpacing: '-0.02em' }}
            >
              {title}
            </h1>
            {subtitle !== undefined && (
              <p
                className="ra-prose-lead"
                style={{
                  color: chrome.muted,
                  fontSize: chrome.subtitleSize,
                  marginTop: chrome.spaceSm
                }}
              >
                {subtitle}
              </p>
            )}
            <div style={{ marginTop: chrome.spaceXl }}>{children}</div>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}
