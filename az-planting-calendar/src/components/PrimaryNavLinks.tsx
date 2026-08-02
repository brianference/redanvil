import { NavLink } from 'react-router-dom';
import { en } from '../i18n/en';

export interface PrimaryNavLinksProps {
  /** Class name for each link (active/inactive). */
  className: (isActive: boolean) => string;
  /** Called after a link is activated (e.g. close mobile drawer). */
  onNavigate?: () => void;
}

/**
 * Shared primary nav destinations (home, grid, about, contact).
 * Used by CompactHeader and Layout so the route list is not duplicated.
 *
 * @param props - Class helper and optional navigate callback.
 */
export function PrimaryNavLinks({ className, onNavigate }: PrimaryNavLinksProps) {
  const go = onNavigate ?? (() => undefined);
  return (
    <>
      <NavLink to="/" end className={({ isActive }) => className(isActive)} onClick={go}>
        {en.nav.home}
      </NavLink>
      <NavLink to="/grid" className={({ isActive }) => className(isActive)} onClick={go}>
        {en.nav.grid}
      </NavLink>
      <NavLink to="/about" className={({ isActive }) => className(isActive)} onClick={go}>
        {en.nav.about}
      </NavLink>
      <NavLink to="/contact" className={({ isActive }) => className(isActive)} onClick={go}>
        {en.nav.contact}
      </NavLink>
    </>
  );
}
