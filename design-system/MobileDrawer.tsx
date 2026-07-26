/**
 * Shared with every RedAnvil app.
 *
 * Drawer chrome (backdrop, panel, head, nav list) is identical; apps pass
 * their logo, items, labels, and icon-button style so product IA can differ.
 */
import React, { type CSSProperties, type ReactNode, type RefObject } from 'react';
import { NavLink, type NavItem } from './NavLink';

export interface MobileDrawerProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** Ref for the drawer aside (focus trap). */
  drawerRef: RefObject<HTMLElement>;
  /** Ref for the close control (initial focus when opened). */
  closeBtnRef: RefObject<HTMLButtonElement>;
  /** Close the drawer. */
  onClose: () => void;
  /** Brand mark rendered in the drawer head. */
  logo: ReactNode;
  /** Ordered nav items (primary + overflow). */
  items: readonly NavItem[];
  /** Whether a given item key is the current page. */
  isActive: (key: string) => boolean;
  /** Accessible name for the drawer and its nav. */
  navLabel: string;
  /** Aria label for the close control. */
  closeLabel: string;
  /** Icon button chrome (no display — class owns visibility elsewhere). */
  iconButtonStyle: CSSProperties;
}

/**
 * Mobile side drawer with backdrop: brand, close control, and overflow nav.
 */
export function MobileDrawer({
  open,
  drawerRef,
  closeBtnRef,
  onClose,
  logo,
  items,
  isActive,
  navLabel,
  closeLabel,
  iconButtonStyle
}: MobileDrawerProps): JSX.Element {
  const openAttr = open ? 'true' : 'false';

  return (
    <>
      <div
        className="ra-drawer-backdrop"
        data-open={openAttr}
        aria-hidden={!open}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        id="ra-side-drawer"
        className="ra-drawer"
        data-open={openAttr}
        aria-label={navLabel}
        aria-hidden={!open}
        tabIndex={-1}
      >
        <div className="ra-drawer-head">
          {logo}
          <button
            ref={closeBtnRef}
            type="button"
            style={iconButtonStyle}
            aria-label={closeLabel}
            onClick={onClose}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <nav aria-label={navLabel}>
          {items.map((item) => (
            <NavLink key={item.key} item={item} active={isActive(item.key)} onNavigate={onClose} />
          ))}
        </nav>
      </aside>
    </>
  );
}
