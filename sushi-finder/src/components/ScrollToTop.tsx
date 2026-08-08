import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scroll to top on client route changes.
 */
export function ScrollToTop(): null {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
