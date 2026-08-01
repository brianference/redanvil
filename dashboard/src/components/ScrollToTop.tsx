import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Reset scroll position on route change (R34).
 *
 * Client-side navigations keep the previous scroll offset (unlike a full
 * document load). Without this, following a footer link from far down a page
 * lands the reader mid-document on a page they have not opened.
 *
 * @returns null — side-effect only.
 */
export function ScrollToTop(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    // 'auto', not 'smooth': this is a navigation, not a gesture.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
