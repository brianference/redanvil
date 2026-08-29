import { NavLink } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { en } from '../i18n/en';

export interface PrimaryNavLinksProps {
  /** Class name for each link (active/inactive). */
  className: (isActive: boolean) => string;
  /** Called after a link is activated (e.g. close mobile drawer). */
  onNavigate?: () => void;
}

/**
 * Shared primary nav destinations (home, grid, about, contact, account/sign-in).
 * Used by CompactHeader and Layout so the route list is not duplicated.
 *
 * @param props - Class helper and optional navigate callback.
 */
export function PrimaryNavLinks({ className, onNavigate }: PrimaryNavLinksProps) {
  const go = onNavigate ?? (() => undefined);
  const { email } = useSession();
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
      {email ? (
        <NavLink to="/account" className={({ isActive }) => className(isActive)} onClick={go}>
          {en.nav.account}
        </NavLink>
      ) : (
        <NavLink to="/signin" className={({ isActive }) => className(isActive)} onClick={go}>
          {en.nav.signIn}
        </NavLink>
      )}
    </>
  );
}
