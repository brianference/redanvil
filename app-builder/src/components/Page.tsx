import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { useLocation } from 'react-router-dom';
import { useDrawerA11y } from '../lib/useDrawerA11y';
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
              padding: `${theme.space.xl}px ${theme.space.lg}px`
            }}
          >
            {breadcrumb !== undefined && <Breadcrumbs current={breadcrumb} />}
            <h1
              className="ra-h1"
              style={{ fontSize: theme.type.scale[5], margin: 0, letterSpacing: '-0.02em' }}
            >
              {title}
            </h1>
            {subtitle !== undefined && (
              <p
                style={{
                  color: theme.color.muted,
                  fontSize: theme.type.scale[3],
                  maxWidth: '40rem',
                  marginTop: theme.space.sm
                }}
              >
                {subtitle}
              </p>
            )}
            <div style={{ marginTop: theme.space.xl }}>{children}</div>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}
