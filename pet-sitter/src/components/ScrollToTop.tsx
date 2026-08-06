import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Reset scroll position on route change (R34). */
export function ScrollToTop(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    // 'auto', not 'smooth': this is a navigation, not a gesture.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
