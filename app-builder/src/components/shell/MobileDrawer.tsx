import type { RefObject } from 'react';
import { en } from '../../i18n/en';
import { Logo } from './Logo';
import { drawerNavItems, NavLink } from './NavLinks';
import { iconButtonStyle } from './styles';

export interface MobileDrawerProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** Ref for the drawer aside (focus trap). */
  drawerRef: RefObject<HTMLElement>;
  /** Ref for the close control (initial focus when opened). */
  closeBtnRef: RefObject<HTMLButtonElement>;
  /** Close the drawer. */
  onClose: () => void;
}

/**
 * Mobile side drawer with backdrop: brand, close control, and overflow nav.
 */
export function MobileDrawer({
  open,
  drawerRef,
  closeBtnRef,
  onClose
}: MobileDrawerProps): JSX.Element {
  const drawerItems = drawerNavItems();
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
        aria-label={en.app.primaryNav}
        aria-hidden={!open}
        tabIndex={-1}
      >
        <div className="ra-drawer-head">
          <Logo height={48} />
          <button
            ref={closeBtnRef}
            type="button"
            style={iconButtonStyle}
            aria-label={en.app.menuClose}
            onClick={onClose}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <nav aria-label={en.app.primaryNav}>
          {drawerItems.map((item) => (
            <NavLink key={item.key} item={item} onNavigate={onClose} />
          ))}
        </nav>
      </aside>
    </>
  );
}
